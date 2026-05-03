const User = require('../models/User.model');
const { verifyToken } = require('./auth.middleware');
const { allowRoles } = require('./role.middleware');

/**
 * First user in DB can register without auth; afterwards admin JWT required.
 */
const registerAccess = async (req, res, next) => {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      return next();
    }
    return verifyToken(req, res, () => allowRoles('admin')(req, res, next));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { registerAccess };
