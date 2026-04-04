// API utility for making authenticated requests
import { API } from '../config';

const getStoredToken = () =>
  localStorage.getItem('odapto_session_token') || sessionStorage.getItem('odapto_session_token');

export const apiCall = async (endpoint, options = {}) => {
  const token = getStoredToken();
  const headers = new Headers();
  
  // Add existing headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }
  
  // Add auth header if token exists
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Prepare body and content-type
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  
  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };
  
  if (body !== undefined) {
    fetchOptions.body = body;
  }
  
  const response = await fetch(`${API}${endpoint}`, fetchOptions);
  return response;
};

export const apiGet = (endpoint) => apiCall(endpoint, { method: 'GET' });
export const apiPost = (endpoint, body) => apiCall(endpoint, { method: 'POST', body });
export const apiPut = (endpoint, body) => apiCall(endpoint, { method: 'PUT', body });
export const apiPatch = (endpoint, body) => apiCall(endpoint, { method: 'PATCH', body });
export const apiDelete = (endpoint) => apiCall(endpoint, { method: 'DELETE' });

export default { apiCall, apiGet, apiPost, apiPut, apiPatch, apiDelete };
