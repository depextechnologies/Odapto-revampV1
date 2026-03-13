// Central configuration for API URLs
// This ensures the app works both in development and production (including mobile builds)

const PRODUCTION_URL = 'https://task-board-app-3.preview.emergentagent.com';

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
