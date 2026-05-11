const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '45d',
  });

exports.register = async (req, res) => {
  try {
    const count = await User.countDocuments();
    const isBootstrap = count === 0;

    if (!isBootstrap && (!req.user || req.user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'Only an admin can register new users.',
      });
    }

    const { name, email, password, role, phone, specialization } = req.body;

    if (!isBootstrap && role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot assign admin role.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: isBootstrap ? role || 'admin' : role,
      phone,
      specialization,
    });

    const userObj = user.toObject();
    delete userObj.password;

    return res.status(201).json({
      success: true,
      data: { user: userObj },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    const token = signToken(user._id);
    const userObj = user.toObject();
    delete userObj.password;

    return res.json({
      success: true,
      data: { user: userObj, token },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

exports.logout = async (req, res) => {
  return res.json({ success: true, data: { message: 'Logged out successfully.' } });
};

exports.me = async (req, res) => {
  try {
    return res.json({ success: true, data: { user: req.user } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ success: true, data: { message: 'Password updated successfully.' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
