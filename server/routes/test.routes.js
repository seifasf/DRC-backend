const express = require('express');
const { body, param } = require('express-validator');
const testController = require('../controllers/test.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const { optionalVerifyToken } = require('../middleware/optionalAuth.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const idParam = param('id').isMongoId().withMessage('Invalid test id');

const createTestValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('unitLabel').trim().notEmpty().withMessage('unitLabel is required'),
  body('pricePerUnit').optional().isFloat({ min: 0 }).withMessage('pricePerUnit must be non-negative'),
  body('pricingTiers').optional().isArray(),
  body('pricingComponents').optional().isArray(),
  body('machine').optional().isString(),
  body('machineId').optional().isMongoId().withMessage('machineId must be a valid id'),
  body('estimatedDaysPerUnit').optional().isFloat({ min: 0 }),
  body('isAvailable').optional().isBoolean(),
];

const updateTestValidation = [
  idParam,
  body('name').optional().trim().notEmpty(),
  body('category').optional().trim().notEmpty(),
  body('description').optional().trim().notEmpty(),
  body('unitLabel').optional().trim().notEmpty(),
  body('pricePerUnit').optional().isFloat({ min: 0 }),
  body('pricingTiers').optional().isArray(),
  body('pricingComponents').optional().isArray(),
  body('machine').optional().isString(),
  body('machineId').optional().isMongoId(),
  body('estimatedDaysPerUnit').optional().isFloat({ min: 0 }),
  body('isAvailable').optional().isBoolean(),
];

const updatePriceValidation = [
  idParam,
  body('pricePerUnit')
    .isFloat({ min: 0 })
    .withMessage('pricePerUnit must be a non-negative number'),
];

const bulkPricesValidation = [
  body('updates').isArray({ min: 1 }).withMessage('updates must be a non-empty array'),
  body('updates.*.testId').isMongoId().withMessage('Each update needs a valid testId'),
  body('updates.*.pricePerUnit')
    .isFloat({ min: 0 })
    .withMessage('Each pricePerUnit must be non-negative'),
];

router.get('/', optionalVerifyToken, testController.listTests);

router.patch(
  '/prices/bulk',
  verifyToken,
  allowRoles('admin'),
  bulkPricesValidation,
  validateRequest,
  testController.bulkUpdateTestPrices
);

router.get('/:id', optionalVerifyToken, idParam, validateRequest, testController.getTest);
router.post('/', verifyToken, allowRoles('admin'), createTestValidation, validateRequest, testController.createTest);

router.patch(
  '/:id/price',
  verifyToken,
  allowRoles('admin'),
  updatePriceValidation,
  validateRequest,
  testController.updateTestPrice
);

router.patch('/:id/toggle', verifyToken, allowRoles('admin'), idParam, validateRequest, testController.toggleTest);
router.patch('/:id', verifyToken, allowRoles('admin'), updateTestValidation, validateRequest, testController.updateTest);
router.delete('/:id', verifyToken, allowRoles('admin'), idParam, validateRequest, testController.deleteTest);

module.exports = router;
