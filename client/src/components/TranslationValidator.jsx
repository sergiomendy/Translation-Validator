import { useState, useEffect } from 'react';
import { 
  getRandomPendingTranslation, 
  updateTranslation, 
  getAllTranslations,
  exportValidatedTranslationsToCSV 
} from '../utils/db-bridge';

function TranslationValidator({ username, onLogout }) {
  const [currentTranslation, setCurrentTranslation] = useState(null);
  const [editedTranslation, setEditedTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, validated: 0, corrected: 0 });
  const [message, setMessage] = useState('');
  
  // Load a random pending translation
  const loadRandomTranslation = async () => {
    setIsLoading(true);
    try {
      const translation = await getRandomPendingTranslation();
      setCurrentTranslation(translation);
      if (translation) {
        setEditedTranslation(translation.wolof);
      }
    } catch (error) {
      console.error('Error loading translation:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update statistics
  const updateStats = async () => {
    try {
      const translations = await getAllTranslations();
      setStats({
        total: translations.length,
        pending: translations.filter(t => t.status === 'pending').length,
        validated: translations.filter(t => t.status === 'validated').length,
        corrected: translations.filter(t => t.status === 'corrected').length
      });
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  };
  
  // Handle validation
  const handleValidate = async () => {
    if (!currentTranslation) return;
    
    try {
      await updateTranslation(currentTranslation.id, {
        status: 'validated',
        validatedBy: username
      });
      
      setMessage('Traduction validée avec succès !');
      setTimeout(() => setMessage(''), 3000);
      
      // Load next translation and update stats
      await updateStats();
      await loadRandomTranslation();
    } catch (error) {
      console.error('Error validating translation:', error);
    }
  };
  
  // Handle correction
  const handleCorrect = async () => {
    if (!currentTranslation || editedTranslation === currentTranslation.wolof) return;
    
    try {
      await updateTranslation(currentTranslation.id, {
        wolof: editedTranslation,
        status: 'pending', // Reset to pending so it can be validated later
        correctedBy: username, // Track who corrected it
        hasBeenCorrected: true // Flag to indicate this was corrected
      });
      
      setMessage('Traduction corrigée et remise en attente pour validation !');
      setTimeout(() => setMessage(''), 3000);
      
      // Load next translation and update stats
      await updateStats();
      await loadRandomTranslation();
    } catch (error) {
      console.error('Error correcting translation:', error);
    }
  };
  
  // Export validated translations
  const handleExport = async () => {
    try {
      const csvContent = await exportValidatedTranslationsToCSV();
      
      // Create a blob and download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `validated_translations_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setMessage('Traductions validées exportées avec succès !');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error exporting translations:', error);
    }
  };
  
  // Load initial data
  useEffect(() => {
    const initialize = async () => {
      await updateStats();
      await loadRandomTranslation();
    };
    
    initialize();
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Validateur de Traductions</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">Connecté en tant que: <span className="font-semibold">{username}</span></span>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-grow max-w-5xl mx-auto w-full px-4 py-8">
        {/* Stats bar */}
        <div className="bg-white rounded-lg shadow mb-8 p-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{stats.pending}</div>
              <div className="text-sm text-gray-500">En attente</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{stats.validated}</div>
              <div className="text-sm text-gray-500">Validées</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">{stats.corrected}</div>
              <div className="text-sm text-gray-500">Corrigées</div>
            </div>
          </div>
        </div>
        
        {/* Messages */}
        {message && (
          <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded mb-6">
            {message}
          </div>
        )}
        
        {/* Translation section */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : !currentTranslation ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-medium text-gray-700 mb-4">Aucune traduction en attente disponible !</h2>
            <p className="text-gray-500 mb-6">
              Toutes les traductions ont été examinées. Vous pouvez exporter les traductions validées.
            </p>
            <button
              onClick={handleExport}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Exporter les traductions validées
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Français</label>
              <div className="p-4 bg-gray-50 rounded-md text-lg">{currentTranslation.french}</div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Traduction Wolof</label>
              <textarea
                value={editedTranslation}
                onChange={(e) => setEditedTranslation(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                rows="3"
              />
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={handleValidate}
                disabled={!currentTranslation}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Valider
              </button>
              <button
                onClick={handleCorrect}
                disabled={!currentTranslation || editedTranslation === currentTranslation.wolof}
                className={`flex-1 py-2.5 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                  editedTranslation !== currentTranslation.wolof
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Corriger & Sauvegarder
              </button>
              <button
                onClick={loadRandomTranslation}
                className="flex-1 py-2.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
        
        {/* Export button */}
        <div className="mt-8 text-center">
          <button
            onClick={handleExport}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Exporter les traductions validées
          </button>
        </div>
      </main>
    </div>
  );
}

export default TranslationValidator;