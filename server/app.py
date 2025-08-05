from fastapi import FastAPI, HTTPException, Depends, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import csv
import io
import os
from datetime import datetime
import json

# Create FastAPI app
app = FastAPI(title="Translation Validator API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection helper
def get_db():
    db = sqlite3.connect('translations.db')
    db.row_factory = sqlite3.Row  # This enables column access by name
    try:
        yield db
    finally:
        db.close()

# Initialize database
def init_db():
    print("Initializing database...")
    db = sqlite3.connect('translations.db')
    cursor = db.cursor()
    
    # Create translations table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        french TEXT NOT NULL,
        wolof TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        validatedBy TEXT,
        correctedBy TEXT,
        hasBeenCorrected INTEGER DEFAULT 0,
        originalWolof TEXT,
        lastUpdated TEXT,
        UNIQUE(french, wolof)
    )
    ''')
    
    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    ''')
    
    # Add default users
    default_users = ['Alwaly', 'Serge', 'Matar']
    for name in default_users:
        cursor.execute('INSERT OR IGNORE INTO users (name) VALUES (?)', (name,))
    
    db.commit()
    db.close()

# Initialize database on startup
init_db()

# Models
class Translation(BaseModel):
    id: Optional[int] = None
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
    id: Optional[int] = None
    name: str

class CSVImport(BaseModel):
    csvData: str

# Routes
@app.get("/api/translations", response_model=List[dict])
async def get_translations():
    try:
        db = sqlite3.connect('translations.db')
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute('SELECT * FROM translations')
        translations = [dict(row) for row in cursor.fetchall()]
        return translations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/random")
async def get_random_translation():
    try:
        db = sqlite3.connect('translations.db')
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute('SELECT * FROM translations WHERE status = ? ORDER BY RANDOM() LIMIT 1', ('pending',))
        translation = cursor.fetchone()
        if translation:
            return dict(translation)
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/translations/{translation_id}", response_model=dict)
async def update_translation(
    translation_id: int, 
    updates: TranslationUpdate
):
    try:
        # Check if translation exists
        db = sqlite3.connect('translations.db')
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute('SELECT * FROM translations WHERE id = ?', (translation_id,))
        existing = cursor.fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail=f"Translation with ID {translation_id} not found")
        
        # Prepare update fields and values
        update_dict = updates.dict(exclude_unset=True)
        if not update_dict:
            raise HTTPException(status_code=400, detail="No update data provided")
        
        # Add lastUpdated timestamp
        update_dict['lastUpdated'] = datetime.now().isoformat()
        
        # Build the SQL query
        fields = []
        values = []
        for key, value in update_dict.items():
            fields.append(f"{key} = ?")
            values.append(value)
        
        # Add ID for WHERE clause
        values.append(translation_id)
        
        # Execute update
        query = f"UPDATE translations SET {', '.join(fields)} WHERE id = ?"
        cursor.execute(query, values)
        db.commit()
        
        # Return updated translation
        cursor.execute('SELECT * FROM translations WHERE id = ?', (translation_id,))
        updated = cursor.fetchone()
        return dict(updated)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/translations/import")
async def import_translations(csv_data: CSVImport):
    try:
        lines = csv_data.csvData.strip().split('\n')
        db = sqlite3.connect('translations.db')
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        now = datetime.now().isoformat()
        
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
                    cursor.execute(
                        'INSERT OR IGNORE INTO translations (wolof, french, status, originalWolof, lastUpdated) VALUES (?, ?, ?, ?, ?)',
                        (wolof, french, 'pending', wolof, now)
                    )
        
        db.commit()
        return {"success": True, "message": "Import successful"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/count")
async def check_database_empty():
    try:
        db = sqlite3.connect('translations.db')
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute('SELECT COUNT(*) as count FROM translations')
        result = cursor.fetchone()
        count = result['count']
        return {"isEmpty": count == 0, "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/validated", response_model=List[dict])
async def get_validated_translations():
    try:
        db = sqlite3.connect('translations.db')
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute('SELECT * FROM translations WHERE status = ?', ('validated',))
        translations = [dict(row) for row in cursor.fetchall()]
        return translations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/translations/export")
async def export_validated_translations():
    try:
        db = sqlite3.connect('translations.db')
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute('SELECT * FROM translations WHERE status = ?', ('validated',))
        translations = cursor.fetchall()
        
        # Create CSV content
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Wolof', 'French', 'Status', 'ValidatedBy', 'CorrectedBy', 'LastUpdated'])
        
        for translation in translations:
            writer.writerow([
                translation['wolof'],
                translation['french'],
                translation['status'],
                translation['validatedBy'] or '',
                translation['correctedBy'] or '',
                translation['lastUpdated']
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
        db = sqlite3.connect('translations.db')
        db.row_factory = sqlite3.Row
        cursor = db.cursor()
        cursor.execute('SELECT * FROM users')
        users = [dict(row) for row in cursor.fetchall()]
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
