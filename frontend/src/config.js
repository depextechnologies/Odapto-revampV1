// Central configuration for API URLs
// This ensures the app works in development, production, and mobile builds
//
// For production deployment to odapto.com:
//   Set REACT_APP_BACKEND_URL=https://odapto.com in frontend/.env
//
// For mobile builds (Capacitor):
//   The fallback URL below is used when REACT_APP_BACKEND_URL is not available
//   Update PRODUCTION_URL before building the APK/IPA

const PRODUCTION_URL = 'https://odapto.com';

export const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || PRODUCTION_URL;
export const API = `${API_BASE_URL}/api`;

// WebSocket URL (converts https to wss)
export const getWebSocketUrl = (path) => {
  const wsBase = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  return `${wsBase}${path}`;
};

export default {
  API_BASE_URL,
  API,
  getWebSocketUrl
};
