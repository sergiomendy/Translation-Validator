// This file serves as a bridge between the application and the database implementation
// It allows us to easily switch between local storage and API client implementations

// Import the API client for server-based database access
import * as apiClient from './api-client';
// Import local storage implementation as fallback
import * as browserDb from './browser-db';

// Use the API client for server-based database access
// This ensures all users share the same database
const db = apiClient;

// Export all methods from the API client implementation
export const {
  initDB,
  getDB,
  importTranslationsFromCSV,
  getAllTranslations,
  getRandomPendingTranslation,
  updateTranslation,
  isDatabaseEmpty,
  getValidatedTranslations,
  initializeUsers,
  getUsers,
  exportValidatedTranslationsToCSV
} = db;