// Browser implementation using localStorage for our translation database
// This implementation prevents duplicates by checking before insertion

// Storage keys
const TRANSLATIONS_KEY = 'translations_data';
const USERS_KEY = 'users_data';

// Initialize the database
export const initDB = async () => {
  // Ensure the storage is initialized
  if (!localStorage.getItem(TRANSLATIONS_KEY)) {
    localStorage.setItem(TRANSLATIONS_KEY, JSON.stringify([]));
  }
  
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify([]));
  }
  
  return true;
};

// Get database instance (not needed for localStorage, but kept for API consistency)
export const getDB = async () => {
  await initDB();
  return true;
};

// Helper function to check if a translation already exists
const translationExists = (french, wolof) => {
  const translations = JSON.parse(localStorage.getItem(TRANSLATIONS_KEY));
  return translations.some(t => t.french === french && t.wolof === wolof);
};

// Add translations from CSV
export const importTranslationsFromCSV = async (csvData) => {
  try {
    await initDB();
    
    // Get current translations
    const translations = JSON.parse(localStorage.getItem(TRANSLATIONS_KEY));
    
    // Parse CSV data
    const lines = csvData.split('\n');
    let addedCount = 0;
    
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
          
          // Only add if both fields have content and not already existing
          if (french && wolof && !translationExists(french, wolof)) {
            translations.push({
              id: Date.now() + addedCount, // Generate a unique ID
              french,
              wolof,
              status: 'pending', // pending, validated, or corrected
              validatedBy: null,
              originalWolof: wolof, // Keep original translation
              lastUpdated: new Date().toISOString()
            });
            addedCount++;
          }
        }
      }
    }
    
    // Save updated translations
    localStorage.setItem(TRANSLATIONS_KEY, JSON.stringify(translations));
    return true;
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
};

// Get all translations
export const getAllTranslations = async () => {
  await initDB();
  return JSON.parse(localStorage.getItem(TRANSLATIONS_KEY));
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
  await initDB();
  
  // Get all translations
  const translations = JSON.parse(localStorage.getItem(TRANSLATIONS_KEY));
  
  // Find the translation to update
  const index = translations.findIndex(t => t.id === id);
  
  if (index === -1) {
    throw new Error(`Translation with ID ${id} not found`);
  }
  
  // Create updated translation
  const updatedTranslation = {
    ...translations[index],
    ...updates,
    lastUpdated: new Date().toISOString()
  };
  
  // Replace the old translation
  translations[index] = updatedTranslation;
  
  // Save updated translations
  localStorage.setItem(TRANSLATIONS_KEY, JSON.stringify(translations));
  
  return updatedTranslation;
};

// Check if database is empty
export const isDatabaseEmpty = async () => {
  await initDB();
  const translations = JSON.parse(localStorage.getItem(TRANSLATIONS_KEY));
  return translations.length === 0;
};

// Get all validated translations
export const getValidatedTranslations = async () => {
  const translations = await getAllTranslations();
  return translations.filter(t => t.status === 'validated');
};

// Initialize users
export const initializeUsers = async () => {
  await initDB();
  
  const users = JSON.parse(localStorage.getItem(USERS_KEY));
  
  // Add default users if they don't exist
  const defaultUsers = ['Alwaly', 'Serge', 'Matar'];
  let changed = false;
  
  for (const name of defaultUsers) {
    if (!users.some(user => user.name === name)) {
      users.push({
        id: Date.now() + users.length,
        name
      });
      changed = true;
    }
  }
  
  if (changed) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  
  return true;
};

// Get all users
export const getUsers = async () => {
  await initDB();
  return JSON.parse(localStorage.getItem(USERS_KEY));
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