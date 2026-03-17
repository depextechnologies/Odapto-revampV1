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
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }

    // Get token from state or localStorage
    const token = sessionToken || getStoredToken();
    
    // If no token, user is not authenticated
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
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
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }
    
    const userData = await response.json();
    // Store session token for persistence
    if (userData.session_token) {
      updateToken(userData.session_token);
    }
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password) => {
    const response = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }
    
    const userData = await response.json();
    // Store session token for persistence
    if (userData.session_token) {
      updateToken(userData.session_token);
    }
    setUser(userData);
    return userData;
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const loginWithGoogle = () => {
    // Redirect to our own backend which initiates the Google OAuth flow
    window.location.href = `${API}/auth/google`;
  };

  const processGoogleCallback = async (code) => {
    const redirectUri = window.location.origin + '/auth/google/callback';
    const response = await fetch(`${API}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    });
    
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Google sign-in failed');
    }
    
    const userData = await response.json();
    if (userData.session_token) {
      updateToken(userData.session_token);
    }
    setUser(userData);
    return userData;
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
