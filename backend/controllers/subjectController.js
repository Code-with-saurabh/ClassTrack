const Subject = require('../models/Subject');

exports.getAllSubjects = async (req, res) => {
  try {
    const { semester, department } = req.query;
    const filter = {};
    if (semester) filter.semester = parseInt(semester);
    if (department) filter.department = department;

    const subjects = await Subject.find(filter).populate('faculty', 'employeeId').populate({
      path: 'faculty',
      populate: { path: 'userId', select: 'name' }
    });

    res.json({ success: true, data: subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('faculty');
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    res.json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createSubject = async (req, res) => {
  try {
    const { name, code, semester, department, faculty } = req.body;
    if (!name || !code || !semester || !department) {
      return res.status(400).json({ success: false, message: 'Name, code, semester, and department are required' });
    }

    const existingCode = await Subject.findOne({ code });
    if (existingCode) {
      return res.status(409).json({ success: false, message: 'Subject code already exists' });
    }

    const subject = await Subject.create({ name, code, semester, department, faculty });
    res.status(201).json({ success: true, message: 'Subject created', data: subject });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const { name, code, semester, department, faculty } = req.body;

    if (code) {
      const existingCode = await Subject.findOne({ code, _id: { $ne: req.params.id } });
      if (existingCode) {
        return res.status(409).json({ success: false, message: 'Subject code already exists' });
      }
    }

    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { name, code, semester, department, faculty },
      { new: true }
    );

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    res.json({ success: true, message: 'Subject updated', data: subject });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
