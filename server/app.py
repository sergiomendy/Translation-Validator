from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import csv
import io
import os
from datetime import datetime
import json
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
import asyncio

# Create FastAPI app
app = FastAPI(title="Translation Validator API")

# MongoDB configuration
MONGODB_URL = "mongodb+srv://admin:admin@cluster0.n7jczep.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DATABASE_NAME = "translations_db"

# MongoDB client
client = None
database = None

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection helper
async def get_database():
    return database

# Initialize database
async def init_db():
    global client, database
    print("Initializing MongoDB connection...")
    
    try:
        client = AsyncIOMotorClient(MONGODB_URL)
        database = client[DATABASE_NAME]
        
        # Test connection
        await client.admin.command('ping')
        print("MongoDB connection successful!")
        
        # Create collections and indexes
        translations_collection = database.translations
        users_collection = database.users
        
        # Create unique index for translations (french + wolof combination)
        await translations_collection.create_index([("french", 1), ("wolof", 1)], unique=True)
        
        # Create unique index for users
        await users_collection.create_index("name", unique=True)
        
        # Add default users
        default_users = ['Alwaly', 'Serge', 'Matar']
        for name in default_users:
            try:
                await users_collection.insert_one({"name": name})
            except DuplicateKeyError:
                pass  # User already exists
                
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise

# Startup event
@app.on_event("startup")
async def startup_event():
    await init_db()

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    if client:
        client.close()

# Models
class Translation(BaseModel):
    id: Optional[str] = None
    french: str
    wolof: str
    status: Optional[str] = "pending"
    validatedBy: Optional[str] = None
    correctedBy: Optional[str] = None
    hasBeenCorrected: Optional[int] = 0
    originalWolof: Optional[str] = None
    lastUpdated: Optional[str] = None

    class Config:
        orm_mode = True

class TranslationUpdate(BaseModel):
    french: Optional[str] = None
    wolof: Optional[str] = None
    status: Optional[str] = None
    validatedBy: Optional[str] = None
    correctedBy: Optional[str] = None
    hasBeenCorrected: Optional[int] = None
    originalWolof: Optional[str] = None

class User(BaseModel):
    id: Optional[str] = None
    name: str

class CSVImport(BaseModel):
    csvData: str

# Helper function to convert MongoDB document to dict
def translation_helper(translation) -> dict:
    if translation:
        translation["id"] = str(translation["_id"])
        del translation["_id"]
    return translation

def user_helper(user) -> dict:
    if user:
        user["id"] = str(user["_id"])
        del user["_id"]
    return user

# Routes
@app.get("/api/translations", response_model=List[dict])
async def get_translations():
    try:
        db = await get_database()
        translations = []
        async for translation in db.translations.find():
            translations.append(translation_helper(translation))
        return translations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/random")
async def get_random_translation():
    try:
        db = await get_database()
        pipeline = [
            {"$match": {"status": "pending"}},
            {"$sample": {"size": 1}}
        ]
        async for translation in db.translations.aggregate(pipeline):
            return translation_helper(translation)
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/translations/{translation_id}", response_model=dict)
async def update_translation(
    translation_id: str, 
    updates: TranslationUpdate
):
    try:
        from bson import ObjectId
        
        # Check if translation exists
        db = await get_database()
        existing = await db.translations.find_one({"_id": ObjectId(translation_id)})
        
        if not existing:
            raise HTTPException(status_code=404, detail=f"Translation with ID {translation_id} not found")
        
        # Prepare update fields and values
        update_dict = updates.dict(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        # Add lastUpdated timestamp
        update_dict['lastUpdated'] = datetime.now().isoformat()
        
        # Execute update
        result = await db.translations.update_one(
            {"_id": ObjectId(translation_id)},
            {"$set": update_dict}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update translation")
        
        # Return updated translation
        updated = await db.translations.find_one({"_id": ObjectId(translation_id)})
        return translation_helper(updated)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translations/import")
async def import_translations(csv_data: CSVImport):
    try:
        lines = csv_data.csvData.strip().split('\n')
        db = await get_database()
        now = datetime.now().isoformat()
        
        translations_to_insert = []
        
        for i, line in enumerate(lines):
            if i == 0 or not line:  # Skip header row and empty lines
                continue
            
            parts = line.split('|')
            if len(parts) >= 2:
                # Columns are Wolof,French
                wolof = parts[0].strip()
                # Join remaining parts as French (in case it contains commas)
                french = parts[1].strip()
                
                if french and wolof:
                    translation_doc = {
                        "wolof": wolof,
                        "french": french,
                        "status": "pending",
                        "originalWolof": wolof,
                        "lastUpdated": now,
                        "hasBeenCorrected": 0
                    }
                    translations_to_insert.append(translation_doc)
        
        # Insert all translations, ignore duplicates
        if translations_to_insert:
            try:
                await db.translations.insert_many(translations_to_insert, ordered=False)
            except Exception as e:
                # Some duplicates might be expected, so we don't fail completely
                print(f"Some translations might have been duplicates: {e}")
        
        return {"success": True, "message": "Import successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/count")
async def check_database_empty():
    try:
        db = await get_database()
        count = await db.translations.count_documents({})
        return {"isEmpty": count == 0, "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/validated", response_model=List[dict])
async def get_validated_translations():
    try:
        db = await get_database()
        translations = []
        async for translation in db.translations.find({"status": "validated"}):
            translations.append(translation_helper(translation))
        return translations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/export")
async def export_validated_translations():
    try:
        db = await get_database()
        translations = []
        async for translation in db.translations.find({"status": "validated"}):
            translations.append(translation)
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Wolof', 'French', 'Status', 'ValidatedBy', 'CorrectedBy', 'LastUpdated'])
        
        for translation in translations:
            writer.writerow([
                translation.get('wolof', ''),
                translation.get('french', ''),
                translation.get('status', ''),
                translation.get('validatedBy', ''),
                translation.get('correctedBy', ''),
                translation.get('lastUpdated', '')
            ])
        
        # Prepare response
        response = Response(content=output.getvalue())
        response.headers["Content-Disposition"] = "attachment; filename=validated-translations.csv"
        response.headers["Content-Type"] = "text/csv"
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users", response_model=List[dict])
async def get_users():
    try:
        db = await get_database()
        users = []
        async for user in db.users.find():
            users.append(user_helper(user))
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))