const Timetable = require('../models/Timetable');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const asyncHandler = require('../middleware/asyncHandler');
const { sendData, sendCreated, sendMessage, sendError } = require('../utils/response');

const SUBJECT_FIELDS = 'name code';
const FACULTY_WITH_USER = {
  path: 'faculty',
  populate: { path: 'userId', select: 'name' }
};

// User ki role ke hisaab se timetable filter set karta hai
// (student → apni class ka, faculty → apne lectures, admin → jo bheja hai)
const buildRoleFilter = async (req, filter) => {
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return { error: 'Student profile not found' };
    }
    filter.semester = student.semester;
    filter.department = student.department;
    filter.division = student.division;
  } else if (req.user.role === 'faculty') {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return { error: 'Faculty profile not found' };
    }
    filter.faculty = faculty._id;
  }
  return { filter };
};

exports.getAllTimetable = asyncHandler(async (req, res) => {
  const { semester, department, division, day, subject } = req.query;

  const filter = {};
  if (semester) filter.semester = parseInt(semester);
  if (department) filter.department = department;
  if (division) filter.division = division;
  if (day) filter.day = day;
  if (subject) filter.subject = subject;

  const roleResult = await buildRoleFilter(req, filter);
  if (roleResult.error) {
    return sendError(res, 404, roleResult.error);
  }

  const timetable = await Timetable.find(filter)
    .populate('subject', SUBJECT_FIELDS)
    .populate('faculty')
    .populate(FACULTY_WITH_USER)
    .sort({ day: 1, startTime: 1 });

  return sendData(res, timetable);
});

exports.getTodayTimetable = asyncHandler(async (req, res) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = dayNames[new Date().getDay()];

  const filter = { day: today };

  const roleResult = await buildRoleFilter(req, filter);
  if (roleResult.error) {
    return sendError(res, 404, roleResult.error);
  }

  const timetable = await Timetable.find(filter)
    .populate('subject', SUBJECT_FIELDS)
    .populate('faculty')
    .populate(FACULTY_WITH_USER)
    .sort({ startTime: 1 });

  return sendData(res, timetable);
});

exports.createTimetable = asyncHandler(async (req, res) => {
  const { subject, faculty, division, day, startTime, endTime, room, semester, department } = req.body;

  if (!subject || !faculty || !division || !day || !startTime || !endTime || !room || !semester || !department) {
    return sendError(res, 400, 'All fields are required');
  }

  const timetable = await Timetable.create({
    subject, faculty, division, day, startTime, endTime, room, semester, department
  });

  return sendCreated(res, 'Timetable entry created', timetable);
});

exports.updateTimetable = asyncHandler(async (req, res) => {
  const { subject, faculty, division, day, startTime, endTime, room, semester, department } = req.body;

  const timetable = await Timetable.findByIdAndUpdate(
    req.params.id,
    { subject, faculty, division, day, startTime, endTime, room, semester, department },
    { new: true }
  );

  if (!timetable) {
    return sendError(res, 404, 'Timetable entry not found');
  }

  return sendData(res, timetable, 'Timetable updated');
});

exports.deleteTimetable = asyncHandler(async (req, res) => {
  const timetable = await Timetable.findByIdAndDelete(req.params.id);

  if (!timetable) {
    return sendError(res, 404, 'Timetable entry not found');
  }

  return sendMessage(res, 'Timetable entry deleted');
});
