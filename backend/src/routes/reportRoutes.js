const express = require('express');
const multer = require('multer');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');

// Configure multer for CSV upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// All routes require authentication
router.use(auth);

// Import results from CSV
router.post('/import', upload.single('file'), reportController.importResults);

// Generate report card
router.post('/generate/:studentId', reportController.generateReportCard);

module.exports = router;