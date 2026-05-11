const express = require('express');
const { body, param } = require('express-validator');
const appointmentController = require('../controllers/appointment.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const idParam = param('id').isMongoId().withMessage('Invalid appointment id');

const createValidation = [
  body('requestedDate').isISO8601().toDate().withMessage('requestedDate is required'),
  body('purpose').trim().notEmpty().withMessage('purpose is required'),
  body('notes').optional().isString(),
];

const confirmValidation = [
  idParam,
  body('confirmedDate').optional().isISO8601().toDate(),
  body('notes').optional().isString(),
];

router.get('/', verifyToken, allowRoles('admin'), appointmentController.listAppointments);

router.get('/my', verifyToken, allowRoles('employee'), appointmentController.myAppointments);

router.post(
  '/',
  verifyToken,
  allowRoles('employee'),
  createValidation,
  validateRequest,
  appointmentController.createAppointment
);

router.patch(
  '/:id/confirm',
  verifyToken,
  allowRoles('admin'),
  confirmValidation,
  validateRequest,
  appointmentController.confirmAppointment
);

router.patch(
  '/:id/cancel',
  verifyToken,
  allowRoles('admin', 'employee'),
  idParam,
  validateRequest,
  appointmentController.cancelAppointment
);

router.patch(
  '/:id/complete',
  verifyToken,
  allowRoles('admin'),
  idParam,
  validateRequest,
  appointmentController.completeAppointment
);

module.exports = router;
