import { useState } from 'react';
import DataInitializer from './components/DataInitializer';
import Login from './components/Login';
import TranslationValidator from './components/TranslationValidator';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const handleInitialized = () => {
    setIsInitialized(true);
  };
  
  const handleLogin = (username) => {
    setCurrentUser(username);
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
  };
  
  // Show initializer until database is ready
  if (!isInitialized) {
    return <DataInitializer onInitialized={handleInitialized} />;
  }
  
  // If not logged in, show login screen
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }
  
  // User is logged in and data is initialized
  return <TranslationValidator username={currentUser} onLogout={handleLogout} />;
}

export default App;
