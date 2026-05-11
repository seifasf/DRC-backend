const OrderItem = require('../models/OrderItem.model');
const WorkOrder = require('../models/WorkOrder.model');
const Test = require('../models/Test.model');
const User = require('../models/User.model');
const recalculateWorkOrderAmount = require('../utils/recalculateWorkOrderAmount');
const resolveOrderLinePricing = require('../utils/resolveOrderLinePricing');

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

exports.listByWorkOrder = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const items = await OrderItem.find({ workOrderId })
      .populate('testId')
      .populate('assignedTo', 'name email role')
      .lean();

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

    const test = await Test.findById(req.body.testId);
    if (!test || !test.isAvailable) {
      return res.status(400).json({ success: false, message: 'Invalid or unavailable test.' });
    }

    let priced;
    try {
      priced = resolveOrderLinePricing(test, {
        quantity: req.body.quantity,
        pricingTierCode: req.body.pricingTierCode,
        componentQuantities: req.body.componentQuantities,
      });
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

    const assignee = await User.findById(req.body.assignedTo);
    if (!assignee || assignee.role !== 'employee') {
      return res.status(400).json({ success: false, message: 'Must assign to an employee user.' });
    }

    item.assignedTo = assignee._id;
    if (item.status === 'queued') item.status = 'in_progress';
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

exports.updateOrderItemStatus = async (req, res) => {
  try {
    const item = await OrderItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found.' });
    }

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

exports.deleteOrderItem = async (req, res) => {
  try {
    const item = await OrderItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found.' });
    }

    const wid = item.workOrderId;
    await item.deleteOne();
    await recalculateWorkOrderAmount(wid);
    return res.json({ success: true, data: { message: 'Order item deleted.' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
