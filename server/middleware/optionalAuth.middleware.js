const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

/** Attaches req.user if valid Bearer token; otherwise continues without user */
const optionalVerifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.isActive) req.user = user;
  } catch {
    // ignore invalid token for optional routes
  }
  next();
};

module.exports = { optionalVerifyToken };
