const express = require('express');
const router = express.Router();
const {
  getAllSubjects,
  getSubjectById,
  createSubject,
  updateSubject
} = require('../controllers/subjectController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.get('/', authenticate, getAllSubjects);
router.get('/:id', authenticate, getSubjectById);
router.post('/', authenticate, authorize('admin'), createSubject);
router.put('/:id', authenticate, authorize('admin'), updateSubject);

module.exports = router;
