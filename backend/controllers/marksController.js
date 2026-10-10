const Marks = require('../models/Marks');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Notification = require('../models/Notification');
const asyncHandler = require('../middleware/asyncHandler');
const { sendData, sendCreated, sendError } = require('../utils/response');

const isAssignedSubject = (faculty, subjectId) => {
  return faculty.assignedSubjects.some((id) => id.toString() === String(subjectId));
};

const notifyStudentMarks = async (student, subjectId, examType, marksObtained, maximumMarks) => {
  if (!student.userId) return;

  const subjectDoc = await Subject.findById(subjectId).select('name code').lean();

  await Notification.create({
    user: student.userId,
    title: `Marks uploaded · ${subjectDoc?.name || 'Subject'}`,
    body: `${subjectDoc?.code || ''} ${examType} — you scored ${marksObtained}/${maximumMarks}.`,
    type: 'info',
    link: '/student/marks',
  }).catch((error) => console.error('Notify marks failed:', error.message));
};

exports.createMarks = async (req, res) => {
  try {
    const { studentId, subjectId, examType, marksObtained, maximumMarks, academicYear, semester } = req.body;

    if (!studentId || !subjectId || !examType || marksObtained === undefined || !maximumMarks) {
      return sendError(res, 400, 'All fields are required');
    }

    const marksValue = Number(marksObtained);
    if (Number.isNaN(marksValue) || marksValue < 0 || marksValue > Number(maximumMarks)) {
      return sendError(res, 400, 'Invalid marks value');
    }

    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return sendError(res, 404, 'Faculty profile not found');
    }

    if (!isAssignedSubject(faculty, subjectId)) {
      return sendError(res, 403, 'Not authorized for this subject');
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return sendError(res, 404, 'Student not found');
    }

    const finalSemester = semester || student.semester;
    const finalAcademicYear = academicYear || student.academicYear;

    const existing = await Marks.findOne({
      student: studentId,
      subject: subjectId,
      examType,
      academicYear: finalAcademicYear
    });

    let savedMarks;
    let message;

    if (existing) {
      existing.marksObtained = marksObtained;
      existing.maximumMarks = maximumMarks;
      savedMarks = await existing.save();
      message = 'Marks updated';
    } else {
      savedMarks = await Marks.create({
        student: studentId,
        subject: subjectId,
        examType,
        marksObtained,
        maximumMarks,
        academicYear: finalAcademicYear,
        semester: finalSemester
      });
      message = 'Marks created';
    }

    await notifyStudentMarks(student, subjectId, examType, marksObtained, maximumMarks);

    if (existing) {
      return sendData(res, savedMarks, message);
    }
    return sendCreated(res, message, savedMarks);
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'Marks already exist for this student, subject, and exam type');
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getStudentMarks = asyncHandler(async (req, res) => {
  const studentId = req.params.id;

  let student;
  if (req.user.role === 'student') {
    student = await Student.findOne({ userId: req.user._id });
  } else {
    student = await Student.findById(studentId);
  }

  if (!student) {
    return sendError(res, 404, 'Student not found');
  }

  const marks = await Marks.find({ student: studentId })
    .populate('subject', 'name code')
    .sort({ subject: 1, examType: 1 });

  return sendData(res, marks);
});

exports.updateMarks = asyncHandler(async (req, res) => {
  const { marksObtained, maximumMarks } = req.body;

  if (marksObtained === undefined || !maximumMarks) {
    return sendError(res, 400, 'Marks and maximum marks are required');
  }

  if (marksObtained < 0 || marksObtained > maximumMarks) {
    return sendError(res, 400, 'Invalid marks value');
  }

  const marks = await Marks.findById(req.params.id);
  if (!marks) {
    return sendError(res, 404, 'Marks not found');
  }

  const faculty = await Faculty.findOne({ userId: req.user._id });
  if (!faculty) {
    return sendError(res, 404, 'Faculty profile not found');
  }

  if (!isAssignedSubject(faculty, marks.subject)) {
    return sendError(res, 403, 'Not authorized to update these marks');
  }

  marks.marksObtained = marksObtained;
  marks.maximumMarks = maximumMarks;
  await marks.save();

  return sendData(res, marks, 'Marks updated');
});

exports.getMarksBySubject = asyncHandler(async (req, res) => {
  const { subjectId, examType } = req.query;

  const filter = {};
  if (subjectId) filter.subject = subjectId;
  if (examType) filter.examType = examType;

  if (req.user.role === 'faculty') {
    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return sendError(res, 404, 'Faculty profile not found');
    }
    const assigned = subjectId && isAssignedSubject(faculty, subjectId);
    if (!assigned) {
      return sendError(res, 403, 'Not authorized for this subject');
    }
  }

  const marks = await Marks.find(filter)
    .populate('student', 'rollNumber')
    .populate({ path: 'student', populate: { path: 'userId', select: 'name' } })
    .populate('subject', 'name code');

  return sendData(res, marks);
});
