const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Import routes
const schoolRoutes = require('./src/routes/schoolRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const reportRoutes = require('./src/routes/reportRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/reportHub')
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
  });

// Routes
app.use('/api/schools', schoolRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/reports', reportRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Report Hub API is running',
    status: '✅ Server and database are connected'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});