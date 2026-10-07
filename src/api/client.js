import axios from 'axios';

// Base URL for FastAPI backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the JWT token to headers
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('labtrack_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors like 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // FIX: Handle both 401 (unauthenticated) and 403 (forbidden/token expired)
    // FastAPI's OAuth2PasswordBearer can return either depending on the error type.
    // Only treat 403 as a session expiry if there is NO active token in storage
    // (to avoid logging out on valid permission-denied responses like "Not your lab")
    if (status === 401) {
      localStorage.removeItem('labtrack_access_token');
      window.dispatchEvent(new Event('unauthorized'));
    } else if (status === 403 && !localStorage.getItem('labtrack_access_token')) {
      // 403 with no stored token = unauthenticated, redirect to login
      window.dispatchEvent(new Event('unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
