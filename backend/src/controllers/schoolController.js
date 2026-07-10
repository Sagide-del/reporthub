const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const School = require('../models/School');

// Register a new school
exports.registerSchool = async (req, res) => {
  try {
    const { schoolName, registrationNumber, email, password, phone, address } = req.body;

    // Check if school already exists
    const existingSchool = await School.findOne({ 
      $or: [{ email }, { registrationNumber }] 
    });
    
    if (existingSchool) {
      return res.status(400).json({ 
        error: 'School already registered with this email or registration number' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new school
    const school = new School({
      schoolName,
      registrationNumber,
      email,
      password: hashedPassword,
      phone,
      address: address || {},
      subscription: {
        status: 'pending'
      }
    });

    await school.save();

    // Generate JWT token
    const token = jwt.sign(
      { schoolId: school._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'School registered successfully!',
      token,
      school: {
        id: school._id,
        schoolName: school.schoolName,
        email: school.email,
        phone: school.phone,
        subscription: school.subscription
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Login school
exports.loginSchool = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find school by email
    const school = await School.findOne({ email });
    if (!school) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, school.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { schoolId: school._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      school: {
        id: school._id,
        schoolName: school.schoolName,
        email: school.email,
        phone: school.phone,
        logo: school.logo,
        subscription: school.subscription
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get school profile
exports.getSchoolProfile = async (req, res) => {
  try {
    const school = await School.findById(req.schoolId).select('-password');
    res.json(school);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update school profile
exports.updateSchoolProfile = async (req, res) => {
  try {
    const updates = req.body;
    const school = await School.findById(req.schoolId);
    
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Update allowed fields
    const allowedUpdates = ['schoolName', 'phone', 'address'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        school[field] = updates[field];
      }
    });

    await school.save();
    res.json({
      message: 'Profile updated successfully!',
      school: {
        id: school._id,
        schoolName: school.schoolName,
        email: school.email,
        phone: school.phone,
        address: school.address,
        logo: school.logo
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Upload school logo
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a file' });
    }

    const school = await School.findById(req.schoolId);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    school.logo = req.file.path;
    await school.save();

    res.json({
      message: 'Logo uploaded successfully!',
      logo: school.logo
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: error.message });
  }
};