const OrderItem = require('../models/OrderItem.model');
const WorkOrder = require('../models/WorkOrder.model');

/**
 * totalAmount = sum(order item subtotals) + sum(block line subtotals when lab supplies blocks).
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
  await wo.save({ session });
  return wo;
}

module.exports = recalculateWorkOrderAmount;
