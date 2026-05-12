const express = require('express');
const { body, param } = require('express-validator');
const userController = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

router.use(verifyToken, allowRoles('admin'));

const mongoId = param('id').isMongoId().withMessage('Invalid user id');

const updateUserValidation = [
  mongoId,
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString(),
  body('specialization').optional().isString(),
  body('role').optional().isIn(['employee', 'admin', 'manager']),
];

router.get('/', userController.listUsers);
router.get('/:id', mongoId, validateRequest, userController.getUser);
router.patch('/:id', updateUserValidation, validateRequest, userController.updateUser);
router.patch('/:id/deactivate', mongoId, validateRequest, userController.deactivateUser);

module.exports = router;
