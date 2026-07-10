const Student = require('../models/Student');

// Add a new student
exports.addStudent = async (req, res) => {
  try {
    const studentData = {
      ...req.body,
      schoolId: req.schoolId
    };

    const student = new Student(studentData);
    await student.save();

    res.status(201).json({
      message: 'Student added successfully!',
      student
    });
  } catch (error) {
    console.error('Add student error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all students for a school
exports.getStudents = async (req, res) => {
  try {
    const { grade, stream, term } = req.query;
    const query = { schoolId: req.schoolId };
    
    if (grade) query.grade = grade;
    if (stream) query.stream = stream;
    if (term) query.term = term;

    const students = await Student.find(query).sort({ 'results.position': 1 });
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get a single student
exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      schoolId: req.schoolId
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update student
exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      schoolId: req.schoolId
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const updates = req.body;
    const allowedUpdates = ['firstName', 'lastName', 'grade', 'stream', 'results'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        student[field] = updates[field];
      }
    });

    await student.save();
    res.json({
      message: 'Student updated successfully!',
      student
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.schoolId
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ message: 'Student deleted successfully!' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: error.message });
  }
};