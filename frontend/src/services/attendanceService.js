import API from './api';

export const submitAttendance = (data) => API.post('/attendance', data);
export const getStudentAttendance = (id, params) => API.get(`/attendance/student/${id}`, { params });
export const getSubjectAttendance = (params) => API.get('/attendance/subject', { params });
export const getAttendanceAnalytics = (params) => API.get('/attendance/analytics', { params });
export const getClassReport = (params) => API.get('/attendance/class-report', { params });
export const getAttendanceByDate = (params) => API.get('/attendance/by-date', { params });
export const getFacultyLectures = (date) => API.get('/attendance/lectures', { params: { date } });
export const getLectureStudents = (timetableId, date) => API.get(`/attendance/lecture/${timetableId}/students`, { params: { date } });
