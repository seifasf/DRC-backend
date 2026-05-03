const express = require('express');
const { body, param } = require('express-validator');
const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const workOrderIdParam = param('workOrderId').isMongoId().withMessage('Invalid work order id');

const createPaymentValidation = [
  body('workOrderId').isMongoId().withMessage('workOrderId is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0'),
  body('method').isIn(['cash', 'bank_transfer', 'card', 'other']).withMessage('Invalid method'),
  body('paidAt').optional().isISO8601().toDate(),
  body('notes').optional().isString(),
];

router.get('/', verifyToken, allowRoles('admin'), paymentController.listPayments);

router.get(
  '/unpaid',
  verifyToken,
  allowRoles('admin'),
  paymentController.unpaidWorkOrders
);

router.get(
  '/summary',
  verifyToken,
  allowRoles('admin'),
  paymentController.summary
);

router.get(
  '/:workOrderId',
  verifyToken,
  allowRoles('admin', 'client'),
  workOrderIdParam,
  validateRequest,
  paymentController.listByWorkOrder
);

router.post(
  '/',
  verifyToken,
  allowRoles('admin'),
  createPaymentValidation,
  validateRequest,
  paymentController.createPayment
);

module.exports = router;
