const express = require('express');
const { body, param } = require('express-validator');
const machineController = require('../controllers/machine.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const { optionalVerifyToken } = require('../middleware/optionalAuth.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

const idParam = param('id').isMongoId().withMessage('Invalid machine id');

const createValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').optional().isString(),
  body('isActive').optional().isBoolean(),
];

const updateValidation = [
  idParam,
  body('name').optional().trim().notEmpty(),
  body('description').optional().isString(),
  body('isActive').optional().isBoolean(),
];

router.get('/', optionalVerifyToken, machineController.listMachines);
router.get('/:id', optionalVerifyToken, idParam, validateRequest, machineController.getMachine);

router.post('/', verifyToken, allowRoles('admin'), createValidation, validateRequest, machineController.createMachine);
router.patch('/:id/toggle', verifyToken, allowRoles('admin'), idParam, validateRequest, machineController.toggleMachine);
router.patch('/:id', verifyToken, allowRoles('admin'), updateValidation, validateRequest, machineController.updateMachine);
router.delete('/:id', verifyToken, allowRoles('admin'), idParam, validateRequest, machineController.deleteMachine);

module.exports = router;
