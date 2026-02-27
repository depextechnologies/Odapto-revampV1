import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

// Helper to get stored token from localStorage
const getStoredToken = () => localStorage.getItem('odapto_session_token');
const setStoredToken = (token) => localStorage.setItem('odapto_session_token', token);
const clearStoredToken = () => localStorage.removeItem('odapto_session_token');

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = useCallback(() => {
    const token = getStoredToken();
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }, []);

  const checkAuth = useCallback(async () => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API}/auth/me`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        setUser(null);
        clearStoredToken();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      clearStoredToken();
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }
    
    const userData = await response.json();
    // Store session token in localStorage for persistence
    if (userData.session_token) {
      setStoredToken(userData.session_token);
    }
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password) => {
    const response = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }
    
    const userData = await response.json();
    // Store session token in localStorage for persistence
    if (userData.session_token) {
      setStoredToken(userData.session_token);
    }
    setUser(userData);
    return userData;
  };

  const loginWithGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const processOAuthCallback = async (sessionId) => {
    const response = await fetch(`${API}/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId })
    });
    
    if (!response.ok) {
      throw new Error('OAuth session processing failed');
    }
    
    const userData = await response.json();
    // Store session token in localStorage for persistence
    if (userData.session_token) {
      setStoredToken(userData.session_token);
    }
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders()
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    clearStoredToken();
  };

  const value = {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    processOAuthCallback,
    logout,
    checkAuth,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isPrivileged: user?.role === 'admin' || user?.role === 'privileged'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
