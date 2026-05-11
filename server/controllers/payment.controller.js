const Payment = require('../models/Payment.model');
const WorkOrder = require('../models/WorkOrder.model');
const recalcPaymentStatus = require('../utils/recalcPaymentStatus');

exports.listPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('workOrderId', 'orderCode totalAmount')
      .populate('recordedBy', 'name email')
      .sort({ paidAt: -1 });
    return res.json({ success: true, data: { payments } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.listByWorkOrder = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const order = await WorkOrder.findById(workOrderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }

    const payments = await Payment.find({ workOrderId })
      .populate('recordedBy', 'name email')
      .sort({ paidAt: -1 });

    return res.json({ success: true, data: { payments, workOrder: order } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { workOrderId, amount, method, paidAt, notes } = req.body;

    const workOrder = await WorkOrder.findById(workOrderId);
    if (!workOrder || workOrder.status === 'cancelled') {
      return res.status(404).json({ success: false, message: 'Work order not found.' });
    }

    const payment = await Payment.create({
      workOrderId,
      amount,
      method,
      recordedBy: req.user._id,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      notes,
    });

    await recalcPaymentStatus(workOrderId);

    const populated = await Payment.findById(payment._id)
      .populate('workOrderId', 'orderCode totalAmount amountPaid paymentStatus')
      .populate('recordedBy', 'name email');

    return res.status(201).json({ success: true, data: { payment: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.unpaidWorkOrders = async (req, res) => {
  try {
    const orders = await WorkOrder.find({
      paymentStatus: { $in: ['unpaid', 'partial'] },
      status: { $ne: 'cancelled' },
    })
      .sort({ dueDate: 1 });

    return res.json({ success: true, data: { workOrders: orders } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Aggregated payment totals.
 * Optional ?from=ISO&to=ISO filters by `paidAt` (inclusive). If only `from`
 * is provided, returns totals from that timestamp onward. Default: all time.
 *
 * Use this for end-of-day / shift totals, e.g. ?from=2026-05-04T00:00:00
 * &to=2026-05-04T23:59:59 -> today's cash drawer breakdown.
 */
exports.summary = async (req, res) => {
  try {
    const match = {};
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if (from && !Number.isNaN(from.getTime())) match.paidAt = { ...(match.paidAt || {}), $gte: from };
    if (to && !Number.isNaN(to.getTime())) match.paidAt = { ...(match.paidAt || {}), $lte: to };

    const pipelinePrefix = Object.keys(match).length ? [{ $match: match }] : [];

    const byMethod = await Payment.aggregate([
      ...pipelinePrefix,
      { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const totals = await Payment.aggregate([
      ...pipelinePrefix,
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      data: {
        byMethod,
        overall: totals[0] || { total: 0, count: 0 },
        range: {
          from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
          to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
        },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
