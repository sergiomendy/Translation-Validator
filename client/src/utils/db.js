// Simple IndexedDB wrapper for our translation database
const DB_NAME = 'TranslationDB';
const DB_VERSION = 1;
const TRANSLATIONS_STORE = 'translations';
const USERS_STORE = 'users';

// Initialize the database
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create translations store with id as key path
      if (!db.objectStoreNames.contains(TRANSLATIONS_STORE)) {
        const translationsStore = db.createObjectStore(TRANSLATIONS_STORE, { keyPath: 'id', autoIncrement: true });
        translationsStore.createIndex('french', 'french', { unique: false });
        translationsStore.createIndex('status', 'status', { unique: false });
      }

      // Create users store
      if (!db.objectStoreNames.contains(USERS_STORE)) {
        const usersStore = db.createObjectStore(USERS_STORE, { keyPath: 'id', autoIncrement: true });
        usersStore.createIndex('name', 'name', { unique: true });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(`Database error: ${event.target.error}`);
    };
  });
};

// Get database instance
const getDB = async () => {
  return await initDB();
};

// Add translations from CSV
export const importTranslationsFromCSV = async (csvData) => {
  try {
    const db = await getDB();
    const transaction = db.transaction(TRANSLATIONS_STORE, 'readwrite');
    const store = transaction.objectStore(TRANSLATIONS_STORE);
    
    // Parse CSV data
    const lines = csvData.split('\n');
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        // Handle possible commas in the content by parsing properly
        const parts = line.split(',');
        if (parts.length >= 2) {
          // Columns are now Wolof,French (reversed order)
          const wolof = parts[0].trim();
          // Join all remaining parts as the French translation (in case it contains commas)
          const french = parts.slice(1).join(',').trim();
          
          // Only add if both fields have content
          if (french && wolof) {
            store.add({
              french,
              wolof,
              status: 'pending', // pending, validated, or corrected
              validatedBy: null,
              originalWolof: wolof, // Keep original translation
              lastUpdated: new Date().toISOString()
            });
          }
        }
      }
    }
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
};

// Get all translations
export const getAllTranslations = async () => {
  const db = await getDB();
  const transaction = db.transaction(TRANSLATIONS_STORE, 'readonly');
  const store = transaction.objectStore(TRANSLATIONS_STORE);
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get random pending translation
export const getRandomPendingTranslation = async () => {
  const translations = await getAllTranslations();
  const pendingTranslations = translations.filter(t => t.status === 'pending');
  
  if (pendingTranslations.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * pendingTranslations.length);
  return pendingTranslations[randomIndex];
};

// Update translation
export const updateTranslation = async (id, updates) => {
  const db = await getDB();
  const transaction = db.transaction(TRANSLATIONS_STORE, 'readwrite');
  const store = transaction.objectStore(TRANSLATIONS_STORE);
  
  // First get the existing translation
  const getRequest = store.get(id);
  
  return new Promise((resolve, reject) => {
    getRequest.onsuccess = () => {
      const translation = getRequest.result;
      const updatedTranslation = {
        ...translation,
        ...updates,
        lastUpdated: new Date().toISOString()
      };
      
      const updateRequest = store.put(updatedTranslation);
      
      updateRequest.onsuccess = () => resolve(updatedTranslation);
      updateRequest.onerror = () => reject(updateRequest.error);
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// Check if database is empty
export const isDatabaseEmpty = async () => {
  const translations = await getAllTranslations();
  return translations.length === 0;
};

// Get all validated translations
export const getValidatedTranslations = async () => {
  const translations = await getAllTranslations();
  return translations.filter(t => t.status === 'validated');
};

// Initialize users
export const initializeUsers = async () => {
  const db = await getDB();
  const transaction = db.transaction(USERS_STORE, 'readwrite');
  const store = transaction.objectStore(USERS_STORE);
  
  // Add default users if they don't exist
  const defaultUsers = ['Alwaly', 'Serge', 'Matar'];
  
  for (const name of defaultUsers) {
    const index = store.index('name');
    const request = index.get(name);
    
    request.onsuccess = () => {
      if (!request.result) {
        store.add({ name });
      }
    };
  }
  
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = (event) => reject(event.target.error);
  });
};

// Get all users
export const getUsers = async () => {
  const db = await getDB();
  const transaction = db.transaction(USERS_STORE, 'readonly');
  const store = transaction.objectStore(USERS_STORE);
  const request = store.getAll();
  
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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