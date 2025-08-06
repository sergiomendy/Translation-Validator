// API client for communicating with the backend server

const API_BASE_URL = 'https://translation-validator-qauy.vercel.app/api';

// Generic API call function with error handling
const apiCall = async (endpoint, method = 'GET', data = null) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    
    // For non-JSON responses (like CSV download)
    if (endpoint === '/translations/export') {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to export data');
      }
      return await response.text();
    }

    // For JSON responses
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'API request failed');
    }

    return await response.json();
  } catch (error) {
    console.error(`API error (${method} ${url}):`, error);
    throw error;
  }
};

// API functions matching the previous database interface
export const initDB = async () => {
  console.log('Connecting to backend server...');
  // No actual initialization needed for client
  return true;
};

export const getDB = () => {
  // No direct DB access in client
  return null;
};

export const importTranslationsFromCSV = async (csvData) => {
  const response = await apiCall('/translations/import', 'POST', { csvData });
  return response.success;
};

export const getAllTranslations = async () => {
  const response = await apiCall('/translations');
  return response;
};

export const getRandomPendingTranslation = async () => {
  const response = await apiCall('/translations/random');
  return response;
};

export const updateTranslation = async (id, updates) => {
  const response = await apiCall(`/translations/${id}`, 'PUT', updates);
  return response;
};

export const isDatabaseEmpty = async () => {
  const response = await apiCall('/translations/count');
  return response.isEmpty;
};

export const getValidatedTranslations = async () => {
  const response = await apiCall('/translations/validated');
  return response;
};

export const initializeUsers = async () => {
  // Users are initialized on the server
  return true;
};

export const getUsers = async () => {
  const response = await apiCall('/users');
  return response;
};

export const exportValidatedTranslationsToCSV = async () => {
  return await apiCall('/translations/export');
};