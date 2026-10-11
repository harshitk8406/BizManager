import axios from 'axios';

// In Electron the frontend is loaded via file:// so we use the local Express server.
// In a browser (Render deployment) we use a relative URL so both are served from the same domain.
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return 'http://localhost:5000/api'; // Electron desktop app
  }
  return '/api'; // Browser / Render deployment (same domain)
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const firmId = localStorage.getItem('activeFirmId');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (firmId) {
    config.headers['X-Firm-Id'] = firmId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;
