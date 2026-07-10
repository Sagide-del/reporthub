const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ['Mathematics', 'Biology', 'Chemistry', 'Physics', 'English', 'Kiswahili', 'CRE', 'Geography', 'Business', 'History'],
    required: true
  },
  cat1: { type: Number, min: 0, max: 100, default: 0 },
  cat2: { type: Number, min: 0, max: 100, default: 0 },
  endTerm: { type: Number, min: 0, max: 100, default: 0 },
  averageCat: { type: Number, default: 0 },
  finalScore: { type: Number, default: 0 },
  grade: {
    type: String,
    enum: ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'],
    default: 'E'
  },
  teacherComment: { type: String, default: '' }
});

const studentSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  admissionNumber: {
    type: String,
    required: true,
    trim: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  grade: {
    type: String,
    enum: ['Form 1', 'Form 2', 'Form 3', 'Form 4'],
    required: true
  },
  stream: {
    type: String,
    required: true,
    trim: true
  },
  term: {
    type: String,
    enum: ['Term 1', 'Term 2', 'Term 3'],
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  results: {
    subjects: [subjectSchema],
    totalScore: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    position: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    gradePoint: {
      type: String,
      enum: ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'E'],
      default: 'E'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Student', studentSchema);