const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Timetable = require('../models/Timetable');
const { objectId } = require('../utils/mongoid');

// (present / total) * 100, 1 decimal round; total 0 ho to 0
const PERCENTAGE_STAGE = {
  $cond: [
    { $eq: ['$total', 0] },
    0,
    { $round: [{ $multiply: [{ $divide: ['$present', '$total'] }, 100] }, 1] },
  ],
};

const PRESENT_COUNT_STAGE = {
  present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
};

const toObjectId = (id) => {
  const parsed = objectId(id);
  if (!parsed) throw new Error('Invalid id');
  return parsed;
};

const buildDateMatch = (dateFilter = {}) => {
  if (!dateFilter.from && !dateFilter.to) return {};
  const dateMatch = {};
  if (dateFilter.from) dateMatch.$gte = dateFilter.from;
  if (dateFilter.to) dateMatch.$lte = dateFilter.to;
  return dateMatch;
};

// ---------------------------------------------------------------
// Percentages (student ke liye)
// ---------------------------------------------------------------

const calculateAttendancePercentage = async (studentId, subjectId = null) => {
  const student = toObjectId(studentId);

  const match = { student };
  const subject = objectId(subjectId);
  if (subject) match.subject = subject;

  const records = await Attendance.find(match).select('status');
  const total = records.length;
  const present = records.filter((r) => r.status === 'present').length;

  return total === 0 ? 0 : Math.round((present / total) * 100);
};

const calculateOverallAttendance = async (studentId) => {
  const student = toObjectId(studentId);

  const result = await Attendance.aggregate([
    { $match: { student } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        ...PRESENT_COUNT_STAGE,
      },
    },
  ]);

  if (result.length === 0) return 0;
  const { total, present } = result[0];
  return total === 0 ? 0 : Math.round((present / total) * 100);
};

const calculateSubjectWiseAttendance = async (studentId) => {
  const student = toObjectId(studentId);

  const pipeline = [
    { $match: { student } },
    {
      $group: {
        _id: '$subject',
        total: { $sum: 1 },
        ...PRESENT_COUNT_STAGE,
      },
    },
    { $addFields: { percentage: PERCENTAGE_STAGE } },
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

// ---------------------------------------------------------------
// Class roster — subject + faculty se class ke combos nikaal kar students
// ---------------------------------------------------------------

const getClassRoster = async (facultyId, subjectId) => {
  const timetableEntries = await Timetable.find({ subject: subjectId, faculty: facultyId })
    .select('semester department division subject')
    .lean();

  const comboKeys = new Set(
    timetableEntries.map((entry) => `${entry.semester}|${entry.department}|${entry.division}`)
  );

  const classCombos = Array.from(comboKeys).map((key) => {
    const [semester, department, division] = key.split('|');
    return { semester: Number(semester), department, division };
  });

  if (classCombos.length === 0) return [];

  return Student.find({ $or: classCombos }).populate('userId', 'name email').lean();
};

// ---------------------------------------------------------------
// Analytics — per student total / present / percentage
// ---------------------------------------------------------------

const getAttendanceAnalytics = async (facultyId, subjectId, dateFilter = {}) => {
  const faculty = toObjectId(facultyId);
  const subject = toObjectId(subjectId);

  const match = { faculty, subject };
  const dateMatch = buildDateMatch(dateFilter);
  if (Object.keys(dateMatch).length > 0) match.date = dateMatch;

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: '$student',
        total: { $sum: 1 },
        ...PRESENT_COUNT_STAGE,
      },
    },
    { $addFields: { percentage: PERCENTAGE_STAGE } },
  ];

  const grouped = await Attendance.aggregate(pipeline);
  const statsByStudent = new Map(grouped.map((g) => [g._id.toString(), g]));

  const roster = await getClassRoster(facultyId, subjectId);

  return roster.map((student) => {
    const stat = statsByStudent.get(student._id.toString());
    return {
      student,
      total: stat ? stat.total : 0,
      present: stat ? stat.present : 0,
      percentage: stat ? stat.percentage : 0,
    };
  });
};

// ---------------------------------------------------------------
// Daily trend — har din ki attendance % (line chart ke liye)
// ---------------------------------------------------------------

const getDailyTrend = async (facultyId, subjectId, dateFilter = {}) => {
  const faculty = toObjectId(facultyId);
  const subject = toObjectId(subjectId);

  const match = { faculty, subject };
  const dateMatch = buildDateMatch(dateFilter);
  if (Object.keys(dateMatch).length > 0) match.date = dateMatch;

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
    { $addFields: { percentage: PERCENTAGE_STAGE } },
  ]);

  return rows.map((row) => ({
    date: row._id,
    present: row.present,
    total: row.total,
    percentage: row.percentage,
  }));
};

// ---------------------------------------------------------------
// Stats cards + category counts
// ---------------------------------------------------------------

const buildStats = (students) => {
  const totalStudents = students.length;
  const withAttendance = students.filter((s) => s.total > 0);
  const withRecords = withAttendance.length;

  const avgAttendance = withAttendance.length > 0
    ? Math.round(withAttendance.reduce((sum, s) => sum + s.percentage, 0) / withAttendance.length)
    : 0;

  const highest = withAttendance.length > 0
    ? Math.max(...withAttendance.map((s) => s.percentage))
    : 0;

  const lowest = withAttendance.length > 0
    ? Math.min(...withAttendance.map((s) => s.percentage))
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
    highest,
    lowest,
    below75,
    above75: totalStudents - below75,
    categories,
  };
};

// ---------------------------------------------------------------
// Filters — analytics page ke filter pills
// ---------------------------------------------------------------

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
    default:
      return students;
  }
};

const applyThreshold = (students, min, max) => {
  const lowerBound = min === undefined || min === null || min === '' ? -Infinity : Number(min);
  const upperBound = max === undefined || max === null || max === '' ? Infinity : Number(max);

  return students.filter((s) => s.percentage >= lowerBound && s.percentage <= upperBound);
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
};
