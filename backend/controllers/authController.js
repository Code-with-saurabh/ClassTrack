const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const asyncHandler = require('../middleware/asyncHandler');
const { sendData, sendCreated, sendError } = require('../utils/response');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

const loadProfileByRole = async (user) => {
  if (user.role === 'student') {
    return Student.findOne({ userId: user._id });
  }
  if (user.role === 'faculty') {
    return Faculty.findOne({ userId: user._id }).populate('assignedSubjects');
  }
  return null;
};

const buildUserPayload = async (user) => {
  const profile = await loadProfileByRole(user);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profile
  };
};

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 400, 'Email and password are required');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return sendError(res, 401, 'Invalid credentials');
  }

  if (user.status !== 'active') {
    return sendError(res, 401, 'Account is inactive');
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    return sendError(res, 401, 'Invalid credentials');
  }

  const token = generateToken(user._id);
  const userPayload = await buildUserPayload(user);

  return sendData(res, { token, user: userPayload }, 'Login successful');
});

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return sendError(res, 400, 'All fields are required');
  }

  if (!['admin', 'faculty', 'student'].includes(role)) {
    return sendError(res, 400, 'Invalid role');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendError(res, 409, 'Email already exists');
  }

  const user = await User.create({ name, email, password, role });
  const token = generateToken(user._id);

  return sendCreated(res, 'Registration successful', {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role }
  });
});

exports.getMe = asyncHandler(async (req, res) => {
  const userPayload = await buildUserPayload(req.user);
  return sendData(res, { user: userPayload });
});
