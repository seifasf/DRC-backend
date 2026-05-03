const Payment = require('../models/Payment.model');
const WorkOrder = require('../models/WorkOrder.model');

/**
 * Recalculates workOrder.amountPaid from payments and sets paymentStatus.
 */
const recalcPaymentStatus = async (workOrderId) => {
  const workOrder = await WorkOrder.findById(workOrderId);
  if (!workOrder) return null;

  const agg = await Payment.aggregate([
    { $match: { workOrderId: workOrder._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const amountPaid = agg.length ? agg[0].total : 0;
  workOrder.amountPaid = amountPaid;

  if (amountPaid === 0) {
    workOrder.paymentStatus = 'unpaid';
  } else if (amountPaid < workOrder.totalAmount) {
    workOrder.paymentStatus = 'partial';
  } else {
    workOrder.paymentStatus = 'paid';
  }

  await workOrder.save();
  return workOrder;
};

module.exports = recalcPaymentStatus;
