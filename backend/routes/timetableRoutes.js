const express = require('express');
const router = express.Router();
const {
  getAllTimetable,
  getTodayTimetable,
  createTimetable,
  updateTimetable,
  deleteTimetable
} = require('../controllers/timetableController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.get('/today', authenticate, getTodayTimetable);
router.get('/', authenticate, getAllTimetable);
router.post('/', authenticate, authorize('admin'), createTimetable);
router.put('/:id', authenticate, authorize('admin'), updateTimetable);
router.delete('/:id', authenticate, authorize('admin'), deleteTimetable);

module.exports = router;
