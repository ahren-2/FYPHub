import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/',
});

// Request interceptor: automatically inject the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle an expired token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // A 401 (Unauthorized) from the backend means the token is dead, so force a logout
      localStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;