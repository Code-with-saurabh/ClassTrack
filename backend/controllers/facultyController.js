const Faculty = require('../models/Faculty');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { sendData, sendCreated, sendError } = require('../utils/response');

const USER_FIELDS = 'name email status';
const SUBJECT_FIELDS_LIST = 'name code';
const SUBJECT_FIELDS_DETAIL = 'name code semester';

const matchesSearch = (faculty, search) => {
  const regex = new RegExp(search, 'i');
  const idMatch = faculty.employeeId.match(regex);
  const nameMatch = faculty.userId && faculty.userId.name.match(regex);
  return idMatch || nameMatch;
};

exports.getAllFaculty = asyncHandler(async (req, res) => {
  const { department, search } = req.query;

  const filter = {};
  if (department) filter.department = department;

  let facultyList = await Faculty.find(filter)
    .populate('userId', USER_FIELDS)
    .populate('assignedSubjects', SUBJECT_FIELDS_LIST);

  if (search) {
    facultyList = facultyList.filter((faculty) => matchesSearch(faculty, search));
  }

  return sendData(res, facultyList);
});

exports.getFacultyById = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id)
    .populate('userId', USER_FIELDS)
    .populate('assignedSubjects', SUBJECT_FIELDS_DETAIL);

  if (!faculty) {
    return sendError(res, 404, 'Faculty not found');
  }

  return sendData(res, faculty);
});

exports.createFaculty = asyncHandler(async (req, res) => {
  const { name, email, password, employeeId, department, assignedSubjects } = req.body;

  if (!name || !email || !password || !employeeId || !department) {
    return sendError(res, 400, 'All fields are required');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendError(res, 409, 'Email already exists');
  }

  const existingEmployee = await Faculty.findOne({ employeeId });
  if (existingEmployee) {
    return sendError(res, 409, 'Employee ID already exists');
  }

  const user = await User.create({ name, email, password, role: 'faculty' });

  const faculty = await Faculty.create({
    userId: user._id,
    employeeId,
    department,
    assignedSubjects: assignedSubjects || []
  });

  return sendCreated(res, 'Faculty created', faculty);
});

exports.updateFaculty = asyncHandler(async (req, res) => {
  const { name, email, department, assignedSubjects, status } = req.body;

  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) {
    return sendError(res, 404, 'Faculty not found');
  }

  if (email) {
    const existingEmail = await User.findOne({ email, _id: { $ne: faculty.userId } });
    if (existingEmail) {
      return sendError(res, 409, 'Email already exists');
    }
  }

  const userUpdate = {};
  if (name !== undefined) userUpdate.name = name;
  if (email !== undefined) userUpdate.email = email;
  if (status !== undefined) userUpdate.status = status;

  if (Object.keys(userUpdate).length > 0) {
    await User.findByIdAndUpdate(faculty.userId, userUpdate);
  }

  const facultyUpdate = {};
  if (department !== undefined) facultyUpdate.department = department;
  if (assignedSubjects !== undefined) facultyUpdate.assignedSubjects = assignedSubjects;

  const updatedFaculty = await Faculty.findByIdAndUpdate(req.params.id, facultyUpdate, { new: true })
    .populate('userId', USER_FIELDS)
    .populate('assignedSubjects', SUBJECT_FIELDS_LIST);

  return sendData(res, updatedFaculty, 'Faculty updated');
});

exports.getFacultySubjects = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findOne({ userId: req.user._id }).populate('assignedSubjects');

  if (!faculty) {
    return sendError(res, 404, 'Faculty profile not found');
  }

  return sendData(res, faculty.assignedSubjects);
});
