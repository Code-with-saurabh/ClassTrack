const Student = require('../models/Student');
const User = require('../models/User');

exports.getAllStudents = async (req, res) => {
  try {
    const { semester, department, division, search } = req.query;
    const filter = {};

    if (semester) filter.semester = parseInt(semester);
    if (department) filter.department = department;
    if (division) filter.division = division;

    let students = await Student.find(filter).populate('userId', 'name email status');

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      students = students.filter(s =>
        s.rollNumber.match(searchRegex) ||
        (s.userId && s.userId.name.match(searchRegex))
      );
    }

    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('userId', 'name email status');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const { name, email, password, rollNumber, semester, division, department, academicYear } = req.body;

    if (!name || !email || !password || !rollNumber || !semester || !division || !department || !academicYear) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const existingRoll = await Student.findOne({ rollNumber });
    if (existingRoll) {
      return res.status(409).json({ success: false, message: 'Roll number already exists' });
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

    res.status(201).json({ success: true, message: 'Student created', data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const { name, email, rollNumber, semester, division, department, academicYear, status } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    if (rollNumber && rollNumber !== student.rollNumber) {
      const existingRoll = await Student.findOne({ rollNumber });
      if (existingRoll) {
        return res.status(409).json({ success: false, message: 'Roll number already exists' });
      }
    }

    if (email) {
      const existingEmail = await User.findOne({ email, _id: { $ne: student.userId } });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'Email already exists' });
      }
    }

    const userUpdate = {};
    if (name !== undefined) userUpdate.name = name;
    if (email !== undefined) userUpdate.email = email;
    if (status !== undefined) userUpdate.status = status;

    if (Object.keys(userUpdate).length) {
      await User.findByIdAndUpdate(student.userId, userUpdate);
    }

    const studentUpdate = {};
    if (rollNumber !== undefined) studentUpdate.rollNumber = rollNumber;
    if (semester !== undefined) studentUpdate.semester = semester;
    if (division !== undefined) studentUpdate.division = division;
    if (department !== undefined) studentUpdate.department = department;
    if (academicYear !== undefined) studentUpdate.academicYear = academicYear;

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      studentUpdate,
      { new: true }
    ).populate('userId', 'name email status');

    res.json({ success: true, message: 'Student updated', data: updatedStudent });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await User.findByIdAndDelete(student.userId);
    await Student.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getOwnProfile = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).populate('userId', 'name email');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
