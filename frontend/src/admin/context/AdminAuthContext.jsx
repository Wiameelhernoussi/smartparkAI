import React, { createContext, useContext, useState, useEffect } from 'react';

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  useEffect(() => {
    if (token) {
      localStorage.setItem('admin_token', token);
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem('admin_token');
      setIsAuthenticated(false);
    }
  }, [token]);

  const login = (newToken) => {
    setToken(newToken);
  };

  const logout = () => {
    setToken(null);
  };

  const adminFetch = async (url, options = {}) => {
    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    };

    const response = await fetch(url, authOptions);
    if (response.status === 401) {
      logout();
      window.location.href = '/admin/login';
      return null;
    }
    return response;
  };

  return (
    <AdminAuthContext.Provider value={{ token, login, logout, isAuthenticated, adminFetch }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
