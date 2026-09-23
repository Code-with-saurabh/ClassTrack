import API from './api';

export const getAllStudents = (params) => API.get('/students', { params });
export const getStudentById = (id) => API.get(`/students/${id}`);
export const createStudent = (data) => API.post('/students', data);
export const updateStudent = (id, data) => API.put(`/students/${id}`, data);
export const deleteStudent = (id) => API.delete(`/students/${id}`);
export const getStudentProfile = () => API.get('/students/profile');
