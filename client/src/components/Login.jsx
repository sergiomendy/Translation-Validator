import { useState, useEffect } from 'react';
import { initializeUsers, getUsers } from '../utils/db-bridge';

function Login({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadUsers = async () => {
      try {
        await initializeUsers();
        const userList = await getUsers();
        setUsers(userList);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading users:', error);
        setIsLoading(false);
      }
    };
    
    loadUsers();
  }, []);
  
  const handleLogin = (e) => {
    e.preventDefault();
    if (selectedUser) {
      onLogin(selectedUser);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-6 text-blue-700">Validateur de Traductions</h1>
        <h2 className="text-xl text-center mb-6 text-gray-600">Français vers Wolof</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="user" className="block text-sm font-medium text-gray-700 mb-1">
              Sélectionnez votre nom
            </label>
            <select
              id="user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Sélectionnez un utilisateur --</option>
              {users.map((user) => (
                <option key={user.id} value={user.name}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          
          <button
            type="submit"
            disabled={!selectedUser}
            className={`w-full py-2 px-4 rounded-md font-medium ${
              !selectedUser 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
          >
            Connexion
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;