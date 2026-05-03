const Payment = require('../models/Payment.model');
const WorkOrder = require('../models/WorkOrder.model');
const recalcPaymentStatus = require('../utils/recalcPaymentStatus');

exports.listPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('workOrderId', 'orderCode totalAmount')
      .populate('clientId', 'name email')
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

    if (req.user.role === 'client' && String(order.clientId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
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
      clientId: workOrder.clientId,
      amount,
      method,
      recordedBy: req.user._id,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      notes,
    });

    await recalcPaymentStatus(workOrderId);

    const populated = await Payment.findById(payment._id)
      .populate('workOrderId', 'orderCode totalAmount amountPaid paymentStatus')
      .populate('clientId', 'name email')
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
      .populate('clientId', 'name email phone')
      .sort({ dueDate: 1 });

    return res.json({ success: true, data: { workOrders: orders } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.summary = async (req, res) => {
  try {
    const byMethod = await Payment.aggregate([
      { $group: { _id: '$method', total: { $sum: '$amount' } } },
    ]);
    const totals = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      data: {
        byMethod,
        overall: totals[0] || { total: 0, count: 0 },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
