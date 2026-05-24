const OrderItem = require('../models/OrderItem.model');
const BlockProduct = require('../models/BlockProduct.model');
const WorkOrder = require('../models/WorkOrder.model');

/**
 * Lab block lines on a work order become assignable order items (one per block product).
 * Billing totals still use workOrder.blockLines; block order item subtotals are excluded from recalculate totals.
 */
async function syncBlockLineOrderItems(workOrderId, options = {}) {
  const { session } = options;
  const woQuery = WorkOrder.findById(workOrderId);
  if (session) woQuery.session(session);
  const wo = await woQuery;
  if (!wo) return [];

  const findOpts = session ? { session } : {};
  const blockItemFilter = { workOrderId, blockProductId: { $exists: true, $ne: null } };

  if (wo.blocksProvidedBy !== 'lab') {
    await OrderItem.deleteMany(blockItemFilter, findOpts);
    return [];
  }

  const lines = (wo.blockLines || []).filter((l) => Number(l.quantity) > 0);
  const activeBpIds = [];

  for (const line of lines) {
    const bpId = line.blockProductId?._id ?? line.blockProductId;
    if (!bpId) continue;
    activeBpIds.push(bpId);

    let bp = line.blockProductId;
    if (!bp || !bp.name) {
      const q = BlockProduct.findById(bpId);
      if (session) q.session(session);
      bp = await q.lean();
    }
    if (!bp) continue;

    const qty = Math.max(1, Math.round(Number(line.quantity)));
    const unitPrice = Number(line.unitPrice) || 0;
    const subtotal = Number(line.subtotal) ?? qty * unitPrice;

    const existingQuery = OrderItem.findOne({ workOrderId, blockProductId: bpId });
    if (session) existingQuery.session(session);
    const existing = await existingQuery;

    const payload = {
      quantity: qty,
      unitPrice,
      subtotal,
      pricingBreakdown: {
        mode: 'block',
        blockProductId: bpId,
        unitLabel: (bp.unitLabel || 'block').trim(),
        blockName: bp.name,
      },
    };

    if (existing) {
      existing.quantity = payload.quantity;
      existing.unitPrice = payload.unitPrice;
      existing.subtotal = payload.subtotal;
      existing.pricingBreakdown = payload.pricingBreakdown;
      if (session) await existing.save({ session });
      else await existing.save();
    } else {
      await OrderItem.create(
        [
          {
            workOrderId,
            blockProductId: bpId,
            ...payload,
            status: 'queued',
          },
        ],
        session ? { session } : {}
      );
    }
  }

  if (activeBpIds.length === 0) {
    await OrderItem.deleteMany(blockItemFilter, findOpts);
  } else {
    await OrderItem.deleteMany(
      { ...blockItemFilter, blockProductId: { $nin: activeBpIds } },
      findOpts
    );
  }

  const listQuery = OrderItem.find(blockItemFilter)
    .populate('blockProductId', 'name category unitLabel pricePerUnit')
    .populate('assignedTo', 'name email role');
  if (session) listQuery.session(session);
  return listQuery.lean();
}

module.exports = syncBlockLineOrderItems;
