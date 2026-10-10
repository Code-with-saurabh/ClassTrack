const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const User = require('./models/User');
const Student = require('./models/Student');
const Faculty = require('./models/Faculty');
const Subject = require('./models/Subject');
const Timetable = require('./models/Timetable');
const Attendance = require('./models/Attendance');
const Marks = require('./models/Marks');
const Notification = require('./models/Notification');
const { dayNameFromDate } = require('./utils/date');

dotenv.config();

const CSV_DIR = path.join(__dirname, '..', 'csv-import');
const BACK_DAYS = 60;
const EMAIL_HOST = 'classtrack.com';
const DEPARTMENT = 'Computer Science';
const SEMESTER = 5;
const DIVISION = 'A';
const MIDTERM_MAX = 30;

// ---------- deterministic pseudo-random ----------
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rngFor = (...parts) => mulberry32(fnv1a(parts.join('|')));

// ---------- CSV helpers ----------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (insideQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      insideQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function csvToObjects(text) {
  const rows = parseCsv(text).filter((r) => r.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? '').trim();
    });
    return obj;
  });
}

function readCsv(name) {
  const filePath = path.join(CSV_DIR, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found: ${filePath}`);
  }
  return csvToObjects(fs.readFileSync(filePath, 'utf8'));
}

function splitCodes(value) {
  return String(value || '')
    .split(/[|;]/)
    .map((c) => c.trim())
    .filter(Boolean);
}

// ---------- reset ----------
async function resetDatabase() {
  const collections = [
    ['users', User],
    ['students', Student],
    ['faculties', Faculty],
    ['subjects', Subject],
    ['timetables', Timetable],
    ['attendances', Attendance],
    ['marks', Marks],
    ['notifications', Notification],
  ];

  for (const [, model] of collections) {
    try {
      await model.collection.drop();
    } catch (error) {
      const missing = error?.codeName === 'NamespaceNotFound' || error?.code === 26;
      if (!missing) throw error;
    }
  }

  await Attendance.init();
  await Marks.init();
}

// ---------- CSV import ----------
async function importFromCsv() {
  const facultyCsv = readCsv('faculty.csv');
  const subjectCsv = readCsv('subjects.csv');
  const studentCsv = readCsv('students.csv');

  console.log(`CSV rows -> faculty: ${facultyCsv.length}, subjects: ${subjectCsv.length}, students: ${studentCsv.length}`);

  // Admin
  const admin = await User.create({
    name: 'Admin User',
    email: `admin@${EMAIL_HOST}`,
    password: 'admin123',
    role: 'admin',
  });

  // Faculty
  const facultyIdByEmail = new Map();
  const facultyProfiles = [];

  for (const row of facultyCsv) {
    const user = await User.create({
      name: row.name,
      email: row.email,
      password: row.password || 'faculty123',
      role: 'faculty',
    });

    const profile = await Faculty.create({
      userId: user._id,
      employeeId: row.employeeId,
      department: row.department || DEPARTMENT,
      assignedSubjects: [],
    });

    facultyIdByEmail.set(row.email.toLowerCase(), profile._id);
    facultyProfiles.push({ row, user, profile });
  }

  // Subjects
  const subjectByCode = new Map();
  const subjects = [];

  for (const row of subjectCsv) {
    const facultyId = row.facultyEmail
      ? facultyIdByEmail.get(row.facultyEmail.toLowerCase())
      : null;

    const subject = await Subject.create({
      name: row.name,
      code: row.code,
      semester: Number(row.semester) || SEMESTER,
      department: row.department || DEPARTMENT,
      faculty: facultyId,
    });

    subjectByCode.set(subject.code, subject);
    subjects.push(subject);
  }

  // Faculty assigned subjects
  for (const { row, profile } of facultyProfiles) {
    const codes = splitCodes(row.assignedSubjectCodes);
    profile.assignedSubjects = codes.map((code) => subjectByCode.get(code)?._id).filter(Boolean);
    await profile.save();
  }

  // Students
  const students = [];

  for (const row of studentCsv) {
    const user = await User.create({
      name: row.name,
      email: row.email,
      password: row.password || 'student123',
      role: 'student',
    });

    const student = await Student.create({
      userId: user._id,
      rollNumber: row.rollNumber,
      semester: Number(row.semester) || SEMESTER,
      division: row.division || DIVISION,
      department: row.department || DEPARTMENT,
      academicYear: row.academicYear || '2026-2027',
    });

    students.push({ ...student.toObject(), email: row.email, name: row.name });
  }

  return { admin, subjects, students, facultyProfiles };
}

// ---------- timetable ----------
const SLOTS = [
  ['09:00', '10:15'],
  ['10:30', '11:45'],
  ['12:00', '13:15'],
  ['13:30', '14:45'],
];
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ROOMS = ['Room 101', 'Room 102', 'Room 103', 'Lab 1', 'Lab 2', 'Room 205'];

async function seedTimetable(subjects) {
  const rows = [];
  let subjectIndex = 0;

  for (const day of WEEK_DAYS) {
    for (let s = 0; s < SLOTS.length; s += 1) {
      const subject = subjects[subjectIndex % subjects.length];
      const [startTime, endTime] = SLOTS[s];

      rows.push({
        subject: subject._id,
        faculty: subject.faculty,
        division: DIVISION,
        day,
        startTime,
        endTime,
        room: ROOMS[subjectIndex % ROOMS.length],
        semester: SEMESTER,
        department: DEPARTMENT,
      });

      subjectIndex += 1;
    }
  }

  await Timetable.insertMany(rows);

  const allSlots = await Timetable.find().lean();
  const slotsByDay = {};
  for (const slot of allSlots) {
    if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
    slotsByDay[slot.day].push(slot);
  }

  return { allSlots, slotsByDay };
}

// ---------- attendance (~2 months) ----------
function buildWorkingDays() {
  const days = [];
  for (let i = BACK_DAYS - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) continue;
    days.push(date);
  }
  return days;
}

function targetRateFor(rollNumber) {
  return 0.55 + rngFor(rollNumber, 'rate')() * 0.4; // 55%–95%
}

async function seedAttendance(students, slotsByDay) {
  const workingDays = buildWorkingDays();
  const records = [];
  const totals = new Map();
  const summary = { present: 0, absent: 0 };

  for (const date of workingDays) {
    const weekday = dayNameFromDate(date);
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daySlots = slotsByDay[weekday] || [];

    for (const student of students) {
      const rate = targetRateFor(student.rollNumber);
      const studentTotal = totals.get(student.rollNumber) || { attended: 0, total: 0 };

      for (const slot of daySlots) {
        const rng = rngFor(student.rollNumber, day.toISOString(), slot.startTime, String(slot.subject));
        const status = rng() < rate ? 'present' : 'absent';

        if (status === 'present') {
          summary.present += 1;
          studentTotal.attended += 1;
        } else {
          summary.absent += 1;
        }
        studentTotal.total += 1;

        records.push({
          student: student._id,
          subject: slot.subject,
          faculty: slot.faculty,
          timetable: slot._id,
          date: day,
          status,
          academicYear: student.academicYear || '2026-2027',
          semester: student.semester || SEMESTER,
        });
      }

      totals.set(student.rollNumber, studentTotal);
    }
  }

  for (let i = 0; i < records.length; i += 1000) {
    await Attendance.insertMany(records.slice(i, i + 1000), { ordered: false });
  }

  return { total: records.length, totals, ...summary };
}

// ---------- mid-sem-1 marks (out of 30) ----------
async function seedMarks(students, subjects) {
  const records = [];

  for (const student of students) {
    for (const subject of subjects) {
      const rng = rngFor(student.rollNumber, subject.code, 'midsem1');
      records.push({
        student: student._id,
        subject: subject._id,
        examType: 'Mid-term',
        marksObtained: Math.min(MIDTERM_MAX, Math.max(0, Math.floor(rng() * (MIDTERM_MAX + 1)))),
        maximumMarks: MIDTERM_MAX,
        academicYear: student.academicYear || '2026-2027',
        semester: student.semester || SEMESTER,
      });
    }
  }

  await Marks.insertMany(records, { ordered: false });
  return records;
}

// ---------- notifications ----------
async function seedNotifications({ admin, subjects, students, facultyProfiles, totals, records, markDocs, allSlots }) {
  const notifications = [];

  for (const student of students) {
    notifications.push({
      user: student.userId,
      title: 'Welcome to ClassTrack',
      body: `Hi ${student.name}, your Sem ${SEMESTER} dashboard is ready. Attendance, marks and timetable are live.`,
      type: 'success',
      link: '/student',
    });
  }

  // Low attendance warnings (< 75%)
  for (const student of students) {
    const t = totals.get(student.rollNumber);
    if (!t || t.total === 0) continue;
    const rate = t.attended / t.total;
    if (rate < 0.75) {
      notifications.push({
        user: student.userId,
        title: 'Low attendance warning',
        body: `Your attendance is ${(rate * 100).toFixed(1)}% — below the required 75%. Please attend classes regularly.`,
        type: 'warning',
        link: '/student',
      });
    }
  }

  // Faculty mid-term reminder
  for (const { row, profile } of facultyProfiles) {
    const assigned = (profile.assignedSubjects || [])
      .map((id) => subjects.find((s) => String(s._id) === String(id))?.name)
      .filter(Boolean)
      .join(', ');

    notifications.push({
      user: profile.userId,
      title: 'Mid-term marks reminder',
      body: assigned
        ? `Please verify mid-term marks for: ${assigned}.`
        : 'Please verify mid-term marks for your subjects.',
      type: 'info',
      link: '/faculty/marks',
    });
  }

  notifications.push({
    user: admin._id,
    title: 'CSV seed complete',
    body: `${students.length} students, ${subjects.length} subjects, ${allSlots.length} timetable slots, ${records} attendance records, ${markDocs.length} mid-term marks loaded from CSV.`,
    type: 'info',
    link: '/admin',
  });

  await Notification.insertMany(notifications);
  return notifications;
}

// ---------- main ----------
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to MongoDB (${mongoose.connection.name})`);

    await resetDatabase();
    console.log('Database reset');

    const { admin, subjects, students, facultyProfiles } = await importFromCsv();
    console.log(`Imported -> admin: 1, faculty: ${facultyProfiles.length}, subjects: ${subjects.length}, students: ${students.length}`);

    const { allSlots, slotsByDay } = await seedTimetable(subjects);
    console.log(`Timetable: ${allSlots.length} slots (Div ${DIVISION}, Mon-Fri)`);

    const attendance = await seedAttendance(students, slotsByDay);
    console.log(`Attendance: ${attendance.total} (present ${attendance.present}, absent ${attendance.absent})`);

    const markDocs = await seedMarks(students, subjects);
    console.log(`Mid-term marks (/${MIDTERM_MAX}): ${markDocs.length}`);

    const notifications = await seedNotifications({
      admin,
      subjects,
      students,
      facultyProfiles,
      totals: attendance.totals,
      records: attendance.total,
      markDocs,
      allSlots,
    });
    console.log(`Notifications: ${notifications.length}`);

    console.log('\n================ Seed Summary ================');
    console.log(`Database     : ${mongoose.connection.name}`);
    console.log(`Faculty      : ${await Faculty.countDocuments()}`);
    console.log(`Subjects     : ${await Subject.countDocuments()}`);
    console.log(`Students     : ${await Student.countDocuments()} (Div ${DIVISION}, Sem ${SEMESTER})`);
    console.log(`Timetable    : ${await Timetable.countDocuments()}`);
    console.log(`Attendance   : ${await Attendance.countDocuments()} (~${BACK_DAYS} days, Mon-Fri)`);
    console.log(`Marks        : ${await Marks.countDocuments()} (Mid-term /${MIDTERM_MAX})`);
    console.log(`Notifications: ${await Notification.countDocuments()}`);
    console.log('\nLogins:');
    console.log(`  Admin    : admin@${EMAIL_HOST} / admin123`);
    console.log(`  Faculty  : <email from faculty.csv> / faculty123`);
    console.log(`  Students : student1@${EMAIL_HOST} .. / student123`);
    console.log('===============================================');
    console.log('Seed completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

main();
