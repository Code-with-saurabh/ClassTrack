const express = require('express');
const router = express.Router();
const { login, register, getMe } = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.post('/login', login);
router.post('/register', authenticate, authorize('admin'), register);
router.get('/me', authenticate, getMe);

module.exports = router;
