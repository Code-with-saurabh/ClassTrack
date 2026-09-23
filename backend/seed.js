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

const BACK_DAYS = 30; // ~6 working weeks of history

// ---------- deterministic pseudo-random helpers (re-seeding gives stable data) ----------
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------- dataset ----------
// Faculty with assigned subjects
const FACULTY = [
  { name: 'Saurabh Sharma', email: 'saurabh@classtrack.com', employeeId: 'F001', subjectCodes: ['CS301', 'CS303'] },
  { name: 'Priya Verma',   email: 'priya@classtrack.com',   employeeId: 'F002', subjectCodes: ['CS302', 'CS304'] },
  { name: 'Amit Patel',    email: 'amit@classtrack.com',    employeeId: 'F003', subjectCodes: ['CS305', 'CS306'] },
  { name: 'Neha Kulkarni', email: 'neha@classtrack.com',    employeeId: 'F004', subjectCodes: ['CS303', 'CS304'] },
];

const SUBJECTS = [
  { name: 'Web Development', code: 'CS301', faculty: 'saurabh@classtrack.com' },
  { name: 'Computer Networks', code: 'CS302', faculty: 'priya@classtrack.com' },
  { name: 'Database Management', code: 'CS303', faculty: 'saurabh@classtrack.com' },
  { name: 'Operating Systems', code: 'CS304', faculty: 'priya@classtrack.com' },
  { name: 'Software Engineering', code: 'CS305', faculty: 'amit@classtrack.com' },
  { name: 'Machine Learning', code: 'CS306', faculty: 'amit@classtrack.com' },
];

// Division A timetable — 4 lectures/day Mon-Fri
const SCHEDULE_A = {
  Monday:    [['CS301', 'Lab 3', '09:00', '10:15'], ['CS302', 'Room 204', '10:30', '11:45'], ['CS303', 'Room 105', '12:00', '13:15'], ['CS306', 'Room 312', '13:30', '14:45']],
  Tuesday:   [['CS303', 'Room 105', '09:00', '10:15'], ['CS301', 'Lab 3', '10:30', '11:45'], ['CS304', 'Room 208', '12:00', '13:15'], ['CS305', 'Room 118', '13:30', '14:45']],
  Wednesday: [['CS302', 'Room 204', '09:00', '10:15'], ['CS305', 'Room 118', '10:30', '11:45'], ['CS301', 'Lab 3', '12:00', '13:15'], ['CS304', 'Room 208', '13:30', '14:45']],
  Thursday:  [['CS304', 'Room 208', '09:00', '10:15'], ['CS306', 'Room 312', '10:30', '11:45'], ['CS303', 'Room 105', '12:00', '13:15'], ['CS302', 'Room 204', '13:30', '14:45']],
  Friday:    [['CS306', 'Room 312', '09:00', '10:15'], ['CS305', 'Room 118', '10:30', '11:45'], ['CS302', 'Room 204', '12:00', '13:15'], ['CS301', 'Lab 3', '13:30', '14:45']],
};

// Division B timetable
const SCHEDULE_B = {
  Monday:    [['CS302', 'Room 303', '09:00', '10:15'], ['CS306', 'Room 401', '10:30', '11:45'], ['CS304', 'Room 208', '12:00', '13:15'], ['CS305', 'Room 216', '13:30', '14:45']],
  Tuesday:   [['CS301', 'Lab 2', '09:00', '10:15'], ['CS303', 'Room 107', '10:30', '11:45'], ['CS302', 'Room 303', '12:00', '13:15'], ['CS306', 'Room 401', '13:30', '14:45']],
  Wednesday: [['CS305', 'Room 216', '09:00', '10:15'], ['CS304', 'Room 208', '10:30', '11:45'], ['CS301', 'Lab 2', '12:00', '13:15'], ['CS303', 'Room 107', '13:30', '14:45']],
  Thursday:  [['CS303', 'Room 107', '09:00', '10:15'], ['CS301', 'Lab 2', '10:30', '11:45'], ['CS306', 'Room 401', '12:00', '13:15'], ['CS304', 'Room 208', '13:30', '14:45']],
  Friday:    [['CS304', 'Room 208', '09:00', '10:15'], ['CS302', 'Room 303', '10:30', '11:45'], ['CS306', 'Room 401', '12:00', '13:15'], ['CS305', 'Room 216', '13:30', '14:45']],
};

