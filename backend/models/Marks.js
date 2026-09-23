const mongoose = require('mongoose');

const marksSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  examType: {
    type: String,
    required: [true, 'Exam type is required'],
    trim: true
  },
  marksObtained: {
    type: Number,
    required: [true, 'Marks obtained is required'],
    min: 0
  },
  maximumMarks: {
    type: Number,
    required: [true, 'Maximum marks is required'],
    min: 1
  },
  academicYear: {
    type: String,
    required: true
  },
  semester: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

marksSchema.index({ student: 1, subject: 1, examType: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Marks', marksSchema);
