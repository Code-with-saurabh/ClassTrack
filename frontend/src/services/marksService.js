import API from './api';

export const createMarks = (data) => API.post('/marks', data);
export const getStudentMarks = (id) => API.get(`/marks/student/${id}`);
export const updateMarks = (id, data) => API.put(`/marks/${id}`, data);
export const getMarksBySubject = (params) => API.get('/marks', { params });
