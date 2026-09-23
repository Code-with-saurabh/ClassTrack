import API from './api';

export const getAllTimetable = (params) => API.get('/timetable', { params });
export const getTodayTimetable = () => API.get('/timetable/today');
export const createTimetable = (data) => API.post('/timetable', data);
export const updateTimetable = (id, data) => API.put(`/timetable/${id}`, data);
export const deleteTimetable = (id) => API.delete(`/timetable/${id}`);
