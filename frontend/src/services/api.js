import axios from 'axios';
import toast from 'react-hot-toast';
import { env } from '../config/env';

const API = axios.create({
  baseURL: env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isLoginRequest = url.includes('/auth/login');
    const serverMessage = error.response?.data?.message;

    if (error.response?.status === 401 && !isLoginRequest) {
      toast.error('Session expired. Please login again.', { id: 'session-expired' });
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    if (error.response?.status === 403) {
      toast.error(serverMessage || 'You do not have permission to do that.', { id: 'forbidden' });
    }
    if (error.response?.status === 409) {
      toast.error(serverMessage || 'Duplicate entry detected.', { id: 'duplicate' });
    }
    if (error.response?.status === 400 && !isLoginRequest) {
      toast.error(serverMessage || 'Invalid request.', { id: 'bad-request' });
    }
    if (!error.response) {
      toast.error('Network error. Please check your connection.', { id: 'network-error' });
    }
    return Promise.reject(error);
  }
);

export default API;
