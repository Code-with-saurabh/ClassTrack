import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getMe } from '../services/authService';

const AuthContext = createContext(null);

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

const readSavedSession = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  const savedUser = localStorage.getItem(USER_KEY);
  if (token && savedUser) {
    return JSON.parse(savedUser);
  }
  return null;
};

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const firstNameOf = (name) => name?.split(' ')[0] || 'User';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Page refresh hone par purana session wapas load karo
  useEffect(() => {
    setUser(readSavedSession());
    setLoading(false);
  }, []);

  const loginUser = (userData) => {
    localStorage.setItem(TOKEN_KEY, userData.token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData.user));
    setUser(userData.user);
    toast.success(`Welcome back, ${firstNameOf(userData.user?.name)}!`, { id: 'welcome-back' });
  };

  const logout = () => {
    clearSession();
    setUser(null);
    toast.success('Logged out successfully.', { id: 'logged-out' });
  };

  // Server se fresh user data la kar state + localStorage update karo
  const refreshUser = async () => {
    try {
      const { data } = await getMe();
      setUser(data.data.user);
      localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
    } catch {
      clearSession();
      setUser(null);
      toast.error('Session expired. Please login again.', { id: 'session-expired' });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
