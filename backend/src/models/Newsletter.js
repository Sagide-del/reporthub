const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  term: {
    type: String,
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  content: {
    principalMessage: String,
    academicHighlights: String,
    sportsAndActivities: String,
    upcomingEvents: String,
    achievements: String,
    announcements: String
  },
  generatedDate: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Newsletter', newsletterSchema);