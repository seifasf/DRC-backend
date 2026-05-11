const express = require('express');
const { body, param } = require('express-validator');
const blockProductController = require('../controllers/blockProduct.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const { optionalVerifyToken } = require('../middleware/optionalAuth.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const idParam = param('id').isMongoId().withMessage('Invalid block product id');

const createValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('pricePerUnit').isFloat({ min: 0 }).withMessage('pricePerUnit must be non-negative'),
  body('unitLabel').optional().isString(),
  body('currency').optional().isString(),
  body('isAvailable').optional().isBoolean(),
];

const updateValidation = [
  idParam,
  body('name').optional().trim().notEmpty(),
  body('category').optional().trim().notEmpty(),
  body('pricePerUnit').optional().isFloat({ min: 0 }),
  body('unitLabel').optional().isString(),
  body('currency').optional().isString(),
  body('isAvailable').optional().isBoolean(),
];

const updatePriceValidation = [
  idParam,
  body('pricePerUnit').isFloat({ min: 0 }).withMessage('pricePerUnit must be non-negative'),
  body('currency').optional().isString(),
];

const bulkPricesValidation = [
  body('updates').isArray({ min: 1 }).withMessage('updates must be a non-empty array'),
  body('updates.*.blockProductId').isMongoId(),
  body('updates.*.pricePerUnit').isFloat({ min: 0 }),
  body('updates.*.currency').optional().isString(),
];

router.get('/', optionalVerifyToken, blockProductController.listBlockProducts);

router.patch(
  '/prices/bulk',
  verifyToken,
  allowRoles('admin'),
  bulkPricesValidation,
  validateRequest,
  blockProductController.bulkUpdateBlockProductPrices
);

router.get('/:id', optionalVerifyToken, idParam, validateRequest, blockProductController.getBlockProduct);

router.post('/', verifyToken, allowRoles('admin'), createValidation, validateRequest, blockProductController.createBlockProduct);

router.patch(
  '/:id/price',
  verifyToken,
  allowRoles('admin'),
  updatePriceValidation,
  validateRequest,
  blockProductController.updateBlockProductPrice
);

router.patch('/:id/toggle', verifyToken, allowRoles('admin'), idParam, validateRequest, blockProductController.toggleBlockProduct);
router.patch('/:id', verifyToken, allowRoles('admin'), updateValidation, validateRequest, blockProductController.updateBlockProduct);
router.delete('/:id', verifyToken, allowRoles('admin'), idParam, validateRequest, blockProductController.deleteBlockProduct);

module.exports = router;
