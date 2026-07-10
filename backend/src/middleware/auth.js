const jwt = require('jsonwebtoken');
const School = require('../models/School');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const school = await School.findById(decoded.schoolId).select('-password');
    
    if (!school) {
      return res.status(401).json({ error: 'Token is not valid' });
    }

    req.school = school;
    req.schoolId = school._id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Token is not valid' });
  }
};

module.exports = auth;