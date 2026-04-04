import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { API } from '../config';

const AuthContext = createContext(null);

const TOKEN_KEY = 'odapto_session_token';
const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
const setStoredToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// Read response body safely — handles "body already consumed" edge cases
const parseResponse = async (response) => {
  try {
    const cloned = response.clone();
    return await cloned.json();
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(() => getStoredToken());

  const updateToken = useCallback((token) => {
    setSessionToken(token);
    setStoredToken(token);
  }, []);

  const getAuthHeaders = useCallback(() => {
    const token = sessionToken || getStoredToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
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
        const data = await parseResponse(response);
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
    } catch {
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
      const errorMsg = response.headers.get('X-Error-Detail') || 'Your email id or password is incorrect, please try again with correct credentials';
      throw new Error(errorMsg);
    }
    let data;
    try { const c = response.clone(); data = await c.json(); } catch { data = null; }
    if (!data) throw new Error('Server error. Please try again.');
    updateToken(data.session_token);
    setUser(data);
    return data;
  };

  const register = async (name, email, password) => {
    const response = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    if (!response.ok) {
      const errorMsg = response.headers.get('X-Error-Detail') || 'Registration failed. Please try again.';
      throw new Error(errorMsg);
    }
    let data;
    try { const c = response.clone(); data = await c.json(); } catch { data = null; }
    if (!data) throw new Error('Server error. Please try again.');
    updateToken(data.session_token);
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
    if (!response.ok) {
      const errorMsg = response.headers.get('X-Error-Detail') || 'Google sign-in failed';
      throw new Error(errorMsg);
    }
    let data;
    try { const c = response.clone(); data = await c.json(); } catch { data = null; }
    if (!data) throw new Error('Server error. Please try again.');
    updateToken(data.session_token);
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
    } catch {}
    setUser(null);
    updateToken(null);
  };

  const value = useMemo(() => ({
    user, loading,
    login, register, loginWithGoogle, processGoogleCallback, logout,
    checkAuth, getAuthHeaders,
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
