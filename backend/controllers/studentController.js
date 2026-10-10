const Student = require('../models/Student');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');
const { sendData, sendCreated, sendMessage, sendError } = require('../utils/response');

const USER_FIELDS = 'name email status';

const matchesSearch = (student, search) => {
  const regex = new RegExp(search, 'i');
  const rollMatch = student.rollNumber.match(regex);
  const nameMatch = student.userId && student.userId.name.match(regex);
  return rollMatch || nameMatch;
};

exports.getAllStudents = asyncHandler(async (req, res) => {
  const { semester, department, division, search } = req.query;

  const filter = {};
  if (semester) filter.semester = parseInt(semester);
  if (department) filter.department = department;
  if (division) filter.division = division;

  let students = await Student.find(filter).populate('userId', USER_FIELDS);

  if (search) {
    students = students.filter((student) => matchesSearch(student, search));
  }

  return sendData(res, students);
});

exports.getStudentById = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('userId', USER_FIELDS);

  if (!student) {
    return sendError(res, 404, 'Student not found');
  }

  return sendData(res, student);
});

exports.createStudent = asyncHandler(async (req, res) => {
  const { name, email, password, rollNumber, semester, division, department, academicYear } = req.body;

  if (!name || !email || !password || !rollNumber || !semester || !division || !department || !academicYear) {
    return sendError(res, 400, 'All fields are required');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendError(res, 409, 'Email already exists');
  }

  const existingRoll = await Student.findOne({ rollNumber });
  if (existingRoll) {
    return sendError(res, 409, 'Roll number already exists');
  }

  const user = await User.create({ name, email, password, role: 'student' });

  const student = await Student.create({
    userId: user._id,
    rollNumber,
    semester,
    division,
    department,
    academicYear
  });

  return sendCreated(res, 'Student created', student);
});

exports.updateStudent = asyncHandler(async (req, res) => {
  const { name, email, rollNumber, semester, division, department, academicYear, status } = req.body;

  const student = await Student.findById(req.params.id);
  if (!student) {
    return sendError(res, 404, 'Student not found');
  }

  if (rollNumber && rollNumber !== student.rollNumber) {
    const existingRoll = await Student.findOne({ rollNumber });
    if (existingRoll) {
      return sendError(res, 409, 'Roll number already exists');
    }
  }

  if (email) {
    const existingEmail = await User.findOne({ email, _id: { $ne: student.userId } });
    if (existingEmail) {
      return sendError(res, 409, 'Email already exists');
    }
  }

  const userUpdate = {};
  if (name !== undefined) userUpdate.name = name;
  if (email !== undefined) userUpdate.email = email;
  if (status !== undefined) userUpdate.status = status;

  if (Object.keys(userUpdate).length > 0) {
    await User.findByIdAndUpdate(student.userId, userUpdate);
  }

  const studentUpdate = {};
  if (rollNumber !== undefined) studentUpdate.rollNumber = rollNumber;
  if (semester !== undefined) studentUpdate.semester = semester;
  if (division !== undefined) studentUpdate.division = division;
  if (department !== undefined) studentUpdate.department = department;
  if (academicYear !== undefined) studentUpdate.academicYear = academicYear;

  const updatedStudent = await Student.findByIdAndUpdate(req.params.id, studentUpdate, { new: true })
    .populate('userId', USER_FIELDS);

  return sendData(res, updatedStudent, 'Student updated');
});

exports.deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return sendError(res, 404, 'Student not found');
  }

  await User.findByIdAndDelete(student.userId);
  await Student.findByIdAndDelete(req.params.id);

  return sendMessage(res, 'Student deleted');
});

exports.getOwnProfile = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ userId: req.user._id }).populate('userId', 'name email');

  if (!student) {
    return sendError(res, 404, 'Student profile not found');
  }

  return sendData(res, student);
});
