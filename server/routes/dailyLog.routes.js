const express = require('express');
const { body, param } = require('express-validator');
const dailyLogController = require('../controllers/dailyLog.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const workOrderIdParam = param('workOrderId').isMongoId().withMessage('Invalid work order id');
const empIdParam = param('empId').isMongoId().withMessage('Invalid employee id');

const createLogValidation = [
  body('orderItemId').isMongoId().withMessage('orderItemId is required'),
  body('date').optional().isISO8601().toDate(),
  body('unitsCompleted').isInt({ min: 0 }).withMessage('unitsCompleted must be a non-negative integer'),
  body('notes').optional().isString(),
];

router.get('/', verifyToken, allowRoles('admin'), dailyLogController.listDailyLogs);

router.get(
  '/my-logs',
  verifyToken,
  allowRoles('employee'),
  dailyLogController.myLogs
);

router.post(
  '/',
  verifyToken,
  allowRoles('employee', 'admin'),
  createLogValidation,
  validateRequest,
  dailyLogController.createDailyLog
);

router.get(
  '/by-order/:workOrderId',
  verifyToken,
  allowRoles('admin', 'employee'),
  workOrderIdParam,
  validateRequest,
  dailyLogController.byWorkOrder
);

router.get(
  '/employee/:empId',
  verifyToken,
  allowRoles('admin'),
  empIdParam,
  validateRequest,
  dailyLogController.byEmployee
);

module.exports = router;
