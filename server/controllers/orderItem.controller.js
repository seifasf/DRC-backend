const OrderItem = require('../models/OrderItem.model');
const WorkOrder = require('../models/WorkOrder.model');
const Test = require('../models/Test.model');
const User = require('../models/User.model');
const recalculateWorkOrderAmount = require('../utils/recalculateWorkOrderAmount');
const syncBlockLineOrderItems = require('../utils/syncBlockLineOrderItems');
const resolveOrderLinePricing = require('../utils/resolveOrderLinePricing');
const { assertManagerCanAccessWorkOrder } = require('../utils/managerOrderAccess');
const {
  isStaffPricingActor,
  recordStaffLinePricingEdit,
} = require('../utils/staffLinePricingWorkOrder');

const syncWorkOrderProgress = async (workOrderId) => {
  const items = await OrderItem.find({ workOrderId });
  const wo = await WorkOrder.findById(workOrderId);
  if (!wo || wo.status === 'cancelled') return;

  const allDone = items.length > 0 && items.every((i) => i.status === 'done');
  if (allDone) {
    wo.status = 'completed';
    await wo.save();
  } else if (items.some((i) => i.status === 'in_progress' || i.status === 'done')) {
    if (wo.status === 'pending') wo.status = 'in_progress';
    await wo.save();
  }
};

function buildPricingPayloadForOverrides(req, body) {
  const role = req.user.role;
  const allow = role === 'employee' || role === 'manager' || role === 'admin';
  if (!allow) return {};
  return {
    ...(body.componentUnitPrices &&
    typeof body.componentUnitPrices === 'object' &&
    !Array.isArray(body.componentUnitPrices)
      ? { componentUnitPrices: body.componentUnitPrices }
      : {}),
    ...(body.tierPriceOverride != null && body.tierPriceOverride !== ''
      ? { tierPriceOverride: body.tierPriceOverride }
      : {}),
    ...(body.simpleUnitPriceOverride != null && body.simpleUnitPriceOverride !== ''
      ? { simpleUnitPriceOverride: body.simpleUnitPriceOverride }
      : {}),
  };
}

function buildLineInputFromBody(test, item, body) {
  const bd = item.pricingBreakdown || {};
  const tiers = test.pricingTiers?.length;
  const comps = test.pricingComponents?.length;

  if (tiers) {
    return {
      quantity:
        body.quantity != null && body.quantity !== ''
          ? Number(body.quantity)
          : item.quantity,
      pricingTierCode: body.pricingTierCode ?? bd.tierCode,
    };
  }

  if (comps) {
    const cq = body.componentQuantities && typeof body.componentQuantities === 'object' ? body.componentQuantities : {};
    const merged = {};
    for (const c of test.pricingComponents) {
      if (cq[c.code] != null && cq[c.code] !== '') {
        merged[c.code] = Number(cq[c.code]);
      } else if (bd.components?.[c.code]?.quantity != null) {
        merged[c.code] = Number(bd.components[c.code].quantity);
      } else {
        merged[c.code] = 0;
      }
    }
    const line = { componentQuantities: merged };
    if (body.quantity != null && body.quantity !== '') {
      line.quantity = Number(body.quantity);
    }
    return line;
  }

  return {
    quantity:
      body.quantity != null && body.quantity !== ''
        ? Number(body.quantity)
        : item.quantity,
  };
}

