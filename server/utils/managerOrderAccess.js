/**
 * Managers may not view or mutate work orders that are fully finished and paid.
 */

function isClosedOrder(order) {
  if (!order) return false;
  return order.status === 'completed' && order.paymentStatus === 'paid';
}

/**
 * @param {{ forMutation?: boolean }} opts — when true, managers cannot change closed (completed+paid) orders.
 * @returns {boolean} false if response was sent (403)
 */
function assertManagerCanAccessWorkOrder(req, res, order, opts = {}) {
  const forMutation = opts.forMutation === true;
  if (req.user?.role === 'manager' && forMutation && isClosedOrder(order)) {
    res.status(403).json({ success: false, message: 'Access denied.' });
    return false;
  }
  return true;
}

/** Completed, paid, not yet marked received by doctor (manager delivery queue). */
function managerCompletedDeliveryFilter() {
  return {
    status: 'completed',
    paymentStatus: 'paid',
    doctorReceivedOrder: { $ne: true },
  };
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
  managerCompletedDeliveryFilter,
};
