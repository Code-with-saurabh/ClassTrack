const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const Notification = require('../models/Notification');
const attendanceService = require('../services/attendanceService');
const { normalizeDate, toDateKey, dayNameFromDate } = require('../utils/date');
const { objectId } = require('../utils/mongoid');

const getFacultyProfile = async (userId) => Faculty.findOne({ userId });

const isFacultyAssigned = (faculty, subjectId) =>
  !!faculty.assignedSubjects.some((s) => s.toString() === String(subjectId));

const notifyLowAttendance = async (classStudents, subjectId, threshold = 75) => {
  for (const s of classStudents) {
    const pct = await attendanceService.calculateAttendancePercentage(s._id, subjectId);
    if (pct >= threshold) continue;
    if (!s.userId) continue;
    
    const existing = await Notification.findOne({
      user: s.userId,
      type: 'warning',
      read: false,
      title: /Low attendance/i,
    }).lean();

    if (existing) continue;
    await Notification.create({
      user: s.userId,
      title: 'Low attendance warning',
      body: `Your attendance is ${pct}%. You need at least ${threshold}% to be eligible for exams.`,
      type: 'warning',
      link: '/student',
    });
  }
};

exports.submitAttendance = async (req, res) => {
  try {
    const { subjectId, timetableId, date, records } = req.body;

    if (!subjectId || !timetableId || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'subjectId, timetableId, date, and a non-empty records array are required' });
    }

    const faculty = await getFacultyProfile(req.user._id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    if (timetable.faculty.toString() !== faculty._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this lecture' });
    }

    if (String(timetable.subject) !== String(subjectId)) {
      return res.status(400).json({ success: false, message: 'Subject does not match this lecture' });
    }

    if (!isFacultyAssigned(faculty, subjectId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
    }

    const day = normalizeDate(date);
    if (!day) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }
    if (day.getTime() > Date.now() + 86400000) {
      return res.status(400).json({ success: false, message: 'Date cannot be in the future' });
    }

    const classStudents = await Student.find({
      semester: timetable.semester,
      department: timetable.department,
      division: timetable.division,
    })
      .select('_id semester academicYear userId')
      .lean();
    const classMap = new Map(classStudents.map((s) => [s._id.toString(), s]));

    const existingList = await Attendance.find({ timetable: timetableId, date: day }).lean();
    const existingMap = new Map(existingList.map((a) => [a.student.toString(), a]));

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
      const classInfo = classMap.get(String(studentId));
      if (!classInfo) {
        stats.skipped += 1;
        outcomes.push({ studentId, status: 'skipped', message: 'Student is not part of this lecture' });
        continue;
      }

      const existing = existingMap.get(String(studentId));
      if (existing) {
        await Attendance.updateOne(
          { _id: existing._id },
          { $set: { status } }
        );
        stats.updated += 1;
        outcomes.push({ studentId, status });
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
        outcomes.push({ studentId, status });
      }
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
    notifyLowAttendance(classStudents, subject).catch((e) => console.error('Notify low attendance failed:', e.message));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate attendance detected' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getStudentAttendance = async (req, res) => {
  try {
    const { subjectId, from, to, page = 1, limit = 100 } = req.query;

    let student;
    if (req.user.role === 'student') {
      student = await Student.findOne({ userId: req.user._id });
    } else {
      const sid = objectId(req.params.id);
      student = sid ? await Student.findById(sid) : null;
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const filter = { student: student._id };
    const subject = objectId(subjectId);
    if (subject) filter.subject = subject;
    if (from) filter.date = { $gte: normalizeDate(from) };
    if (to) filter.date = { ...(filter.date || {}), $lte: normalizeDate(to) };

    const attendance = await Attendance.find(filter)
      .populate('subject', 'name code')
      .populate({ path: 'faculty', populate: { path: 'userId', select: 'name' } })
      .populate('timetable', 'day startTime endTime division room')
      .sort({ date: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const percentage = subject
      ? await attendanceService.calculateAttendancePercentage(student._id, subject)
      : await attendanceService.calculateOverallAttendance(student._id);
    const subjectWise = await attendanceService.calculateSubjectWiseAttendance(student._id);

    res.json({
      success: true,
      data: {
        student,
        attendance,
        totalRecords: attendance.length,
        percentage,
        subjectWise,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getSubjectAttendance = async (req, res) => {
  try {
    const { subjectId, date, semester, division, department, status } = req.query;
    const filter = {};

    const subject = objectId(subjectId);
    if (subject) filter.subject = subject;

    if (req.user.role === 'faculty') {
      const faculty = await getFacultyProfile(req.user._id);
      if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
      if (subject && !isFacultyAssigned(faculty, subjectId)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
      }
      filter.faculty = faculty._id;
    }

    if (date) {
      const day = normalizeDate(date);
      if (!day) return res.status(400).json({ success: false, message: 'Invalid date' });
      filter.date = day;
    }
    if (status) filter.status = status;

    const students = await Student.find({
      ...(semester ? { semester: Number(semester) } : {}),
      ...(division ? { division } : {}),
      ...(department ? { department } : {}),
    }).select('_id');

    const studentIds = students.map((s) => s._id);
    if (studentIds.length) filter.student = { $in: studentIds };

    const attendance = await Attendance.find(filter)
      .populate('student', 'rollNumber')
      .populate({ path: 'student', populate: { path: 'userId', select: 'name' } })
      .populate('subject', 'name code')
      .populate({ path: 'faculty', populate: { path: 'userId', select: 'name' } })
      .sort({ date: -1, 'student.rollNumber': 1 });

    res.json({ success: true, data: attendance, filter });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAttendanceAnalytics = async (req, res) => {
  try {
    const { subjectId, filter: filterType = 'all', from, to, date } = req.query;
    const subject = objectId(subjectId);
    if (!subject) {
      return res.status(400).json({ success: false, message: 'subjectId is required' });
    }

    const faculty = await getFacultyProfile(req.user._id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }
    if (!isFacultyAssigned(faculty, subjectId)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
    }

    let dateFilter = {};
    if (date) {
      const single = normalizeDate(date);
      if (!single) return res.status(400).json({ success: false, message: 'Invalid date' });
      dateFilter = { from: single, to: single };
    } else if (from || to) {
      dateFilter = {};
      if (from) {
        const f = normalizeDate(from);
        if (!f) return res.status(400).json({ success: false, message: 'Invalid from date' });
        dateFilter.from = f;
      }
      if (to) {
        const t = normalizeDate(to);
        if (!t) return res.status(400).json({ success: false, message: 'Invalid to date' });
        dateFilter.to = t;
      }
    }

    const rows = await attendanceService.getAttendanceAnalytics(faculty._id, subject, dateFilter);
    const students = attendanceService.applyFilter(rows, filterType);
    const stats = attendanceService.buildStats(rows);
    const dailyTrend = await attendanceService.getDailyTrend(faculty._id, subject, dateFilter);
    const subjectInfo = await Subject.findById(subject).select('name code semester department faculty').lean();

    res.json({
      success: true,
      data: { students, stats, dailyTrend, subject: subjectInfo },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getClassReport = async (req, res) => {
  try {
    const { subjectId, min, max, sortBy = 'percentage', order = 'asc' } = req.query;
    const subject = objectId(subjectId);
    if (!subject) {
      return res.status(400).json({ success: false, message: 'subjectId is required' });
    }

    let facultyId;
    if (req.user.role === 'faculty') {
      const faculty = await getFacultyProfile(req.user._id);
      if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
      if (!isFacultyAssigned(faculty, subjectId)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this subject' });
      }
      facultyId = faculty._id;
    } else {
      const subjectDoc = await Subject.findById(subject).lean();
      facultyId = subjectDoc?.faculty || null;
    }

    const rows = await attendanceService.getAttendanceAnalytics(facultyId, subject);
    let students = attendanceService.applyThreshold(rows, min, max);

    const dir = order === 'desc' ? -1 : 1;
    students = [...students].sort((a, b) => {
      if (a[sortBy] < b[sortBy]) return -1 * dir;
      if (a[sortBy] > b[sortBy]) return 1 * dir;
      return 0;
    });

    const subjectInfo = await Subject.findById(subject)
      .populate({ path: 'faculty', populate: { path: 'userId', select: 'name' } })
      .lean();
    const stats = attendanceService.buildStats(students);

    res.json({
      success: true,
      data: {
        subject: subjectInfo,
        students,
        stats,
        meta: { min, max, order, sortBy, generatedAt: new Date().toISOString() },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAttendanceByDate = async (req, res) => {
  try {
    const { date, subjectId, semester, division, department } = req.query;
    const day = normalizeDate(date);
    if (!day) {
      return res.status(400).json({ success: false, message: 'A valid date is required (YYYY-MM-DD)' });
    }
    const weekday = dayNameFromDate(day);

    const ttFilter = { day: weekday };
    const subject = objectId(subjectId);
    if (subject) ttFilter.subject = subject;
    if (semester) ttFilter.semester = Number(semester);
    if (division) ttFilter.division = division;
    if (department) ttFilter.department = department;

    if (req.user.role === 'faculty') {
      const faculty = await getFacultyProfile(req.user._id);
      if (!faculty) return res.status(404).json({ success: false, message: 'Faculty profile not found' });
      ttFilter.faculty = faculty._id;
    }

    const entries = await Timetable.find(ttFilter)
      .populate('subject', 'name code')
      .populate({ path: 'faculty', populate: { path: 'userId', select: 'name' } })
      .sort({ startTime: 1 })
      .lean();

    const lectures = [];
    const totals = { present: 0, absent: 0, unmarked: 0 };

    for (const entry of entries) {
      const classStudents = await Student.find({
        semester: entry.semester,
        department: entry.department,
        division: entry.division,
      })
        .populate('userId', 'name email')
        .sort({ rollNumber: 1 })
        .lean();

      const records = await Attendance.find({ timetable: entry._id, date: day }).lean();
      const recordMap = new Map(records.map((r) => [r.student.toString(), r]));

      const rows = classStudents.map((s) => {
        const rec = recordMap.get(s._id.toString());
        return { ...s, attendance: rec ? rec.status : 'unmarked' };
      });

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

    res.json({
      success: true,
      data: { date: toDateKey(day), weekday, lectures, totals },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getFacultyLectures = async (req, res) => {
  try {
    const { date } = req.query;
    const faculty = await getFacultyProfile(req.user._id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const targetDay = normalizeDate(date);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekday = days[targetDay.getDay()];

    const entries = await Timetable.find({ faculty: faculty._id, day: weekday })
      .populate('subject', 'name code')
      .sort({ startTime: 1 })
      .lean();

    const takenTimetableIds = await Attendance.distinct('timetable', { faculty: faculty._id, date: targetDay });
    const takenSet = new Set(takenTimetableIds.map((id) => id.toString()));

    const lectures = entries.map((e) => ({ ...e, attendanceTaken: takenSet.has(e._id.toString()) }));

    res.json({ success: true, data: { lectures, date: toDateKey(targetDay), weekday } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getLectureStudents = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const { date } = req.query;

    const faculty = await getFacultyProfile(req.user._id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }

    const timetable = await Timetable.findById(timetableId)
      .populate('subject', 'name code')
      .populate({ path: 'faculty', populate: { path: 'userId', select: 'name' } })
      .lean();
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Lecture not found' });
    }
    if (timetable.faculty._id.toString() !== faculty._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized for this lecture' });
    }

    const students = await Student.find({
      semester: timetable.semester,
      department: timetable.department,
      division: timetable.division,
    })
      .populate('userId', 'name email')
      .sort({ rollNumber: 1 })
      .lean();

    let existingMap = new Map();
    let recordDate = null;
    if (date) {
      const day = normalizeDate(date);
      if (day) {
        recordDate = toDateKey(day);
        const records = await Attendance.find({ timetable: timetableId, date: day }).lean();
        existingMap = new Map(records.map((r) => [r.student.toString(), r.status]));
      }
    }

    const rows = students.map((s) => ({
      ...s,
      status: existingMap.get(s._id.toString()) || '',
    }));

    res.json({
      success: true,
      data: {
        lecture: timetable,
        date: recordDate,
        students: rows,
        markedCount: Array.from(existingMap.values()).filter(Boolean).length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};