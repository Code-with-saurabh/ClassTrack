import API from './api';

export const login = (credentials) => API.post('/auth/login', credentials);
export const register = (data) => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');
