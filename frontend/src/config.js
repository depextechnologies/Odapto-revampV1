// Central configuration for API URLs
// Ensures the app works in development (preview), production (odapto.com), and mobile (Capacitor)

const PRODUCTION_DOMAIN = 'odapto.com';
const PRODUCTION_URL = `https://${PRODUCTION_DOMAIN}`;

// Detect if running on production domain
const isProduction = typeof window !== 'undefined' && window.location.hostname === PRODUCTION_DOMAIN;

// On production (odapto.com): always use odapto.com backend
// On preview/dev: use the env var (preview URL)
// On mobile (Capacitor): env var is undefined, falls back to production URL
export const API_BASE_URL = isProduction
  ? PRODUCTION_URL
  : (process.env.REACT_APP_BACKEND_URL || PRODUCTION_URL);

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
