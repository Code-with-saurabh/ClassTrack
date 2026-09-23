import API from './api';

export const getAllFaculty = (params) => API.get('/faculty', { params });
export const getFacultyById = (id) => API.get(`/faculty/${id}`);
export const createFaculty = (data) => API.post('/faculty', data);
export const updateFaculty = (id, data) => API.put(`/faculty/${id}`, data);
export const getFacultySubjects = () => API.get('/faculty/subjects');
