const mongoose = require('mongoose');
const WorkOrder = require('../models/WorkOrder.model');
const OrderItem = require('../models/OrderItem.model');
const Test = require('../models/Test.model');
const buildWorkOrderBlockLines = require('../utils/buildWorkOrderBlockLines');
const recalculateWorkOrderAmount = require('../utils/recalculateWorkOrderAmount');
const resolveOrderLinePricing = require('../utils/resolveOrderLinePricing');
const {
  assertManagerCanAccessWorkOrder,
  managerWorkOrderFilter,
  managerCompletedDeliveryFilter,
} = require('../utils/managerOrderAccess');
const {
  bodyHasPricingOverrideFields,
  isStaffPricingActor,
} = require('../utils/staffLinePricingWorkOrder');

const populateWorkOrder = [
  { path: 'createdBy', select: 'name email role' },
  { path: 'staffLinePricingBy', select: 'name email' },
  { path: 'doctorReceivedBy', select: 'name email' },
  {
    path: 'blockLines.blockProductId',
    select: 'name category unitLabel pricePerUnit currency isAvailable',
  },
];

exports.listWorkOrders = async (req, res) => {
  try {
    const filter = {};
    const doctorPhoneQ = req.query.doctorPhone != null ? String(req.query.doctorPhone).trim() : '';
    if (doctorPhoneQ) {
      filter.doctorPhone = doctorPhoneQ;
    }
    const doctorNameQ = req.query.doctorName != null ? String(req.query.doctorName).trim() : '';
    if (doctorNameQ) {
      filter.doctorName = new RegExp(doctorNameQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    const scope = req.query.scope ? String(req.query.scope).trim() : '';
    if (scope === 'active') {
      filter.status = { $in: ['pending', 'in_progress'] };
    } else if (scope === 'completed') {
      if (req.user.role === 'admin') {
        filter.status = 'completed';
        filter.paymentStatus = 'paid';
      } else if (req.user.role === 'manager') {
        Object.assign(filter, managerCompletedDeliveryFilter());
      } else {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    } else if (req.user.role === 'manager') {
      filter.$and = [...(filter.$and || []), managerWorkOrderFilter()];
    }

    const orders = await WorkOrder.find(filter)
      .populate(populateWorkOrder)
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, data: { workOrders: orders } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getWorkOrder = async (req, res) => {
  try {
    const order = await WorkOrder.findById(req.params.id).populate(populateWorkOrder).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }

    if (!assertManagerCanAccessWorkOrder(req, res, order)) return;

    return res.json({ success: true, data: { workOrder: order } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createWorkOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { doctorName, doctorPhone, notes, dueDate, blocksProvidedBy, blockLines } = req.body;
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    let testsTotal = 0;
    const linePayloads = [];

    for (const line of items) {
      const test = await Test.findById(line.testId).session(session);
      if (!test || !test.isAvailable) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: `Invalid or unavailable test: ${line.testId}` });
      }

      let priced;
      try {
        priced = resolveOrderLinePricing(
          test,
          {
            quantity: line.quantity,
            pricingTierCode: line.pricingTierCode,
            componentQuantities: line.componentQuantities,
            ...(req.user.role === 'employee' || req.user.role === 'manager'
              ? {
                  ...(line.componentUnitPrices &&
                  typeof line.componentUnitPrices === 'object' &&
                  !Array.isArray(line.componentUnitPrices)
                    ? { componentUnitPrices: line.componentUnitPrices }
                    : {}),
                  ...(line.tierPriceOverride != null && line.tierPriceOverride !== ''
                    ? { tierPriceOverride: line.tierPriceOverride }
                    : {}),
                  ...(line.simpleUnitPriceOverride != null && line.simpleUnitPriceOverride !== ''
                    ? { simpleUnitPriceOverride: line.simpleUnitPriceOverride }
                    : {}),
                }
              : {}),
          },
          { relaxSampleOverrideRules: req.user.role === 'manager' }
        );
      } catch (e) {
        await session.abortTransaction();
        if (e.status === 400) {
          return res.status(400).json({ success: false, message: `${test.name}: ${e.message}` });
        }
        throw e;
      }

      testsTotal += priced.subtotal;
      linePayloads.push({
        testId: test._id,
        quantity: priced.quantity,
        unitPrice: priced.unitPrice,
        subtotal: priced.subtotal,
        pricingBreakdown: priced.pricingBreakdown,
        assignedTo: line.assignedTo || undefined,
        status: line.assignedTo ? 'in_progress' : 'queued',
      });
    }

    let resolvedBlockLines = [];
    let blocksTotal = 0;
    try {
      const built = await buildWorkOrderBlockLines(blocksProvidedBy, blockLines, session);
      resolvedBlockLines = built.lines;
      blocksTotal = built.blocksTotal;
    } catch (e) {
      await session.abortTransaction();
      if (e.status === 400) {
        return res.status(400).json({ success: false, message: e.message });
      }
      throw e;
    }

    const hasLabBlocks = resolvedBlockLines.some((l) => Number(l.quantity) > 0);
    if (linePayloads.length === 0 && blocksProvidedBy === 'lab' && !hasLabBlocks) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message:
          'Add at least one test line or at least one lab block line with quantity.',
      });
    }

    const staffPricingOnCreate =
      isStaffPricingActor(req.user.role) && items.some((line) => bodyHasPricingOverrideFields(line));

    const [workOrder] = await WorkOrder.create(
      [
        {
          doctorName: String(doctorName).trim(),
          doctorPhone: String(doctorPhone).trim(),
          createdBy: req.user._id,
          notes,
          dueDate,
          blocksProvidedBy,
          blockLines: resolvedBlockLines,
          totalAmount: testsTotal + blocksTotal,
          status: 'pending',
          paymentStatus: 'unpaid',
          amountPaid: 0,
          ...(staffPricingOnCreate
            ? {
                staffLinePricingUsed: true,
                staffLinePricingAt: new Date(),
                staffLinePricingBy: req.user._id,
              }
            : {}),
        },
      ],
      { session }
    );

    const orderItems = linePayloads.map((p) => ({
      ...p,
      workOrderId: workOrder._id,
    }));

    await OrderItem.insertMany(orderItems, { session });

    if (linePayloads.some((p) => p.status === 'in_progress')) {
      workOrder.status = 'in_progress';
      await workOrder.save({ session });
    }

    await session.commitTransaction();

    await recalculateWorkOrderAmount(workOrder._id);

    const populated = await WorkOrder.findById(workOrder._id).populate(populateWorkOrder);
    const createdItems = await OrderItem.find({ workOrderId: workOrder._id })
      .populate('testId')
      .populate('assignedTo', 'name email');

    return res.status(201).json({
      success: true,
      data: { workOrder: populated, orderItems: createdItems },
    });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    session.endSession();
  }
};

