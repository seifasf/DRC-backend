const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { registerAccess } = require('../middleware/register.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

/** Stricter cap for registration (still allows first-time bootstrap from same IP). */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.REGISTER_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Try again later.' },
});

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email')
    .isEmail({ require_tld: false })
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role')
    .isIn(['employee', 'admin', 'manager'])
    .withMessage('Invalid role'),
];

const loginValidation = [
  body('email')
    .isEmail({ require_tld: false })
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

router.post(
  '/register',
  registerLimiter,
  registerAccess,
  registerValidation,
  validateRequest,
  authController.register
);
router.post('/login', loginLimiter, loginValidation, validateRequest, authController.login);
router.post('/logout', verifyToken, authController.logout);
router.get('/me', verifyToken, authController.me);
router.patch('/change-password', verifyToken, changePasswordValidation, validateRequest, authController.changePassword);

module.exports = router;
