const express = require('express');
const { body, param, query } = require('express-validator');
const workOrderController = require('../controllers/workOrder.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const idParam = param('id').isMongoId().withMessage('Invalid work order id');

/** Skip per-item validators when order has no test lines (blocks-only orders). */
const hasOrderItems = (_value, { req }) =>
  Array.isArray(req.body.items) && req.body.items.length > 0;

/** Skip per-block validators when blockLines is empty (customer-provided blocks). */
const hasBlockLines = (_value, { req }) =>
  Array.isArray(req.body.blockLines) && req.body.blockLines.length > 0;

const createWorkOrderValidation = [
  body('doctorName').trim().notEmpty().withMessage('Doctor name is required'),
  body('doctorPhone').trim().notEmpty().withMessage('Doctor phone is required'),
  body('notes').optional().isString(),
  body('dueDate').optional().isISO8601().toDate(),
  body('items').default([]).isArray().withMessage('items must be an array'),
  body('items.*.testId')
    .if(hasOrderItems)
    .isMongoId()
    .withMessage('Each item needs valid testId'),
  body('items.*.quantity')
    .if(hasOrderItems)
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each item needs quantity >= 1 when sent'),
  body('items.*.assignedTo').if(hasOrderItems).optional().isMongoId(),
  body('items.*.pricingTierCode').if(hasOrderItems).optional().isString(),
  body('items.*.componentQuantities').if(hasOrderItems).optional().isObject(),
  body('items.*.componentUnitPrices').if(hasOrderItems).optional().isObject(),
  body('items.*.tierPriceOverride')
    .if(hasOrderItems)
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 }),
  body('items.*.simpleUnitPriceOverride')
    .if(hasOrderItems)
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 }),
  body('blocksProvidedBy')
    .isIn(['lab', 'customer'])
    .withMessage('blocksProvidedBy must be lab (we supply blocks) or customer (outsourced / client blocks)'),
  body('blockLines').default([]).isArray().withMessage('blockLines must be an array'),
  body('blockLines.*.blockProductId')
    .if(hasBlockLines)
    .isMongoId()
    .withMessage('Each block line needs blockProductId'),
  body('blockLines.*.quantity')
    .if(hasBlockLines)
    .isInt({ min: 0 })
    .withMessage('Each block line needs quantity >= 0'),
  body().custom((_, { req }) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    req.body.items = items;
    if (!Array.isArray(req.body.blockLines)) req.body.blockLines = [];
    const mode = req.body.blocksProvidedBy;
    const blockLines = req.body.blockLines;
    const hasTests = items.length > 0;
    const hasLabBlocks =
      mode === 'lab' &&
      blockLines.some((l) => l.blockProductId && Number(l.quantity) > 0);
    if (hasTests || hasLabBlocks || mode === 'customer') return true;
    throw new Error(
      'Add at least one test line or at least one lab block line with quantity.'
    );
  }),
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

const listWorkOrdersQuery = [
  query('doctorPhone').optional().isString().trim(),
  query('doctorName').optional().isString().trim(),
  query('scope').optional().isIn(['active', 'completed', 'all']).withMessage('Invalid scope'),
];

router.get(
  '/',
  verifyToken,
  allowRoles('admin', 'employee', 'manager'),
  listWorkOrdersQuery,
  validateRequest,
  workOrderController.listWorkOrders
);

router.get(
  '/:id',
  verifyToken,
  allowRoles('admin', 'employee', 'manager'),
  idParam,
  validateRequest,
  workOrderController.getWorkOrder
);

router.post(
  '/',
  verifyToken,
  allowRoles('admin', 'employee', 'manager'),
  createWorkOrderValidation,
  validateRequest,
  workOrderController.createWorkOrder
);

router.patch(
  '/:id/doctor-received',
  verifyToken,
  allowRoles('admin', 'manager'),
  idParam,
  validateRequest,
  workOrderController.markDoctorReceived
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
  allowRoles('admin', 'employee', 'manager'),
  updateWorkOrderValidation,
  validateRequest,
  workOrderController.updateWorkOrder
);

module.exports = router;
