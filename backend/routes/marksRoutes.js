const express = require('express');
const router = express.Router();
const {
  createMarks,
  getStudentMarks,
  updateMarks,
  getMarksBySubject
} = require('../controllers/marksController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.post('/', authenticate, authorize('faculty'), createMarks);
router.get('/student/:id', authenticate, getStudentMarks);
router.put('/:id', authenticate, authorize('faculty'), updateMarks);
router.get('/', authenticate, authorize('faculty', 'admin'), getMarksBySubject);

module.exports = router;
