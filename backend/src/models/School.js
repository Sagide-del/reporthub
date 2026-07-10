const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  schoolName: {
    type: String,
    required: [true, 'School name is required'],
    trim: true
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    county: { type: String, default: '' },
    postalCode: { type: String, default: '' }
  },
  logo: {
    type: String,
    default: null
  },
  subscription: {
    status: {
      type: String,
      enum: ['active', 'expired', 'pending'],
      default: 'pending'
    },
    expiryDate: Date,
    paymentHistory: [{
      amount: Number,
      date: { type: Date, default: Date.now },
      transactionId: String,
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
      }
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('School', schoolSchema);