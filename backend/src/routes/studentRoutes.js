const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// CRUD operations
router.post('/', studentController.addStudent);
router.get('/', studentController.getStudents);
router.get('/:id', studentController.getStudent);
router.put('/:id', studentController.updateStudent);
router.delete('/:id', studentController.deleteStudent);

module.exports = router;