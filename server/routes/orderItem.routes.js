const express = require('express');
const { body, param } = require('express-validator');
const orderItemController = require('../controllers/orderItem.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const workOrderIdParam = param('workOrderId').isMongoId().withMessage('Invalid work order id');
const itemIdParam = param('id').isMongoId().withMessage('Invalid order item id');

const addItemValidation = [
  workOrderIdParam,
  body('testId').isMongoId().withMessage('Valid testId is required'),
  body('quantity').optional().isInt({ min: 1 }),
  body('pricingTierCode').optional().isString(),
  body('componentQuantities').optional().isObject(),
  body('assignedTo').optional().isMongoId(),
];

const assignValidation = [
  itemIdParam,
  body('assignedTo').isMongoId().withMessage('assignedTo is required'),
];

const statusValidation = [
  itemIdParam,
  body('status').isIn(['queued', 'in_progress', 'done']).withMessage('Invalid status'),
];

const staff = [verifyToken, allowRoles('admin', 'employee')];

router.get('/:workOrderId', ...staff, workOrderIdParam, validateRequest, orderItemController.listByWorkOrder);
router.post('/:workOrderId', ...staff, addItemValidation, validateRequest, orderItemController.addOrderItem);
router.patch('/:id/assign', ...staff, assignValidation, validateRequest, orderItemController.assignOrderItem);
router.patch('/:id/status', ...staff, statusValidation, validateRequest, orderItemController.updateOrderItemStatus);
router.delete('/:id', verifyToken, allowRoles('admin'), itemIdParam, validateRequest, orderItemController.deleteOrderItem);

module.exports = router;
