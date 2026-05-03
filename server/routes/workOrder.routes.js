const express = require('express');
const { body, param, query } = require('express-validator');
const workOrderController = require('../controllers/workOrder.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const idParam = param('id').isMongoId().withMessage('Invalid work order id');
const clientIdParam = param('clientId').isMongoId().withMessage('Invalid client id');

const createWorkOrderValidation = [
  body('clientId').isMongoId().withMessage('Valid clientId is required'),
  body('doctorName').trim().notEmpty().withMessage('Doctor name is required'),
  body('doctorPhone').trim().notEmpty().withMessage('Doctor phone is required'),
  body('notes').optional().isString(),
  body('dueDate').optional().isISO8601().toDate(),
  body('items').isArray({ min: 1 }).withMessage('items array is required'),
  body('items.*.testId').isMongoId().withMessage('Each item needs valid testId'),
  body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Each item needs quantity >= 1 when sent'),
  body('items.*.assignedTo').optional().isMongoId(),
  body('items.*.pricingTierCode').optional().isString(),
  body('items.*.componentQuantities').optional().isObject(),
  body('blocksProvidedBy')
    .isIn(['lab', 'customer'])
    .withMessage('blocksProvidedBy must be lab (we supply blocks) or customer (outsourced / client blocks)'),
  body('blockLines').isArray().withMessage('blockLines is required — use [] if no blocks'),
  body('blockLines.*.blockProductId').isMongoId().withMessage('Each block line needs blockProductId'),
  body('blockLines.*.quantity').isInt({ min: 0 }).withMessage('Each block line needs quantity >= 0'),
];

const updateWorkOrderValidation = [
  idParam,
  body('doctorName').optional().trim().notEmpty(),
  body('doctorPhone').optional().trim().notEmpty(),
  body('notes').optional().isString(),
  body('dueDate').optional().isISO8601().toDate(),
  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  body('blocksProvidedBy').optional().isIn(['lab', 'customer']),
  body('blockLines').optional().isArray(),
  body('blockLines.*.blockProductId').optional().isMongoId(),
  body('blockLines.*.quantity').optional().isInt({ min: 0 }),
];

router.get(
  '/summary',
  verifyToken,
  allowRoles('admin'),
  workOrderController.summary
);

router.get(
  '/client/:clientId',
  verifyToken,
  allowRoles('admin', 'client'),
  clientIdParam,
  validateRequest,
  workOrderController.listByClient
);

const listWorkOrdersQuery = [
  query('doctorPhone').optional().isString().trim(),
  query('doctorName').optional().isString().trim(),
];

router.get(
  '/',
  verifyToken,
  allowRoles('admin', 'employee'),
  listWorkOrdersQuery,
  validateRequest,
  workOrderController.listWorkOrders
);

router.get(
  '/:id',
  verifyToken,
  allowRoles('admin', 'employee', 'client'),
  idParam,
  validateRequest,
  workOrderController.getWorkOrder
);

router.post(
  '/',
  verifyToken,
  allowRoles('admin', 'employee'),
  createWorkOrderValidation,
  validateRequest,
  workOrderController.createWorkOrder
);

router.patch(
  '/:id/cancel',
  verifyToken,
  allowRoles('admin'),
  idParam,
  validateRequest,
  workOrderController.cancelWorkOrder
);

router.patch(
  '/:id',
  verifyToken,
  allowRoles('admin', 'employee'),
  updateWorkOrderValidation,
  validateRequest,
  workOrderController.updateWorkOrder
);

module.exports = router;
