const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      console.log('Protect: Verifying token...');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Protect: Decoded ID:', decoded.id);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        console.log('Protect: User not found');
        return res.status(401).json({ success: false, message: 'User not found' });
      }
      console.log('Protect: Auth Success');
      next();
    } catch (error) {
      console.error('Protect Error:', error);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an admin' });
  }
};

const ownerOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'owner')) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an owner or admin' });
  }
};

const ownerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'owner') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an owner' });
  }
};

module.exports = { protect, admin, ownerOrAdmin, ownerOnly };
