const Timetable = require('../models/Timetable');

exports.getAllTimetable = async (req, res) => {
  try {
    const { semester, department, division, day, subject } = req.query;
    const filter = {};
    if (semester) filter.semester = parseInt(semester);
    if (department) filter.department = department;
    if (division) filter.division = division;
    if (day) filter.day = day;
    if (subject) filter.subject = subject;

    if (req.user.role === 'student') {
      const Student = require('../models/Student');
      const student = await Student.findOne({ userId: req.user._id });
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found' });
      }
      filter.semester = student.semester;
      filter.department = student.department;
      filter.division = student.division;
    } else if (req.user.role === 'faculty') {
      const Faculty = require('../models/Faculty');
      const faculty = await Faculty.findOne({ userId: req.user._id });
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found' });
      }
      filter.faculty = faculty._id;
    }

    const timetable = await Timetable.find(filter)
      .populate('subject', 'name code')
      .populate('faculty')
      .populate({ path: 'faculty', populate: { path: 'userId', select: 'name' } })
      .sort({ day: 1, startTime: 1 });

    res.json({ success: true, data: timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getTodayTimetable = async (req, res) => {
  try {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];

    let filter = { day: today };

    if (req.user.role === 'student') {
      const Student = require('../models/Student');
      const student = await Student.findOne({ userId: req.user._id });
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found' });
      }
      filter.semester = student.semester;
      filter.department = student.department;
      filter.division = student.division;
    } else if (req.user.role === 'faculty') {
      const Faculty = require('../models/Faculty');
      const faculty = await Faculty.findOne({ userId: req.user._id });
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found' });
      }
      filter.faculty = faculty._id;
    }

    const timetable = await Timetable.find(filter)
      .populate('subject', 'name code')
      .populate('faculty')
      .populate({ path: 'faculty', populate: { path: 'userId', select: 'name' } })
      .sort({ startTime: 1 });

    res.json({ success: true, data: timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createTimetable = async (req, res) => {
  try {
    const { subject, faculty, division, day, startTime, endTime, room, semester, department } = req.body;

    if (!subject || !faculty || !division || !day || !startTime || !endTime || !room || !semester || !department) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const timetable = await Timetable.create({
      subject, faculty, division, day, startTime, endTime, room, semester, department
    });

    res.status(201).json({ success: true, message: 'Timetable entry created', data: timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateTimetable = async (req, res) => {
  try {
    const { subject, faculty, division, day, startTime, endTime, room, semester, department } = req.body;

    const timetable = await Timetable.findByIdAndUpdate(
      req.params.id,
      { subject, faculty, division, day, startTime, endTime, room, semester, department },
      { new: true }
    );

    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    res.json({ success: true, message: 'Timetable updated', data: timetable });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findByIdAndDelete(req.params.id);
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }
    res.json({ success: true, message: 'Timetable entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
