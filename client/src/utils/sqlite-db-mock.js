// SQLite mock implementation for browser environments
// This provides stubs for all methods used in the real sqlite-db.js

// Empty database simulation
let mockDb = {
  translations: [],
  users: []
};

// Initialize the database
export const initDB = async () => {
  console.log('Using SQLite mock in browser environment');
  return mockDb;
};

// Get database instance
export const getDB = () => {
  return mockDb;
};

// Add translations from CSV
export const importTranslationsFromCSV = async (csvData) => {
  console.warn('SQLite not available in browser - using mock implementation');
  return true;
};

// Get all translations
export const getAllTranslations = async () => {
  console.warn('SQLite not available in browser - using mock implementation');
  return [];
};

// Get random pending translation
export const getRandomPendingTranslation = async () => {
  console.warn('SQLite not available in browser - using mock implementation');
  return null;
};

// Update translation
export const updateTranslation = async (id, updates) => {
  console.warn('SQLite not available in browser - using mock implementation');
  return { id, ...updates };
};

// Check if database is empty
export const isDatabaseEmpty = async () => {
  console.warn('SQLite not available in browser - using mock implementation');
  return true;
};

// Get all validated translations
export const getValidatedTranslations = async () => {
  console.warn('SQLite not available in browser - using mock implementation');
  return [];
};

// Initialize users
export const initializeUsers = async () => {
  console.warn('SQLite not available in browser - using mock implementation');
  return true;
};

// Get all users
export const getUsers = async () => {
  console.warn('SQLite not available in browser - using mock implementation');
  return [{ id: 1, name: 'Alwaly' }, { id: 2, name: 'Serge' }, { id: 3, name: 'Matar' }];
};

// Export validated translations to CSV
export const exportValidatedTranslationsToCSV = async () => {
  console.warn('SQLite not available in browser - using mock implementation');
  return 'Wolof,French,Status,ValidatedBy,CorrectedBy,LastUpdated\n';
};