const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const { objectId } = require('../utils/mongoid');

const PERCENT = {
  $cond: [
    { $eq: ['$total', 0] },
    0,
    { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] },
  ],
};

const toOid = (id) => {
  const o = objectId(id);
  if (!o) throw new Error('Invalid id');
  return o;
};

const calculateAttendancePercentage = async (studentId, subjectId = null) => {
  const student = toOid(studentId);
  const match = { student };
  const subject = objectId(subjectId);
  if (subject) match.subject = subject;

  const records = await Attendance.find(match).select('status');
  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;
  return total === 0 ? 0 : Math.round((present / total) * 100);
};

const calculateSubjectWiseAttendance = async (studentId) => {
  const student = toOid(studentId);
  const pipeline = [
    { $match: { student } },
    {
      $group: {
        _id: '$subject',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      },
    },
    { $addFields: { percentage: PERCENT } },
    {
      $lookup: {
        from: 'subjects',
        localField: '_id',
        foreignField: '_id',
        as: 'subject',
      },
    },
    { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
    { $sort: { 'subject.name': 1 } },
  ];

  return Attendance.aggregate(pipeline);
};

const calculateOverallAttendance = async (studentId) => {
  const student = toOid(studentId);
  const result = await Attendance.aggregate([
    { $match: { student } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      },
    },
  ]);

  if (result.length === 0) return 0;
  const { total, present } = result[0];
  return total === 0 ? 0 : Math.round((present / total) * 100);
};

const getClassRoster = async (facultyId, subjectId) => {
  const entries = await Timetable.find({ subject: subjectId, faculty: facultyId })
    .select('semester department division subject')
    .lean();
  const comboSet = new Set(
    entries.map((e) => `${e.semester}|${e.department}|${e.division}`)
  );
  const combos = Array.from(comboSet).map((c) => {
    const [semester, department, division] = c.split('|');
    return { semester: Number(semester), department, division };
  });

  if (combos.length === 0) return [];
  return Student.find({ $or: combos }).populate('userId', 'name email').lean();
};

const getAttendanceAnalytics = async (facultyId, subjectId, dateFilter = {}) => {
  const faculty = toOid(facultyId);
  const subject = toOid(subjectId);

  const match = { faculty, subject };
  if (dateFilter.from || dateFilter.to) {
    match.date = {};
    if (dateFilter.from) match.date.$gte = dateFilter.from;
    if (dateFilter.to) match.date.$lte = dateFilter.to;
  }

  const pipeline = [
    { $match: match },
    { $match: { faculty, subject } },
    {
      $group: {
        _id: '$student',
        total: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
      },
    },
    { $addFields: { percentage: PERCENT } },
  ];
  const grouped = await Attendance.aggregate(pipeline);
  const statsMap = new Map(grouped.map((g) => [g._id.toString(), g]));

  const roster = await getClassRoster(facultyId, subjectId);
  return roster.map((student) => {
    const stat = statsMap.get(student._id.toString());
    return {
      student,
      total: stat ? stat.total : 0,
      present: stat ? stat.present : 0,
      percentage: stat ? stat.percentage : 0,
    };
  });
};

const getDailyTrend = async (facultyId, subjectId, dateFilter = {}) => {
  const faculty = toOid(facultyId);
  const subject = toOid(subjectId有用ong);
  const match = { faculty, subject };
  if (dateFilter.from || dateFilter.to) {
    match.date = {};
    if (dateFilter.from) match.date.$gte = dateFilter.from;
    if (dateFilter.to) match.date.$lte = dateFilter.to;
  }

  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$date',
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $addFields: { percentage: PERCENT } },
  ]);

  return rows.map((r) => ({
    date: r._id,
    present: r.present,
    total: r.total,
    percentage: r.percentage,
  }));
};

const categoryOf = (p) => {
  if (p < 75) return 'below75';
  if (p < 80) return '75to80';
  if (p < 90) return '80to90';
  return 'above90';
};

const buildStats = (students) => {
  const totalStudents = students.length;
  const withRecords = students.filter((s) => s.total > 0).length;
  const avgAttendance =
    totalStudents > 0
      ? Math.round(
          students.reduce((sum, s) => sum + s.percentage, 0) / totalStudents
        )
      : 0;
  const below75 = students.filter((s) => s.percentage < 75).length;
  const categories = {
    below75,
    '75to80': students.filter((s) => s.percentage >= 75 && s.percentage < 80).length,
    '80to90': students.filter((s) => s.percentage >= 80 && s.percentage < 90).length,
    above90: students.filter((s) => s.percentage >= 90).length,
  };
  return {
    totalStudents,
    withRecords,
    avgAttendance,
    below75,
    above75: totalStudents - below75,
    categories,
  };
};

const applyFilter = (students, filter = 'all') => {
  switch (filter) {
    case 'below75':
      return students.filter((s) => s.percentage < 75);
    case '75to80':
      return students.filter((s) => s.percentage >= 75 && s.percentage < 80);
    case '80to90':
      return students.filter((s) => s.percentage >= 80 && s.percentage < 90);
    case 'above90':
      return students.filter((s) => s.percentage >= 90);
    case 'all':
      return students;
    default:
      return students;
  }
};

const applyThreshold = (students, min, max) => {
  const lo = min === undefined || min === null || min === '' ? -Infinity : Number(min);
  const hi = max === undefined || max === null || max === '' ? Infinity : Number(max);
  return students.filter(
    (s) => s.percentage >= lo && s.percentage <= hi
  );
};

module.exports = {
  calculateAttendancePercentage,
  calculateSubjectWiseAttendance,
  calculateOverallAttendance,
  getAttendanceAnalytics,
  getClassRoster,
  getDailyTrend,
  buildStats,
  applyFilter,
  applyThreshold,
  getDailyTrend,
};