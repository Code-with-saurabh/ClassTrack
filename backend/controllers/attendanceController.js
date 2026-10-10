const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const Notification = require('../models/Notification');
const attendanceService = require('../services/attendanceService');
const asyncHandler = require('../middleware/asyncHandler');
const { normalizeDate, toDateKey, dayNameFromDate } = require('../utils/date');
const { objectId } = require('../utils/mongoid');
const { sendData, sendCreated, sendError } = require('../utils/response');

const DAY_MS = 86400000;
const LOW_ATTENDANCE_THRESHOLD = 75;

const SUBJECT_FIELDS = 'name code';
const FACULTY_WITH_USER = {
  path: 'faculty',
  populate: { path: 'userId', select: 'name' }
};

const getFacultyProfile = async (userId) => {
  return Faculty.findOne({ userId });
};

const isFacultyAssigned = (faculty, subjectId) => {
  return faculty.assignedSubjects.some((id) => id.toString() === String(subjectId));
};

// Agar kisi student ki attendance 75% se neeche hai to usko warning bhejta hai
// (ek baar bhej chuka ho to dobara nahi bhejta)
const notifyLowAttendance = async (classStudents, subjectId) => {
  for (const student of classStudents) {
    const percentage = await attendanceService.calculateAttendancePercentage(student._id, subjectId);
    if (percentage >= LOW_ATTENDANCE_THRESHOLD) continue;
    if (!student.userId) continue;

    const alreadyWarned = await Notification.findOne({
      user: student.userId,
      type: 'warning',
      read: false,
      title: /Low attendance/i,
    }).lean();

    if (alreadyWarned) continue;

    await Notification.create({
      user: student.userId,
      title: 'Low attendance warning',
      body: `Your attendance is ${percentage}%. You need at least ${LOW_ATTENDANCE_THRESHOLD}% to be eligible for exams.`,
      type: 'warning',
      link: '/student',
    });
  }
};

