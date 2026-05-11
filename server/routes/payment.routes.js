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

router.get('/', verifyToken, allowRoles('admin', 'employee'), paymentController.listPayments);

router.get(
  '/unpaid',
  verifyToken,
  allowRoles('admin', 'employee'),
  paymentController.unpaidWorkOrders
);

router.get(
  '/summary',
  verifyToken,
  allowRoles('admin', 'employee'),
  paymentController.summary
);

router.get(
  '/:workOrderId',
  verifyToken,
  allowRoles('admin', 'employee'),
  workOrderIdParam,
  validateRequest,
  paymentController.listByWorkOrder
);

// Employees record cash/bank/card collected on-site; admin can also record.
router.post(
  '/',
  verifyToken,
  allowRoles('admin', 'employee'),
  createPaymentValidation,
  validateRequest,
  paymentController.createPayment
);

module.exports = router;
