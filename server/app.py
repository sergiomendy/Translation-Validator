from fastapi import FastAPI, HTTPException, Depends, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import csv
import io
import os
from datetime import datetime
import json
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId

# Create FastAPI app
app = FastAPI(title="Translation Validator API")

# MongoDB configuration
MONGODB_URL = "mongodb+srv://admin:admin@cluster0.n7jczep.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DATABASE_NAME = "translations_db"

# MongoDB client
client = MongoClient(MONGODB_URL)
database = client[DATABASE_NAME]

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","https://translation-validator.vercel.app"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
def init_db():
    global client, database
    print("Initializing MongoDB connection...")
    
    try:
        client = MongoClient(MONGODB_URL)
        database = client[DATABASE_NAME]
        
        # Test connection
        client.admin.command('ping')
        print("MongoDB connection successful!")
        
        # Create collections and indexes
        translations_collection = database.translations
        users_collection = database.users
        
        # Create unique index for translations (french + wolof combination)
        try:
            translations_collection.create_index([("french", 1), ("wolof", 1)], unique=True)
        except Exception:
            pass  # Index might already exist
        
        # Create unique index for users
        try:
            users_collection.create_index("name", unique=True)
        except Exception:
            pass  # Index might already exist
        
        # Add default users
        default_users = ['Alwaly', 'Serge', 'Matar']
        for name in default_users:
            try:
                users_collection.insert_one({"name": name})
            except DuplicateKeyError:
                pass  # User already exists
                
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise

def close_db():
    global client
    if client:
        client.close()

# Initialize database on startup
@app.on_event("startup")
def startup_event():
    init_db()

# Close database on shutdown
@app.on_event("shutdown")
def shutdown_event():
    close_db()

# Database connection helper
def get_database():
    return database

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
def get_translations():
    try:
        db = get_database()
        translations = []
        for translation in db.translations.find():
            translations.append(translation_helper(translation))
        return translations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/random")
def get_random_translation():
    try:
        db = get_database()
        pipeline = [
            {"$match": {"status": "pending"}},
            {"$sample": {"size": 1}}
        ]
        result = list(db.translations.aggregate(pipeline))
        if result:
            return translation_helper(result[0])
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/translations/{translation_id}", response_model=dict)
def update_translation(
    translation_id: str, 
    updates: TranslationUpdate
):
    try:
        # Validate ObjectId format
        try:
            obj_id = ObjectId(translation_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid translation ID format")
        
        # Check if translation exists
        db = get_database()
        existing = db.translations.find_one({"_id": obj_id})
        
        if not existing:
            raise HTTPException(status_code=404, detail=f"Translation with ID {translation_id} not found")
        
        # Prepare update fields and values
        update_dict = updates.dict(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        # Add lastUpdated timestamp
        update_dict['lastUpdated'] = datetime.now().isoformat()
        
        # Execute update
        result = db.translations.update_one(
            {"_id": obj_id},
            {"$set": update_dict}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update translation")
        
        # Return updated translation
        updated = db.translations.find_one({"_id": obj_id})
        return translation_helper(updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translations/import")
def import_translations(csv_data: CSVImport):
    try:
        lines = csv_data.csvData.strip().split('\n')
        db = get_database()
        now = datetime.now().isoformat()
        
        inserted_count = 0
        
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
                        "hasBeenCorrected": 0,
                        "validatedBy": None,
                        "correctedBy": None
                    }
                    
                    try:
                        db.translations.insert_one(translation_doc)
                        inserted_count += 1
                    except DuplicateKeyError:
                        # Ignore duplicates
                        pass
        
        print(f"Inserted {inserted_count} new translations")
        return {"success": True, "message": f"Import successful. Inserted {inserted_count} new translations."}
    except Exception as e:
        print(f"Import error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/count")
def check_database_empty():
    try:
        db = get_database()
        count = db.translations.count_documents({})
        return {"isEmpty": count == 0, "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/validated", response_model=List[dict])
def get_validated_translations():
    try:
        db = get_database()
        translations = []
        for translation in db.translations.find({"status": "validated"}):
            translations.append(translation_helper(translation))
        return translations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/export")
def export_validated_translations():
    try:
        db = get_database()
        translations = list(db.translations.find({"status": "validated"}))
        
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
def get_users():
    try:
        db = get_database()
        users = []
        for user in db.users.find():
            users.append(user_helper(user))
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))