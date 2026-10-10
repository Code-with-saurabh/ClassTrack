const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const env = require('./config/env');

const User = require('./models/User');
const Student = require('./models/Student');
const Faculty = require('./models/Faculty');
const Subject = require('./models/Subject');

dotenv.config();

const CSV_DIR = path.join(__dirname, '..', 'csv-import');

const REQUIRED_FILES = {
  faculty: path.join(CSV_DIR, 'faculty.csv'),
  subjects: path.join(CSV_DIR, 'subjects.csv'),
  students: path.join(CSV_DIR, 'students.csv'),
};

// ---------------------------------------------------------------
// CSV reading
// ---------------------------------------------------------------

// Simple CSV parser: handles quoted fields, commas inside quotes, CRLF line endings
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

// Converts raw CSV text into an array of objects keyed by the header row
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

function readCsvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  const text = fs.readFileSync(filePath, 'utf8');
  return csvToObjects(text);
}

// ---------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------

const errors = [];

function addError(file, rowNumber, message) {
  errors.push(`${file} row ${rowNumber}: ${message}`);
}

function splitCodes(value) {
  return String(value || '')
    .split(/[|;]/)
    .map((c) => c.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------
// Import steps (order matters: faculty -> subjects -> link -> students)
// ---------------------------------------------------------------

// Creates or updates a faculty user + faculty profile, returns faculty._id
async function importFacultyRow(row, rowNumber) {
  const { name, email, password, employeeId, department } = row;

  if (!name || !email || !employeeId || !department) {
    addError('faculty.csv', rowNumber, 'name, email, employeeId, department are required');
    return null;
  }

  // 1. user account (login)
  let user = await User.findOne({ email });
  if (user) {
    user.name = name;
    if (password) user.password = password;
    await user.save();
  } else {
    user = await User.create({
      name,
      email,
      password: password || 'faculty123',
      role: 'faculty',
    });
  }

  // 2. faculty profile
  let faculty = await Faculty.findOne({ userId: user._id });
  if (!faculty) {
    const duplicate = await Faculty.findOne({ employeeId });
    if (duplicate) {
      addError('faculty.csv', rowNumber, `employeeId ${employeeId} already used by another faculty`);
      return null;
    }
    faculty = await Faculty.create({
      userId: user._id,
      employeeId,
      department,
      assignedSubjects: [],
    });
  } else {
    faculty.employeeId = employeeId;
    faculty.department = department;
    await faculty.save();
  }

  return faculty._id;
}

// Creates or updates a subject, links it to faculty by email
async function importSubjectRow(row, rowNumber, facultyIdByEmail) {
  const { name, code, semester, department, facultyEmail } = row;

  if (!name || !code || !semester || !department) {
    addError('subjects.csv', rowNumber, 'name, code, semester, department are required');
    return null;
  }

  let facultyId = null;
  if (facultyEmail) {
    facultyId = facultyIdByEmail.get(facultyEmail.toLowerCase());
    if (!facultyId) {
      addError('subjects.csv', rowNumber, `facultyEmail ${facultyEmail} not found in faculty.csv`);
    }
  }

  const update = { name, semester: Number(semester), department };
  if (facultyId) update.faculty = facultyId;

  const subject = await Subject.findOneAndUpdate(
    { code },
    { $set: update },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

  return subject;
}

// Assigns subject codes (from faculty.csv) to each faculty profile
async function linkFacultySubjects(facultyCsv, facultyIdByEmail, subjectByCode) {
  for (const row of facultyCsv) {
    const facultyId = facultyIdByEmail.get(String(row.email || '').toLowerCase());
    if (!facultyId) continue;

    const codes = splitCodes(row.assignedSubjectCodes);
    const subjectIds = codes
      .map((code) => subjectByCode.get(code))
      .filter(Boolean);

    const missing = codes.filter((code) => !subjectByCode.has(code));
    if (missing.length > 0) {
      addError('faculty.csv', '-', `${row.email}: subject code(s) not found: ${missing.join(', ')}`);
    }

    await Faculty.findByIdAndUpdate(facultyId, { assignedSubjects: subjectIds });
  }
}

// Creates or updates a student user + student profile
async function importStudentRow(row, rowNumber) {
  const { name, email, password, rollNumber, semester, division, department, academicYear } = row;

  if (!name || !email || !rollNumber || !semester || !division || !department || !academicYear) {
    addError('students.csv', rowNumber, 'all columns are required');
    return false;
  }

  // 1. user account (login)
  let user = await User.findOne({ email });
  if (user) {
    user.name = name;
    if (password) user.password = password;
    await user.save();
  } else {
    user = await User.create({
      name,
      email,
      password: password || 'student123',
      role: 'student',
    });
  }

  // 2. student profile
  const update = {
    semester: Number(semester),
    division,
    department,
    academicYear,
  };

  const existingByRoll = await Student.findOne({ rollNumber });
  if (existingByRoll && String(existingByRoll.userId) !== String(user._id)) {
    addError('students.csv', rowNumber, `rollNumber ${rollNumber} already used by another student`);
    return false;
  }

  await Student.findOneAndUpdate(
    { userId: user._id },
    { $set: { rollNumber, ...update } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

  return true;
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main() {
  console.log('Reading CSV files from:', CSV_DIR);

  const facultyCsv = readCsvFile(REQUIRED_FILES.faculty);
  const subjectCsv = readCsvFile(REQUIRED_FILES.subjects);
  const studentCsv = readCsvFile(REQUIRED_FILES.students);

  console.log(`Found rows -> faculty: ${facultyCsv.length}, subjects: ${subjectCsv.length}, students: ${studentCsv.length}`);

  await mongoose.connect(env.MONGO_URI);
  console.log(`Connected to MongoDB (${mongoose.connection.name})`);

  // Step 1: faculty
  const facultyIdByEmail = new Map();
  for (let i = 0; i < facultyCsv.length; i += 1) {
    const row = facultyCsv[i];
    const facultyId = await importFacultyRow(row, i + 2);
    if (facultyId && row.email) {
      facultyIdByEmail.set(row.email.toLowerCase(), facultyId);
    }
  }
  console.log(`Faculty imported: ${facultyIdByEmail.size}/${facultyCsv.length}`);

  // Step 2: subjects
  const subjectByCode = new Map();
  for (let i = 0; i < subjectCsv.length; i += 1) {
    const subject = await importSubjectRow(subjectCsv[i], i + 2, facultyIdByEmail);
    if (subject) subjectByCode.set(subject.code, subject._id);
  }
  console.log(`Subjects imported: ${subjectByCode.size}/${subjectCsv.length}`);

  // Step 3: link faculty <-> subjects
  await linkFacultySubjects(facultyCsv, facultyIdByEmail, subjectByCode);
  console.log('Faculty subject assignments updated');

  // Step 4: students
  let studentsImported = 0;
  for (let i = 0; i < studentCsv.length; i += 1) {
    const ok = await importStudentRow(studentCsv[i], i + 2);
    if (ok) studentsImported += 1;
  }
  console.log(`Students imported: ${studentsImported}/${studentCsv.length}`);

  console.log('\n=========== Import Summary ===========');
  console.log(`Faculty   : ${facultyIdByEmail.size}`);
  console.log(`Subjects  : ${subjectByCode.size}`);
  console.log(`Students  : ${studentsImported}`);
  if (errors.length > 0) {
    console.log(`\nSkipped / errors (${errors.length}):`);
    for (const e of errors) console.log(`  - ${e}`);
  } else {
    console.log('No errors.');
  }
  console.log('======================================');

  await mongoose.disconnect();
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
