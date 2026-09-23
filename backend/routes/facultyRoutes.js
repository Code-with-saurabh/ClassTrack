const express = require('express');
const router = express.Router();
const {
  getAllFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  getFacultySubjects
} = require('../controllers/facultyController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.get('/subjects', authenticate, authorize('faculty'), getFacultySubjects);
router.get('/', authenticate, authorize('admin'), getAllFaculty);
router.get('/:id', authenticate, getFacultyById);
router.post('/', authenticate, authorize('admin'), createFaculty);
router.put('/:id', authenticate, authorize('admin'), updateFaculty);

module.exports = router;