exports.updateWorkOrder = async (req, res) => {
  try {
    const order = await WorkOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }

    if (!assertManagerCanAccessWorkOrder(req, res, order, { forMutation: true })) return;

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot update a cancelled order.' });
    }

    if (req.user.role === 'employee' && req.body.status === 'cancelled') {
      return res.status(403).json({
        success: false,
        message: 'Employees cannot cancel work orders.',
      });
    }

    if (req.user.role === 'manager' && req.body.status === 'cancelled') {
      return res.status(403).json({
        success: false,
        message: 'Managers cannot cancel work orders.',
      });
    }

    if (req.user.role === 'employee' && req.body.status != null) {
      const s = String(req.body.status);
      if (s === 'completed' || s === 'cancelled') {
        return res.status(403).json({
          success: false,
          message: 'Employees cannot set this status on work orders.',
        });
      }
    }

    const blockPayloadChanged =
      req.body.blocksProvidedBy !== undefined || req.body.blockLines !== undefined;

    if (blockPayloadChanged) {
      const mode =
        req.body.blocksProvidedBy ??
        order.blocksProvidedBy ??
        'customer';

      let rawLines;
      if (req.body.blockLines !== undefined) {
        rawLines = req.body.blockLines;
      } else {
        rawLines = (order.blockLines || []).map((l) => ({
          blockProductId: l.blockProductId?._id ?? l.blockProductId,
          quantity: l.quantity,
        }));
      }

      try {
        const { lines } = await buildWorkOrderBlockLines(mode, rawLines, null);
        order.blocksProvidedBy = mode;
        order.blockLines = lines;
      } catch (e) {
        if (e.status === 400) {
          return res.status(400).json({ success: false, message: e.message });
        }
        throw e;
      }
    }

    const allowed = ['notes', 'dueDate', 'status', 'doctorName', 'doctorPhone'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'notes' && typeof req.body[key] === 'string') {
          order[key] = req.body[key];
        } else {
          order[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
        }
      }
    }

    await order.save();
    await recalculateWorkOrderAmount(order._id);

    const populated = await WorkOrder.findById(order._id).populate(populateWorkOrder);
    return res.json({ success: true, data: { workOrder: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.markDoctorReceived = async (req, res) => {
  try {
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const order = await WorkOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }

    if (order.status !== 'completed' || order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Only completed and fully paid orders can be marked as received by the doctor.',
      });
    }

    if (order.doctorReceivedOrder) {
      const already = await WorkOrder.findById(order._id).populate([
        ...populateWorkOrder,
        { path: 'doctorReceivedBy', select: 'name email' },
      ]);
      return res.json({ success: true, data: { workOrder: already } });
    }

    order.doctorReceivedOrder = true;
    order.doctorReceivedAt = new Date();
    order.doctorReceivedBy = req.user._id;
    await order.save();

    const populated = await WorkOrder.findById(order._id).populate([
      ...populateWorkOrder,
      { path: 'doctorReceivedBy', select: 'name email' },
    ]);

    return res.json({ success: true, data: { workOrder: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.cancelWorkOrder = async (req, res) => {
  try {
    const order = await WorkOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }
    order.status = 'cancelled';
    await order.save();
    const populated = await WorkOrder.findById(order._id).populate(populateWorkOrder);
    return res.json({ success: true, data: { workOrder: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.summary = async (req, res) => {
  try {
    const byStatus = await WorkOrder.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const revenue = await WorkOrder.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const outstanding = await WorkOrder.aggregate([
      { $match: { paymentStatus: { $in: ['unpaid', 'partial'] } } },
      {
        $project: {
          owed: { $subtract: ['$totalAmount', '$amountPaid'] },
        },
      },
      { $group: { _id: null, totalOwed: { $sum: '$owed' } } },
    ]);

    return res.json({
      success: true,
      data: {
        ordersByStatus: byStatus,
        paidRevenue: revenue[0]?.total || 0,
        outstandingAmount: outstanding[0]?.totalOwed || 0,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
