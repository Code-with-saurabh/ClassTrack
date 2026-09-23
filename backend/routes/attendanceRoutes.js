const express = require('express');
const router = express.Router();
const {
  submitAttendance,
  getStudentAttendance,
  getSubjectAttendance,
  getAttendanceAnalytics,
  getClassReport,
  getAttendanceByDate,
  getFacultyLectures,
  getLectureStudents
} = require('../controllers/attendanceController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.post('/', authenticate, authorize('faculty'), submitAttendance);
router.get('/analytics', authenticate, authorize('faculty'), getAttendanceAnalytics);
router.get('/class-report', authenticate, authorize('faculty', 'admin'), getClassReport);
router.get('/by-date', authenticate, authorize('faculty', 'admin'), getAttendanceByDate);
router.get('/lectures', authenticate, authorize('faculty'), getFacultyLectures);
router.get('/lecture/:timetableId/students', authenticate, authorize('faculty'), getLectureStudents);
router.get('/student/:id', authenticate, getStudentAttendance);
router.get('/subject', authenticate, authorize('faculty', 'admin'), getSubjectAttendance);

module.exports = router;
