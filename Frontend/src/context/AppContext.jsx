import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCurrentUser, saveCurrentUser, clearCurrentUser } from '../utils/session';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [theme, setTheme] = useState(localStorage.getItem('vrms-theme') || 'dark');

  // Restore session on mount (runs once)
  useEffect(() => {
    const user = getCurrentUser();
    if (user) setCurrentUser(user);
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('vrms-theme', newTheme);
  }, [theme]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  }, []);

  const login = useCallback((user) => {
    saveCurrentUser(user);
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    clearCurrentUser();
    setCurrentUser(null);
  }, []);

  const updateUser = useCallback((updatedData) => {
    setCurrentUser(prev => {
      const newUser = { ...prev, ...updatedData };
      saveCurrentUser(newUser);
      return newUser;
    });
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <AppContext.Provider value={{ currentUser, login, logout, updateUser, showToast, toast, refreshKey, refresh, theme, toggleTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
