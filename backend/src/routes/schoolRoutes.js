const express = require('express');
const multer = require('multer');
const router = express.Router();
const schoolController = require('../controllers/schoolController');
const auth = require('../middleware/auth');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Public routes
router.post('/register', schoolController.registerSchool);
router.post('/login', schoolController.loginSchool);

// Protected routes (require authentication)
router.get('/profile', auth, schoolController.getSchoolProfile);
router.put('/profile', auth, schoolController.updateSchoolProfile);
router.post('/upload-logo', auth, upload.single('logo'), schoolController.uploadLogo);

module.exports = router;