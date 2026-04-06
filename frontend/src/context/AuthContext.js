import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { API, API_BASE_URL } from '../config';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

const AuthContext = createContext(null);

const TOKEN_KEY = 'odapto_session_token';
const REMEMBER_KEY = 'odapto_remember';

const getStoredToken = () =>
  localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

const setStoredToken = (token, remember = true) => {
  if (token) {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_KEY, 'true');
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }
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

  const updateToken = useCallback((token, remember = true) => {
    setSessionToken(token);
    setStoredToken(token, remember);
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

  const login = async (email, password, remember = true) => {
    const response = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const errorMsg = response.headers.get('X-Error-Detail')
        || (response.status === 401 ? 'Your username or password is wrong, please try again' : 'Login failed. Please try again.');
      throw new Error(errorMsg);
    }
    let data;
    try { const c = response.clone(); data = await c.json(); } catch { data = null; }
    if (!data) throw new Error('Server error. Please try again.');
    updateToken(data.session_token, remember);
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
      const errorMsg = response.headers.get('X-Error-Detail')
        || (response.status === 400 ? 'This email ID already exists, please try any other email' : 'Registration failed. Please try again.');
      throw new Error(errorMsg);
    }
    let data;
    try { const c = response.clone(); data = await c.json(); } catch { data = null; }
    if (!data) throw new Error('Server error. Please try again.');
    updateToken(data.session_token);
    setUser(data);
    return data;
  };

  const loginWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      // Mobile: open OAuth in in-app browser with production redirect URI
      const redirectUri = encodeURIComponent(`${API_BASE_URL}/auth/google/callback`);
      const oauthUrl = `${API}/auth/google?mobile=true&redirect_uri=${redirectUri}`;
      await Browser.open({ url: oauthUrl, presentationStyle: 'popover' });
    } else {
      // Web: standard redirect flow
      window.location.href = `${API}/auth/google`;
    }
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
    updateToken(null, false);
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