// 24 students: [name, division, target attendance rate 0-1]
const STUDENTS = [
  ['Aarav Sharma', 'A', 0.94],  ['Ishita Patel', 'A', 0.88],  ['Sonal Gupta', 'A', 0.62],
  ['Rahul Mehta', 'A', 0.78],   ['Ananya Iyer', 'A', 0.91],   ['Karan Singh', 'A', 0.85],
  ['Pooja Deshmukh', 'A', 0.72],['Rohan Joshi', 'A', 0.93],   ['Sneha Kulkarni', 'A', 0.89],
  ['Vivek Rao', 'A', 0.82],     ['Nikita Bansal', 'A', 0.67], ['Aditya Naik', 'A', 0.76],
  ['Farhan Khan', 'B', 0.90],   ['Riya Nair', 'B', 0.86],     ['Sahil Gupta', 'B', 0.70],
  ['Meera Pillai', 'B', 0.87],  ['Arjun Reddy', 'B', 0.83],   ['Tanvi Shah', 'B', 0.75],
  ['Mohit Agrawal', 'B', 0.92], ['Divya Menon', 'B', 0.64],   ['Kunal Malhotra', 'B', 0.88],
  ['Shreya Bhat', 'B', 0.79],   ['Harsh Deshpande', 'B', 0.92],['Gauri Pawar', 'B', 0.71],
];

// Exam grids per subject: [examType, maxMarks]
const EXAMS = [
  ['Mid-term', 50],
  ['Assignment', 20],
  ['Quiz', 20],
];

