const OrderItem = require('../models/OrderItem.model');
const WorkOrder = require('../models/WorkOrder.model');
const Payment = require('../models/Payment.model');

/**
 * totalAmount = sum(order item subtotals) + sum(block line subtotals when lab supplies blocks).
 * Also re-syncs paymentStatus so it never goes stale after the total changes.
 */
async function recalculateWorkOrderAmount(workOrderId, options = {}) {
  const { session } = options;

  const itemQuery = OrderItem.find({ workOrderId });
  if (session) itemQuery.session(session);
  const items = await itemQuery;
  const testsTotal = items.reduce((acc, i) => acc + i.subtotal, 0);

  const woQuery = WorkOrder.findById(workOrderId);
  if (session) woQuery.session(session);
  const wo = await woQuery;
  if (!wo) return null;

  const mode = wo.blocksProvidedBy || 'customer';
  let blocksTotal = 0;
  if (mode === 'lab' && Array.isArray(wo.blockLines)) {
    blocksTotal = wo.blockLines.reduce((acc, line) => acc + (Number(line.subtotal) || 0), 0);
  }

  wo.totalAmount = testsTotal + blocksTotal;

  // Re-sync paymentStatus whenever totalAmount changes so it never goes stale.
  const agg = await Payment.aggregate([
    { $match: { workOrderId: wo._id } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const amountPaid = agg.length ? agg[0].total : 0;
  wo.amountPaid = amountPaid;
  if (amountPaid === 0) {
    wo.paymentStatus = 'unpaid';
  } else if (amountPaid < wo.totalAmount) {
    wo.paymentStatus = 'partial';
  } else {
    wo.paymentStatus = 'paid';
  }

  await wo.save({ session });
  return wo;
}

module.exports = recalculateWorkOrderAmount;
