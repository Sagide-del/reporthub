import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const schoolData = authService.getCurrentSchool();
    if (schoolData) {
      setSchool(schoolData);
    }
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    setSchool(data.school);
    return data;
  };

  const register = async (schoolData) => {
    const data = await authService.register(schoolData);
    setSchool(data.school);
    return data;
  };

  const logout = () => {
    authService.logout();
    setSchool(null);
  };

  return (
    <AuthContext.Provider value={{ school, loading, login, register, logout, isAuthenticated: !!school }}>
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