const EMAIL_HOST = 'classtrack.com';

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Connected to MongoDB (${mongoose.connection.name})`);

    const collections = [
      ['users', User], ['students', Student], ['faculties', Faculty], ['subjects', Subject],
      ['timetables', Timetable], ['attendances', Attendance], ['marks', Marks], ['notifications', Notification],
    ];
    for (const [name, model] of collections) {
      try { await model.collection.drop(); } catch (e) {
        if (e?.codeName !== 'NamespaceNotFound' && e?.code !== 26) throw e;
      }
    }
    await Attendance.init();
    await Marks.init();

    // ---------- users: admin + faculty ----------
    const admin = await User.create({
      name: 'Admin User', email: `admin@${EMAIL_HOST}`, password: 'admin123', role: 'admin',
    });

    const byEmail = {};
    const facultyByEmail = {};
    for (const f of FACULTY) {
      const user = await User.create({
        name: f.name, email: f.email, password: 'faculty123', role: 'faculty',
      });
      const profile = await Faculty.create({
        userId: user._id, employeeId: f.employeeId, department: 'Computer Science', assignedSubjects: [],
      });
      byEmail[f.email] = user;
      facultyByEmail[f.email] = profile;
    }

    // ---------- subjects (assigned to faculty emails from data) ----------
    const subjectByCode = {};
    for (const s of SUBJECTS) {
      const sub = await Subject.create({
        name: s.name, code: s.code, semester: 5, department: 'Computer Science',
        faculty: facultyByEmail[s.faculty]._id,
      });
      subjectByCode[s.code] = sub;
    }
    for (const f of FACULTY) {
      facultyByEmail[f.email].assignedSubjects = f.subjectCodes.map((c) => subjectByCode[c]._id);
      await facultyByEmail[f.email].save();
    }

    // ---------- students ----------
    const profiles = [];
    await Promise.all(
      STUDENTS.map(async (s, i) => {
        const idx = i + 1;
        const division = s[1];
        const roll = division === 'A'
          ? `250863131${String(idx).padStart(3, '0')}`
          : `250863131${String(100 + idx).padStart(3, '0')}`;
        const user = await User.create({
          name: s[0], email: `student${idx}@${EMAIL_HOST}`, password: 'student123', role: 'student',
        });
        const profile = await Student.create({
          userId: user._id, rollNumber: roll, semester: 5, division, department: 'Computer Science',
          academicYear: '2025-2026',
        });
        profiles.push({ ...profile.toObject(), targetRate: s[2], email: `student${idx}@${EMAIL_HOST}`, name: s[0] });
      })
    );

    // ---------- timetable ----------
    const ttByDivisionDay = {};
    for (const [division, schedule] of [['A', SCHEDULE_A], ['B', SCHEDULE_B]]) {
      ttByDivisionDay[division] = {};
      const rows = [];
      for (const day of Object.keys(schedule)) {
        for (const [code, room, start, end] of schedule[day]) {
          const sub = subjectByCode[code];
          rows.push({
            subject: sub._id, faculty: sub.faculty, division, day, startTime: start, endTime: end, room,
            semester: 5, department: 'Computer Science',
          });
          ttByDivisionDay[division][day] = ttByDivisionDay[division][day] || [];
        }
      }
      await Timetable.insertMany(rows);
    }
    const ttDocs = await Timetable.find().lean();
    const ttByKey = {};
    for (const tt of ttDocs) {
      const key = `${tt.division}|${tt.day}`;
      (ttByKey[key] = ttByKey[key] || []).push(tt);
    }

    // ---------- attendance ----------
    const dayList = [];
    for (let i = BACK_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const wd = d.getDay();
      if (wd === 0 || wd === 6) continue; // working Mon-Fri
      dayList.push(d);
    }

    const totals = new Map();   // roll -> { attended, total }
    const records = [];
    for (const d of dayList) {
      const wd = dayNameFromDate(d);
      const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      for (const p of profiles) {
        const entries = ttByKey[`${p.division}|${wd}`] || [];
        const tBase = totals.get(p.rollNumber) || { attended: 0, total: 0 };
        for (const tt of entries) {
          const rng = rngFor(p.rollNumber, wd, tt.startTime, tt.subject.toString());
          const status = rng() < p.targetRate ? 'present' : 'absent';
          if (status === 'present') tBase.attended++;
          tBase.total++;
          records.push({
            student: p._id, subject: tt.subject, faculty: tt.faculty, timetable: tt._id,
            date, status, academicYear: p.academicYear, semester: p.semester,
          });
        }
        totals.set(p.rollNumber, tBase);
      }
    }
    await Attendance.insertMany(records);

    // ---------- marks ----------
    const markDocs = [];
    for (const p of profiles) {
      const ability = 0.55 + rngFor(p.rollNumber, 'ability')() * 0.37; // 0.55 - 0.92
      for (const s of SUBJECTS) {
        const subjectAbility = clamp(ability + (rngFor(p.rollNumber, s.code)() - 0.5) * 0.12, 0.42, 0.97);
        for (const [examType, maxMarks] of EXAMS) {
          const jitter = (rngFor(p.rollNumber, s.code, examType)() - 0.5) * 0.2;
          const score = clamp(Math.round(maxMarks * (subjectAbility + jitter)), 0, maxMarks);
          markDocs.push({
            student: p._id, subject: subjectByCode[s.code]._id, examType,
            marksObtained: score, maximumMarks: maxMarks,
            academicYear: p.academicYear, semester: p.semester,
          });
        }
      }
    }
    await Marks.insertMany(markDocs);

    // ---------- notifications ----------
    const notifications = [];
    for (const p of profiles) {
      notifications.push({
        user: p.userId, title: 'Welcome to ClassTrack',
        body: `Hi ${p.name}, your dashboard is ready for 2025-2026 Sem 5. Track attendance, marks, and timetable here.`,
        type: 'success', link: '/student',
      });
    }

    const lowStudents = profiles
      .map((p) => ({ p, rate: totals.get(p.rollNumber)?.attended / totals.get(p.rollNumber)?.total }))
      .filter(({ rate }) => rate < 0.75);
    for (const { p, rate } of lowStudents) {
      notifications.push({
        user: p.userId, title: 'Low attendance warning',
        body: `Your attendance is ${(rate * 100).toFixed(1)}% — below the required 75%. Please attend classes regularly.`,
        type: 'warning', link: '/student',
      });
    }

    for (const f of FACULTY) {
      const subs = f.subjectCodes.map((c) => subjectByCode[c].name).join(', ');
      notifications.push({
        user: byEmail[f.email]._id, title: 'Mid-term marks pending',
        body: `Friendly reminder to upload mid-term marks for: ${subs}. Deadline is this Friday.`,
        type: 'info', link: '/faculty/marks',
      });
    }

    notifications.push({
      user: admin._id, title: 'Semester seeded',
      body: `Deep demo dataset loaded: ${STUDENTS.length} students, ${SUBJECTS.length} subjects, ${records.length} attendance records, ${markDocs.length} marks, ${ttDocs.length} timetable slots.`,
      type: 'info', link: '/admin',
    });

    notifications.push({
      user: byEmail['neha@classtrack.com']._id, title: 'Timetable coordination',
      body: `DivA and DivB share labs; please confirm the updated Faculty room allotments for Machine Learning.`,
      type: 'danger', link: '/faculty/timetable',
    });

    await Notification.insertMany(notifications);

    // ---------- summary ----------
    console.log('\n================ Seed Summary ================');
    console.log(`Database        : ${mongoose.connection.name}`);
    console.log(`Faculty         : ${FACULTY.length}`);
    console.log(`Subjects        : ${SUBJECTS.length}`);
    console.log(`Students        : ${profiles.length} (${profiles.filter((p) => p.division === 'A').length} Div A / ${profiles.filter((p) => p.division === 'B').length} Div B)`);
    console.log(`Timetable slots : ${ttDocs.length}`);
    console.log(`Attendance      : ${records.length} records over ${dayList.length} working days`);
    console.log(`Marks           : ${markDocs.length} records (${EXAMS.length} exam types)`);
    console.log(`Notifications   : ${notifications.length} (${lowStudents.length} low-attendance warnings)`);
    console.log('\nAttendance rates per student:');
    for (const p of profiles) {
      const t = totals.get(p.rollNumber);
      const rate = ((t.attended / t.total) * 100).toFixed(1);
      const flag = t.attended / t.total < 0.75 ? '  <-- LOW' : '';
      console.log(`  ${p.rollNumber}  ${p.name.padEnd(18)} ${String(rate).padStart(5)}%  ${p.division}${flag}`);
    }
    console.log('\n================ Login Credentials ================');
    console.log('Admin    : admin@classtrack.com       / admin123');
    for (const f of FACULTY) console.log(`Faculty  : ${f.email.padEnd(28)}/ faculty123`);
    console.log(`Students : student1@classtrack.com .. student${STUDENTS.length}@classtrack.com  / student123`);
    console.log('====================================================');
    console.log('\nSeed completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();