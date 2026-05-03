const express = require('express');
const { query } = require('express-validator');
const reportController = require('../controllers/report.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const validateRequest = require('../middleware/validateRequest.middleware');

const router = express.Router();

router.use(verifyToken, allowRoles('admin'));

const workTrackingQuery = [
  query('from').optional().isISO8601().withMessage('from must be a valid ISO 8601 date'),
  query('to').optional().isISO8601().withMessage('to must be a valid ISO 8601 date'),
];

/** Query: optional from=ISO8601, to=ISO8601 (filters work orders by createdAt) */
router.get('/work-tracking', workTrackingQuery, validateRequest, reportController.workTracking);

module.exports = router;
