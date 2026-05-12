/**
 * Managers may not view or mutate work orders that are fully finished and paid.
 */

function isClosedOrder(order) {
  if (!order) return false;
  return order.status === 'completed' && order.paymentStatus === 'paid';
}

/**
 * @returns {boolean} false if response was sent (403)
 */
function assertManagerCanAccessWorkOrder(req, res, order) {
  if (req.user?.role === 'manager' && isClosedOrder(order)) {
    res.status(403).json({ success: false, message: 'Access denied.' });
    return false;
  }
  return true;
}

/**
 * Mongo filter fragment: orders that are NOT (completed AND paid).
 */
function managerWorkOrderFilter() {
  return {
    $or: [{ status: { $ne: 'completed' } }, { paymentStatus: { $ne: 'paid' } }],
  };
}

module.exports = {
  isClosedOrder,
  assertManagerCanAccessWorkOrder,
  managerWorkOrderFilter,
};
