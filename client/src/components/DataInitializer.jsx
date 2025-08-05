import { useState, useEffect } from 'react';
import { isDatabaseEmpty, importTranslationsFromCSV } from '../utils/db-bridge';

function DataInitializer({ onInitialized }) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const initializeData = async () => {
      try {
        const isEmpty = await isDatabaseEmpty();
        
        if (isEmpty) {
          // Fetch the initial CSV data
          const response = await fetch('/data/translations.csv');
          let csvData = await response.text();
          
          // Check and update header if needed (for backward compatibility)
          if (csvData.startsWith('French,Wolof')) {
            csvData = 'Wolof,French' + csvData.substring('French,Wolof'.length);
          }
          
          // Import the data into the database
          await importTranslationsFromCSV(csvData);
        }
        
        // Signal that initialization is complete
        onInitialized();
      } catch (error) {
        console.error('Error initializing data:', error);
        // Still mark as initialized even on error to prevent blocking the app
        onInitialized();
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeData();
  }, [onInitialized]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Initialisation de la base de données...</p>
      </div>
    );
  }
  
  // This component doesn't render anything after initialization
  return null;
}

export default DataInitializer;