exports.listMyOrderItems = async (req, res) => {
  try {
    const filter = { assignedTo: req.user._id };
    const { status, workOrderStatus } = req.query;
    if (status && ['queued', 'in_progress', 'done'].includes(String(status))) {
      filter.status = status;
    }

    let items = await OrderItem.find(filter)
      .populate('testId', 'name category unitLabel pricePerUnit pricingTiers pricingComponents allowOrderUnitPriceOverride')
      .populate('blockProductId', 'name category unitLabel pricePerUnit')
      .populate('workOrderId', 'orderCode doctorName doctorPhone status paymentStatus totalAmount')
      .sort({ updatedAt: -1 })
      .lean();

    if (workOrderStatus && String(workOrderStatus).trim()) {
      const ws = String(workOrderStatus).trim();
      items = items.filter((it) => it.workOrderId && it.workOrderId.status === ws);
    }

    return res.json({ success: true, data: { orderItems: items } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.listByWorkOrder = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder) {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }
    if (!assertManagerCanAccessWorkOrder(req, res, workOrder)) return;

    let items = await OrderItem.find({ workOrderId })
      .populate('testId')
      .populate('blockProductId', 'name category unitLabel pricePerUnit')
      .populate('assignedTo', 'name email role')
      .lean();

    const hasLabBlocks =
      workOrder.blocksProvidedBy === 'lab' &&
      (workOrder.blockLines || []).some((l) => Number(l.quantity) > 0);
    if (items.length === 0 && hasLabBlocks) {
      await syncBlockLineOrderItems(workOrderId);
      items = await OrderItem.find({ workOrderId })
        .populate('testId')
        .populate('blockProductId', 'name category unitLabel pricePerUnit')
        .populate('assignedTo', 'name email role')
        .lean();
    }

    return res.json({ success: true, data: { orderItems: items } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.addOrderItem = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder || workOrder.status === 'cancelled') {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }

    if (!assertManagerCanAccessWorkOrder(req, res, workOrder)) return;

    const test = await Test.findById(req.body.testId);
    if (!test || !test.isAvailable) {
      return res.status(400).json({ success: false, message: 'Invalid or unavailable test.' });
    }

    let priced;
    try {
      priced = resolveOrderLinePricing(
        test,
        {
          quantity: req.body.quantity,
          pricingTierCode: req.body.pricingTierCode,
          componentQuantities: req.body.componentQuantities,
          ...buildPricingPayloadForOverrides(req, req.body),
        },
        { relaxSampleOverrideRules: req.user.role === 'manager' }
      );
    } catch (e) {
      if (e.status === 400) {
        return res.status(400).json({ success: false, message: `${test.name}: ${e.message}` });
      }
      throw e;
    }

    const item = await OrderItem.create({
      workOrderId,
      testId: test._id,
      quantity: priced.quantity,
      unitPrice: priced.unitPrice,
      subtotal: priced.subtotal,
      pricingBreakdown: priced.pricingBreakdown,
      assignedTo: req.body.assignedTo || undefined,
      status: req.body.assignedTo ? 'in_progress' : 'queued',
    });

    if (workOrder.status === 'pending') workOrder.status = 'in_progress';
    await workOrder.save();
    await recalculateWorkOrderAmount(workOrderId);

    const overridePayload = buildPricingPayloadForOverrides(req, req.body);
    if (isStaffPricingActor(req.user.role) && Object.keys(overridePayload).length > 0) {
      await recordStaffLinePricingEdit(workOrderId, req.user._id);
    }

    const populated = await OrderItem.findById(item._id)
      .populate('testId')
      .populate('assignedTo', 'name email');

    return res.status(201).json({ success: true, data: { orderItem: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.assignOrderItem = async (req, res) => {
  try {
    const item = await OrderItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found.' });
    }

    const workOrder = await WorkOrder.findById(item.workOrderId);
    if (!workOrder) {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }
    if (!assertManagerCanAccessWorkOrder(req, res, workOrder)) return;

    const assignee = await User.findById(req.body.assignedTo);
    if (!assignee || (assignee.role !== 'employee' && assignee.role !== 'manager')) {
      return res.status(400).json({
        success: false,
        message: 'Must assign to lab staff (employee or manager).',
      });
    }

    item.assignedTo = assignee._id;
    if (item.status === 'queued') item.status = 'in_progress';
    await item.save();

    await syncWorkOrderProgress(item.workOrderId);

    const populated = await OrderItem.findById(item._id)
      .populate('testId')
      .populate('blockProductId', 'name category unitLabel pricePerUnit')
      .populate('assignedTo', 'name email');

    return res.json({ success: true, data: { orderItem: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateOrderItemStatus = async (req, res) => {
  try {
    const item = await OrderItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found.' });
    }

    const workOrder = await WorkOrder.findById(item.workOrderId);
    if (!workOrder) {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }
    if (!assertManagerCanAccessWorkOrder(req, res, workOrder)) return;

    item.status = req.body.status;
    await item.save();
    await syncWorkOrderProgress(item.workOrderId);

    const populated = await OrderItem.findById(item._id)
      .populate('testId')
      .populate('assignedTo', 'name email');

    return res.json({ success: true, data: { orderItem: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateOrderItemLine = async (req, res) => {
  try {
    const item = await OrderItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found.' });
    }

    const workOrder = await WorkOrder.findById(item.workOrderId);
    if (!workOrder || workOrder.status === 'cancelled') {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }

    if (!assertManagerCanAccessWorkOrder(req, res, workOrder)) return;

    const test = await Test.findById(item.testId);
    if (!test || !test.isAvailable) {
      return res.status(400).json({ success: false, message: 'Invalid or unavailable test.' });
    }

    const baseLine = buildLineInputFromBody(test, item, req.body);
    let priced;
    try {
      priced = resolveOrderLinePricing(
        test,
        {
          ...baseLine,
          ...buildPricingPayloadForOverrides(req, req.body),
        },
        { relaxSampleOverrideRules: req.user.role === 'manager' }
      );
    } catch (e) {
      if (e.status === 400) {
        return res.status(400).json({ success: false, message: `${test.name}: ${e.message}` });
      }
      throw e;
    }

    item.quantity = priced.quantity;
    item.unitPrice = priced.unitPrice;
    item.subtotal = priced.subtotal;
    item.pricingBreakdown = priced.pricingBreakdown;
    if (item.completedUnits > item.quantity) {
      item.completedUnits = item.quantity;
    }

    await item.save();
    await recalculateWorkOrderAmount(item.workOrderId);
    await syncWorkOrderProgress(item.workOrderId);

    const overridePayload = buildPricingPayloadForOverrides(req, req.body);
    if (isStaffPricingActor(req.user.role) && Object.keys(overridePayload).length > 0) {
      await recordStaffLinePricingEdit(item.workOrderId, req.user._id);
    }

    const populated = await OrderItem.findById(item._id)
      .populate('testId')
      .populate('assignedTo', 'name email');

    return res.json({ success: true, data: { orderItem: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.deleteOrderItem = async (req, res) => {
  try {
    const item = await OrderItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found.' });
    }

    const workOrder = await WorkOrder.findById(item.workOrderId);
    if (workOrder && !assertManagerCanAccessWorkOrder(req, res, workOrder)) return;

    const wid = item.workOrderId;
    await item.deleteOne();
    await recalculateWorkOrderAmount(wid);
    return res.json({ success: true, data: { message: 'Order item deleted.' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
