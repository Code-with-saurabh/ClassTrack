const express = require('express');
const router = express.Router();
const {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getOwnProfile
} = require('../controllers/studentController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.get('/profile', authenticate, authorize('student'), getOwnProfile);
router.get('/', authenticate, authorize('admin'), getAllStudents);
router.get('/:id', authenticate, authorize('admin', 'faculty'), getStudentById);
router.post('/', authenticate, authorize('admin'), createStudent);
router.put('/:id', authenticate, authorize('admin'), updateStudent);
router.delete('/:id', authenticate, authorize('admin'), deleteStudent);

module.exports = router;