// ---------------------------------------------------------------
// POST /api/attendance — faculty attendance submit karta hai
// ---------------------------------------------------------------
exports.submitAttendance = async (req, res) => {
  try {
    const { subjectId, timetableId, date, records } = req.body;

    if (!subjectId || !timetableId || !date || !Array.isArray(records) || records.length === 0) {
      return sendError(res, 400, 'subjectId, timetableId, date, and a non-empty records array are required');
    }

    const faculty = await getFacultyProfile(req.user._id);
    if (!faculty) {
      return sendError(res, 404, 'Faculty profile not found');
    }

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return sendError(res, 404, 'Timetable entry not found');
    }

    if (timetable.faculty.toString() !== faculty._id.toString()) {
      return sendError(res, 403, 'Not authorized for this lecture');
    }

    if (String(timetable.subject) !== String(subjectId)) {
      return sendError(res, 400, 'Subject does not match this lecture');
    }

    if (!isFacultyAssigned(faculty, subjectId)) {
      return sendError(res, 403, 'Not authorized for this subject');
    }

    const day = normalizeDate(date);
    if (!day) {
      return sendError(res, 400, 'Invalid date');
    }
    if (day.getTime() > Date.now() + DAY_MS) {
      return sendError(res, 400, 'Date cannot be in the future');
    }

    // Is lecture ki class ke saare students
    const classStudents = await Student.find({
      semester: timetable.semester,
      department: timetable.department,
      division: timetable.division,
    })
      .select('_id semester academicYear userId')
      .lean();

    const studentsById = new Map(classStudents.map((s) => [s._id.toString(), s]));

    // Aaj ki date + is lecture ki pehle se mili hui attendance
    const existingRecords = await Attendance.find({ timetable: timetableId, date: day }).lean();
    const existingByStudent = new Map(existingRecords.map((a) => [a.student.toString(), a]));

    const stats = { created: 0, updated: 0, skipped: 0 };
    const outcomes = [];
    const subject = objectId(subjectId);

    for (const record of records) {
      const studentId = record?.studentId;
      const status = record?.status;

      if (!studentId || !['present', 'absent'].includes(status)) {
        stats.skipped += 1;
        continue;
      }

      const classInfo = studentsById.get(String(studentId));
      if (!classInfo) {
        stats.skipped += 1;
        outcomes.push({ studentId, status: 'skipped', message: 'Student is not part of this lecture' });
        continue;
      }

      const existing = existingByStudent.get(String(studentId));
      if (existing) {
        await Attendance.updateOne({ _id: existing._id }, { $set: { status } });
        stats.updated += 1;
      } else {
        await Attendance.create({
          student: classInfo._id,
          subject,
          faculty: faculty._id,
          timetable: timetable._id,
          date: day,
          status,
          academicYear: classInfo.academicYear,
          semester: classInfo.semester,
        });
        stats.created += 1;
      }

      outcomes.push({ studentId, status });
    }

    res.status(201).json({
      success: true,
      message: 'Attendance submitted successfully',
      data: {
        stats,
        outcomes,
        date: toDateKey(day),
        subject: subjectId,
        timetable: timetableId,
      },
    });

    notifyLowAttendance(classStudents, subject).catch((error) =>
      console.error('Notify low attendance failed:', error.message)
    );
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(res, 409, 'Duplicate attendance detected');
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------------------------------------------------------------
// GET /api/attendance/student/:id — student ki apni attendance
// ---------------------------------------------------------------
exports.getStudentAttendance = asyncHandler(async (req, res) => {
  const { subjectId, from, to, page = 1, limit = 100 } = req.query;

  let student;
  if (req.user.role === 'student') {
    student = await Student.findOne({ userId: req.user._id });
  } else {
    const studentObjectId = objectId(req.params.id);
    student = studentObjectId ? await Student.findById(studentObjectId) : null;
  }

  if (!student) {
    return sendError(res, 404, 'Student not found');
  }

  const filter = { student: student._id };

  const subject = objectId(subjectId);
  if (subject) filter.subject = subject;

  if (from) filter.date = { $gte: normalizeDate(from) };
  if (to) filter.date = { ...(filter.date || {}), $lte: normalizeDate(to) };

  const attendance = await Attendance.find(filter)
    .populate('subject', SUBJECT_FIELDS)
    .populate(FACULTY_WITH_USER)
    .populate('timetable', 'day startTime endTime division room')
    .sort({ date: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const percentage = subject
    ? await attendanceService.calculateAttendancePercentage(student._id, subject)
    : await attendanceService.calculateOverallAttendance(student._id);

  const subjectWise = await attendanceService.calculateSubjectWiseAttendance(student._id);

  return sendData(res, {
    student,
    attendance,
    totalRecords: attendance.length,
    percentage,
    subjectWise,
  });
});

// ---------------------------------------------------------------
// GET /api/attendance/subject — class ki raw attendance records
// ---------------------------------------------------------------
exports.getSubjectAttendance = asyncHandler(async (req, res) => {
  const { subjectId, date, semester, division, department, status } = req.query;

  const filter = {};

  const subject = objectId(subjectId);
  if (subject) filter.subject = subject;

  if (req.user.role === 'faculty') {
    const faculty = await getFacultyProfile(req.user._id);
    if (!faculty) {
      return sendError(res, 404, 'Faculty profile not found');
    }
    if (subject && !isFacultyAssigned(faculty, subjectId)) {
      return sendError(res, 403, 'Not authorized for this subject');
    }
    filter.faculty = faculty._id;
  }

  if (date) {
    const day = normalizeDate(date);
    if (!day) {
      return sendError(res, 400, 'Invalid date');
    }
    filter.date = day;
  }

  if (status) filter.status = status;

  const studentFilter = {};
  if (semester) studentFilter.semester = Number(semester);
  if (division) studentFilter.division = division;
  if (department) studentFilter.department = department;

  const students = await Student.find(studentFilter).select('_id');
  const studentIds = students.map((s) => s._id);
  if (studentIds.length > 0) filter.student = { $in: studentIds };

  const attendance = await Attendance.find(filter)
    .populate('student', 'rollNumber')
    .populate({ path: 'student', populate: { path: 'userId', select: 'name' } })
    .populate('subject', SUBJECT_FIELDS)
    .populate(FACULTY_WITH_USER)
    .sort({ date: -1, 'student.rollNumber': 1 });

  return res.json({ success: true, data: attendance, filter });
});

// ---------------------------------------------------------------
// GET /api/attendance/analytics — faculty ke liye analytics
// ---------------------------------------------------------------
exports.getAttendanceAnalytics = asyncHandler(async (req, res) => {
  const { subjectId, filter: filterType = 'all', from, to, date } = req.query;

  const subject = objectId(subjectId);
  if (!subject) {
    return sendError(res, 400, 'subjectId is required');
  }

  const faculty = await getFacultyProfile(req.user._id);
  if (!faculty) {
    return sendError(res, 404, 'Faculty profile not found');
  }
  if (!isFacultyAssigned(faculty, subjectId)) {
    return sendError(res, 403, 'Not authorized for this subject');
  }

  // Date range banao: single date ho to wahi from + to dono
  const dateFilter = {};
  if (date) {
    const singleDate = normalizeDate(date);
    if (!singleDate) {
      return sendError(res, 400, 'Invalid date');
    }
    dateFilter.from = singleDate;
    dateFilter.to = singleDate;
  } else if (from || to) {
    if (from) {
      const fromDate = normalizeDate(from);
      if (!fromDate) {
        return sendError(res, 400, 'Invalid from date');
      }
      dateFilter.from = fromDate;
    }
    if (to) {
      const toDate = normalizeDate(to);
      if (!toDate) {
        return sendError(res, 400, 'Invalid to date');
      }
      dateFilter.to = toDate;
    }
  }

  const rows = await attendanceService.getAttendanceAnalytics(faculty._id, subject, dateFilter);
  const students = attendanceService.applyFilter(rows, filterType);
  const stats = attendanceService.buildStats(rows);
  const dailyTrend = await attendanceService.getDailyTrend(faculty._id, subject, dateFilter);
  const subjectInfo = await Subject.findById(subject).select('name code semester department faculty').lean();

  return sendData(res, { students, stats, dailyTrend, subject: subjectInfo });
});

// ---------------------------------------------------------------
// GET /api/attendance/class-report — threshold wali report + sort
// ---------------------------------------------------------------
exports.getClassReport = asyncHandler(async (req, res) => {
  const { subjectId, min, max, sortBy = 'percentage', order = 'asc' } = req.query;

  const subject = objectId(subjectId);
  if (!subject) {
    return sendError(res, 400, 'subjectId is required');
  }

  let facultyId;
  if (req.user.role === 'faculty') {
    const faculty = await getFacultyProfile(req.user._id);
    if (!faculty) {
      return sendError(res, 404, 'Faculty profile not found');
    }
    if (!isFacultyAssigned(faculty, subjectId)) {
      return sendError(res, 403, 'Not authorized for this subject');
    }
    facultyId = faculty._id;
  } else {
    const subjectDoc = await Subject.findById(subject).lean();
    facultyId = subjectDoc?.faculty || null;
  }

  const rows = await attendanceService.getAttendanceAnalytics(facultyId, subject);
  const filteredStudents = attendanceService.applyThreshold(rows, min, max);

  const direction = order === 'desc' ? -1 : 1;
  const students = [...filteredStudents].sort((a, b) => {
    if (a[sortBy] < b[sortBy]) return -1 * direction;
    if (a[sortBy] > b[sortBy]) return 1 * direction;
    return 0;
  });

  const subjectInfo = await Subject.findById(subject).populate(FACULTY_WITH_USER).lean();
  const stats = attendanceService.buildStats(students);

  return sendData(res, {
    subject: subjectInfo,
    students,
    stats,
    meta: { min, max, order, sortBy, generatedAt: new Date().toISOString() },
  });
});

// ---------------------------------------------------------------
// GET /api/attendance/by-date — daily register (P / A / U)
// ---------------------------------------------------------------
exports.getAttendanceByDate = asyncHandler(async (req, res) => {
  const { date, subjectId, semester, division, department } = req.query;

  const day = normalizeDate(date);
  if (!day) {
    return sendError(res, 400, 'A valid date is required (YYYY-MM-DD)');
  }

  const weekday = dayNameFromDate(day);

  const timetableFilter = { day: weekday };
  const subject = objectId(subjectId);
  if (subject) timetableFilter.subject = subject;
  if (semester) timetableFilter.semester = Number(semester);
  if (division) timetableFilter.division = division;
  if (department) timetableFilter.department = department;

  if (req.user.role === 'faculty') {
    const faculty = await getFacultyProfile(req.user._id);
    if (!faculty) {
      return sendError(res, 404, 'Faculty profile not found');
    }
    timetableFilter.faculty = faculty._id;
  }

  const timetableEntries = await Timetable.find(timetableFilter)
    .populate('subject', SUBJECT_FIELDS)
    .populate(FACULTY_WITH_USER)
    .sort({ startTime: 1 })
    .lean();

  const lectures = [];
  const totals = { present: 0, absent: 0, unmarked: 0 };

  for (const entry of timetableEntries) {
    const classStudents = await Student.find({
      semester: entry.semester,
      department: entry.department,
      division: entry.division,
    })
      .populate('userId', 'name email')
      .sort({ rollNumber: 1 })
      .lean();

    const records = await Attendance.find({ timetable: entry._id, date: day }).lean();
    const statusByStudent = new Map(records.map((r) => [r.student.toString(), r.status]));

    const rows = classStudents.map((s) => ({
      ...s,
      attendance: statusByStudent.get(s._id.toString()) || 'unmarked',
    }));

    const summary = {
      present: rows.filter((r) => r.attendance === 'present').length,
      absent: rows.filter((r) => r.attendance === 'absent').length,
      unmarked: rows.filter((r) => r.attendance === 'unmarked').length,
    };

    totals.present += summary.present;
    totals.absent += summary.absent;
    totals.unmarked += summary.unmarked;

    lectures.push({ ...entry, students: rows, summary });
  }

  return sendData(res, { date: toDateKey(day), weekday, lectures, totals });
});

// ---------------------------------------------------------------
// GET /api/attendance/lectures — aaj ke lectures (attendance taken ya nahi)
// ---------------------------------------------------------------
exports.getFacultyLectures = asyncHandler(async (req, res) => {
  const { date } = req.query;

  const faculty = await getFacultyProfile(req.user._id);
  if (!faculty) {
    return sendError(res, 404, 'Faculty profile not found');
  }

  const targetDay = normalizeDate(date);
  const weekday = dayNameFromDate(targetDay);

  const entries = await Timetable.find({ faculty: faculty._id, day: weekday })
    .populate('subject', SUBJECT_FIELDS)
    .sort({ startTime: 1 })
    .lean();

  const takenIds = await Attendance.distinct('timetable', { faculty: faculty._id, date: targetDay });
  const takenSet = new Set(takenIds.map((id) => id.toString()));

  const lectures = entries.map((entry) => ({
    ...entry,
    attendanceTaken: takenSet.has(entry._id.toString()),
  }));

  return sendData(res, { lectures, date: toDateKey(targetDay), weekday });
});

// ---------------------------------------------------------------
// GET /api/attendance/lecture/:timetableId/students — ek lecture ka roster
// ---------------------------------------------------------------
exports.getLectureStudents = asyncHandler(async (req, res) => {
  const { timetableId } = req.params;
  const { date } = req.query;

  const faculty = await getFacultyProfile(req.user._id);
  if (!faculty) {
    return sendError(res, 404, 'Faculty profile not found');
  }

  const timetable = await Timetable.findById(timetableId)
    .populate('subject', SUBJECT_FIELDS)
    .populate(FACULTY_WITH_USER)
    .lean();

  if (!timetable) {
    return sendError(res, 404, 'Lecture not found');
  }

  if (timetable.faculty._id.toString() !== faculty._id.toString()) {
    return sendError(res, 403, 'Not authorized for this lecture');
  }

  const students = await Student.find({
    semester: timetable.semester,
    department: timetable.department,
    division: timetable.division,
  })
    .populate('userId', 'name email')
    .sort({ rollNumber: 1 })
    .lean();

  let statusByStudent = new Map();
  let recordDate = null;

  if (date) {
    const day = normalizeDate(date);
    if (day) {
      recordDate = toDateKey(day);
      const records = await Attendance.find({ timetable: timetableId, date: day }).lean();
      statusByStudent = new Map(records.map((r) => [r.student.toString(), r.status]));
    }
  }

  const rows = students.map((student) => ({
    ...student,
    status: statusByStudent.get(student._id.toString()) || '',
  }));

  const markedCount = Array.from(statusByStudent.values()).filter(Boolean).length;

  return sendData(res, {
    lecture: timetable,
    date: recordDate,
    students: rows,
    markedCount,
  });
});
