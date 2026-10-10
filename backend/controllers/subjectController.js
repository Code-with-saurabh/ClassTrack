const Subject = require('../models/Subject');
const asyncHandler = require('../middleware/asyncHandler');
const { sendData, sendCreated, sendError } = require('../utils/response');

const FACULTY_WITH_USER = {
  path: 'faculty',
  populate: { path: 'userId', select: 'name' }
};

exports.getAllSubjects = asyncHandler(async (req, res) => {
  const { semester, department } = req.query;

  const filter = {};
  if (semester) filter.semester = parseInt(semester);
  if (department) filter.department = department;

  const subjects = await Subject.find(filter)
    .populate('faculty', 'employeeId')
    .populate(FACULTY_WITH_USER);

  return sendData(res, subjects);
});

exports.getSubjectById = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id).populate('faculty');

  if (!subject) {
    return sendError(res, 404, 'Subject not found');
  }

  return sendData(res, subject);
});

exports.createSubject = asyncHandler(async (req, res) => {
  const { name, code, semester, department, faculty } = req.body;

  if (!name || !code || !semester || !department) {
    return sendError(res, 400, 'Name, code, semester, and department are required');
  }

  const existingCode = await Subject.findOne({ code });
  if (existingCode) {
    return sendError(res, 409, 'Subject code already exists');
  }

  const subject = await Subject.create({ name, code, semester, department, faculty });

  return sendCreated(res, 'Subject created', subject);
});

exports.updateSubject = asyncHandler(async (req, res) => {
  const { name, code, semester, department, faculty } = req.body;

  if (code) {
    const existingCode = await Subject.findOne({ code, _id: { $ne: req.params.id } });
    if (existingCode) {
      return sendError(res, 409, 'Subject code already exists');
    }
  }

  const subject = await Subject.findByIdAndUpdate(
    req.params.id,
    { name, code, semester, department, faculty },
    { new: true }
  );

  if (!subject) {
    return sendError(res, 404, 'Subject not found');
  }

  return sendData(res, subject, 'Subject updated');
});
