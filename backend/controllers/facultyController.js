const Faculty = require('../models/Faculty');
const User = require('../models/User');

exports.getAllFaculty = async (req, res) => {
  try {
    const { department, search } = req.query;
    const filter = {};
    if (department) filter.department = department;

    let faculty = await Faculty.find(filter)
      .populate('userId', 'name email status')
      .populate('assignedSubjects', 'name code');

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      faculty = faculty.filter(f =>
        f.employeeId.match(searchRegex) ||
        (f.userId && f.userId.name.match(searchRegex))
      );
    }

    res.json({ success: true, data: faculty });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getFacultyById = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate('userId', 'name email status')
      .populate('assignedSubjects', 'name code semester');
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }
    res.json({ success: true, data: faculty });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createFaculty = async (req, res) => {
  try {
    const { name, email, password, employeeId, department, assignedSubjects } = req.body;

    if (!name || !email || !password || !employeeId || !department) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const existingEmployee = await Faculty.findOne({ employeeId });
    if (existingEmployee) {
      return res.status(409).json({ success: false, message: 'Employee ID already exists' });
    }

    const user = await User.create({ name, email, password, role: 'faculty' });
    const faculty = await Faculty.create({
      userId: user._id,
      employeeId,
      department,
      assignedSubjects: assignedSubjects || []
    });

    res.status(201).json({ success: true, message: 'Faculty created', data: faculty });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateFaculty = async (req, res) => {
  try {
    const { name, email, department, assignedSubjects, status } = req.body;

    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found' });
    }

    if (email) {
      const existingEmail = await User.findOne({ email, _id: { $ne: faculty.userId } });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'Email already exists' });
      }
    }

    const userUpdate = {};
    if (name !== undefined) userUpdate.name = name;
    if (email !== undefined) userUpdate.email = email;
    if (status !== undefined) userUpdate.status = status;

    if (Object.keys(userUpdate).length) {
      await User.findByIdAndUpdate(faculty.userId, userUpdate);
    }

    const facultyUpdate = {};
    if (department !== undefined) facultyUpdate.department = department;
    if (assignedSubjects !== undefined) facultyUpdate.assignedSubjects = assignedSubjects;

    const updatedFaculty = await Faculty.findByIdAndUpdate(
      req.params.id,
      facultyUpdate,
      { new: true }
    )
      .populate('userId', 'name email status')
      .populate('assignedSubjects', 'name code');

    res.json({ success: true, message: 'Faculty updated', data: updatedFaculty });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getFacultySubjects = async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ userId: req.user._id }).populate('assignedSubjects');
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty profile not found' });
    }
    res.json({ success: true, data: faculty.assignedSubjects });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
