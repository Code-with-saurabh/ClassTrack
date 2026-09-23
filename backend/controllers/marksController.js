const Marks = require('../models/Marks');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Notification = require('../models/Notification');

exports.createMarks = async (req, res) => {
  try {
    const { studentId, subjectId, examType, marksObtained, maximumMarks, academicYear, semester } = req.body;

    if (!studentId || !subjectId || !examType || marksObtained === undefined || !maximumMarks) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (Number.isNaN(Number(marksObtained)) || Number(marksObtained) < 0 || Number(marksObtained) > Number(maximumMarks)) {
      return res.status(400).json({ success: false, message: 'Invalid marks value' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const isAssigned = faculty.assignedSubjects.some((s) => s.toString() === String(subjectId));
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const finalSemester = semester || student.semester;
    const finalAcademicYear = academicYear || student.academicYear;

    const existing = await Marks.findOne({
      student: studentId,
      subject: subjectId,
      examType,
      academicYear: finalAcademicYear
    });

    if (existing) {
      existing.marksObtained = marksObtained;
      existing.maximumMarks = maximumMarks;
      await existing.save();
      res.json({ success: true, message: 'Marks updated', data: existing });
    } else {
      const marks = await Marks.create({
        student: studentId,
        subject: subjectId,
        examType,
        marksObtained,
        maximumMarks,
        academicYear: finalAcademicYear,
        semester: finalSemester
      });
      res.status(201).json({ success: true, message: 'Marks created', data: marks });
    }

    if (student.userId) {
      const subjectDoc = await Subject.findById(subjectId).select('name code').lean();
      await Notification.create({
        user: student.userId,
        title: `Marks uploaded · ${subjectDoc?.name || 'Subject'}`,
        body: `${subjectDoc?.code || ''} ${examType} — you scored ${marksObtained}/${maximumMarks}.`,
        type: 'info',
        link: '/student/marks',
      }).catch((e) => console.error('Notify marks failed:', e.message));
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Marks already exist for this student, subject, and exam type' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getStudentMarks = async (req, res) => {
  try {
    const studentId = req.params.id;

    let student;
    if (req.user.role === 'student') {
      student = await Student.findOne({ userId: req.user._id });
    } else {
      student = await Student.findById(studentId);
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const marks = await Marks.find({ student: studentId })
      .populate('subject', 'name code')
      .sort({ subject: 1, examType: 1 });

    res.json({ success: true, data: marks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateMarks = async (req, res) => {
  try {
    const { marksObtained, maximumMarks } = req.body;

    if (marksObtained === undefined || !maximumMarks) {
      return res.status(400).json({ success: false, message: 'Marks and maximum marks are required' });
    }

    if (marksObtained < 0 || marksObtained > maximumMarks) {
      return res.status(400).json({ success: false, message: 'Invalid marks value' });
    }

    const marks = await Marks.findById(req.params.id);
    if (!marks) {
      return res.status(404).json({ success: false, message: 'Marks not found' });
    }

    const faculty = await Faculty.findOne({ userId: req.user._id });
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const isAssigned = faculty.assignedSubjects.some((s) => s.toString() === marks.subject.toString());
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'Not authorized to update these marks' });
    }

    marks.marksObtained = marksObtained;
    marks.maximumMarks = maximumMarks;
    await marks.save();

    res.json({ success: true, message: 'Marks updated', data: marks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMarksBySubject = async (req, res) => {
  try {
    const { subjectId, examType } = req.query;
    const filter = {};
    if (subjectId) filter.subject = subjectId;
    if (examType) filter.examType = examType;

    if (req.user.role === 'faculty') {
      const faculty = await Faculty.findOne({ userId: req.user._id });
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found' });
      }
      if (!subjectId || !faculty.assignedSubjects.some((s) => s.toString() === String(subjectId))) {
        return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
      }
    }

    const marks = await Marks.find(filter)
      .populate('student', 'rollNumber')
      .populate({ path: 'student', populate: { path: 'userId', select: 'name' } })
      .populate('subject', 'name code');

    res.json({ success: true, data: marks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
