import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { API } from '../config';

const AuthContext = createContext(null);

// Helper to get stored token from localStorage
const getStoredToken = () => localStorage.getItem('odapto_session_token');
const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem('odapto_session_token', token);
  }
};
const clearStoredToken = () => localStorage.removeItem('odapto_session_token');

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Safe JSON parse from a fetch response — reads body exactly once
const safeJson = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(() => getStoredToken());

  // Update token state and storage together
  const updateToken = useCallback((token) => {
    setSessionToken(token);
    if (token) {
      setStoredToken(token);
    } else {
      clearStoredToken();
    }
  }, []);

  const getAuthHeaders = useCallback(() => {
    const token = sessionToken || getStoredToken();
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }, [sessionToken]);

  const checkAuth = useCallback(async () => {
    const token = sessionToken || getStoredToken();
    
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await safeJson(response);
        if (data) {
          setUser(data);
        } else {
          setUser(null);
          updateToken(null);
        }
      } else {
        setUser(null);
        updateToken(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      updateToken(null);
    } finally {
      setLoading(false);
    }
  }, [sessionToken, updateToken]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await safeJson(response);
    
    if (!response.ok) {
      throw new Error(data?.detail || 'Login failed');
    }
    
    if (!data) {
      throw new Error('Server error. Please try again.');
    }
    
    if (data.session_token) {
      updateToken(data.session_token);
    }
    setUser(data);
    return data;
  };

  const register = async (name, email, password) => {
    const response = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    
    const data = await safeJson(response);
    
    if (!response.ok) {
      throw new Error(data?.detail || 'Registration failed');
    }
    
    if (!data) {
      throw new Error('Server error. Please try again.');
    }
    
    if (data.session_token) {
      updateToken(data.session_token);
    }
    setUser(data);
    return data;
  };

  const loginWithGoogle = () => {
    window.location.href = `${API}/auth/google`;
  };

  const processGoogleCallback = async (code) => {
    const redirectUri = window.location.origin + '/auth/google/callback';
    const response = await fetch(`${API}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    });
    
    const data = await safeJson(response);
    
    if (!response.ok) {
      throw new Error(data?.detail || 'Google sign-in failed');
    }
    
    if (!data) {
      throw new Error('Server error. Please try again.');
    }
    
    if (data.session_token) {
      updateToken(data.session_token);
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    const token = sessionToken || getStoredToken();
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    updateToken(null);
  };

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    processGoogleCallback,
    logout,
    checkAuth,
    getAuthHeaders,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isPrivileged: user?.role === 'admin' || user?.role === 'privileged'
  }), [user, loading, checkAuth, getAuthHeaders]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
