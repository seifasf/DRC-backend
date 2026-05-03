const { validationResult } = require('express-validator');

/**
 * Returns 400 with first express-validator message when the chain has errors.
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const arr = errors.array();
    return res.status(400).json({
      success: false,
      message: arr[0]?.msg || 'Validation failed',
    });
  }
  next();
};

module.exports = validateRequest;
