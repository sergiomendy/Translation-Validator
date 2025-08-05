// SQLite implementation for our translation database
import Database from 'better-sqlite3';

// Database connection
let db = null;

// Initialize the database
export const initDB = () => {
  if (db) return db;
  
  try {
    // Create an in-memory database for development
    // For production, you would use a file path
    db = new Database(':memory:');
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Create translations table
    db.exec(`
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
        UNIQUE(french, wolof) -- Prevent duplicates
      )
    `);

    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);
    
    return db;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

// Get database instance
export const getDB = () => {
  return db || initDB();
};

// Add translations from CSV
export const importTranslationsFromCSV = async (csvData) => {
  try {
    const database = getDB();
    
    // Parse CSV data
    const lines = csvData.split('\n');
    
    // Begin transaction
    const transaction = database.transaction(() => {
      const stmt = database.prepare(`
        INSERT OR IGNORE INTO translations 
        (wolof, french, status, originalWolof, lastUpdated) 
        VALUES (?, ?, 'pending', ?, ?)
      `);

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          // Handle possible commas in the content by parsing properly
          const parts = line.split(',');
          if (parts.length >= 2) {
            // Columns are now Wolof,French
            const wolof = parts[0].trim();
            // Join all remaining parts as the French translation (in case it contains commas)
            const french = parts.slice(1).join(',').trim();
            
            // Only add if both fields have content
            if (french && wolof) {
              const now = new Date().toISOString();
              stmt.run(wolof, french, wolof, now);
            }
          }
        }
      }
    });
    
    transaction();
    return true;
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
};

// Get all translations
export const getAllTranslations = async () => {
  try {
    const database = getDB();
    const rows = database.prepare('SELECT * FROM translations').all();
    return rows;
  } catch (error) {
    console.error('Error getting translations:', error);
    throw error;
  }
};

// Get random pending translation
export const getRandomPendingTranslation = async () => {
  try {
    const database = getDB();
    // Use ORDER BY RANDOM() to get a random row
    const translation = database.prepare(
      'SELECT * FROM translations WHERE status = ? ORDER BY RANDOM() LIMIT 1'
    ).get('pending');
    
    return translation || null;
  } catch (error) {
    console.error('Error getting random translation:', error);
    throw error;
  }
};

// Update translation
export const updateTranslation = async (id, updates) => {
  try {
    const database = getDB();
    
    // First get the existing translation
    const translation = database.prepare('SELECT * FROM translations WHERE id = ?').get(id);
    
    if (!translation) {
      throw new Error(`Translation with ID ${id} not found`);
    }
    
    // Prepare update fields and values
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    
    // Add lastUpdated
    fields.push('lastUpdated = ?');
    values.push(new Date().toISOString());
    
    // Add ID for WHERE clause
    values.push(id);
    
    // Execute update
    const query = `UPDATE translations SET ${fields.join(', ')} WHERE id = ?`;
    database.prepare(query).run(...values);
    
    // Return updated translation
    return database.prepare('SELECT * FROM translations WHERE id = ?').get(id);
  } catch (error) {
    console.error('Error updating translation:', error);
    throw error;
  }
};

// Check if database is empty
export const isDatabaseEmpty = async () => {
  try {
    const database = getDB();
    const count = database.prepare('SELECT COUNT(*) as count FROM translations').get();
    return count.count === 0;
  } catch (error) {
    console.error('Error checking if database is empty:', error);
    throw error;
  }
};

// Get all validated translations
export const getValidatedTranslations = async () => {
  try {
    const database = getDB();
    return database.prepare('SELECT * FROM translations WHERE status = ?').all('validated');
  } catch (error) {
    console.error('Error getting validated translations:', error);
    throw error;
  }
};

// Initialize users
export const initializeUsers = async () => {
  try {
    const database = getDB();
    
    // Add default users if they don't exist
    const defaultUsers = ['Alwaly', 'Serge', 'Matar'];
    
    const transaction = database.transaction(() => {
      const stmt = database.prepare('INSERT OR IGNORE INTO users (name) VALUES (?)');
      for (const name of defaultUsers) {
        stmt.run(name);
      }
    });
    
    transaction();
    return true;
  } catch (error) {
    console.error('Error initializing users:', error);
    throw error;
  }
};

// Get all users
export const getUsers = async () => {
  try {
    const database = getDB();
    return database.prepare('SELECT * FROM users').all();
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

// Export validated translations to CSV
export const exportValidatedTranslationsToCSV = async () => {
  const validatedTranslations = await getValidatedTranslations();
  
  // Create CSV content - new order: Wolof,French
  let csvContent = 'Wolof,French,Status,ValidatedBy,CorrectedBy,LastUpdated\n';
  
  validatedTranslations.forEach(translation => {
    const line = [
      `"${translation.wolof}"`,
      `"${translation.french}"`,
      translation.status,
      translation.validatedBy || '',
      translation.correctedBy || '',
      translation.lastUpdated
    ].join(',');
    csvContent += line + '\n';
  });
  
  return csvContent;
};