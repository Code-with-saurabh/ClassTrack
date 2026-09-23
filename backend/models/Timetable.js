const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  faculty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true
  },
  division: {
    type: String,
    required: [true, 'Division is required'],
    trim: true
  },
  day: {
    type: String,
    required: [true, 'Day is required'],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required']
  },
  room: {
    type: String,
    required: [true, 'Room is required'],
    trim: true
  },
  semester: {
    type: Number,
    required: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

timetableSchema.index({ division: 1, day: 1, semester: 1 });
timetableSchema.index({ faculty: 1, day: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);
