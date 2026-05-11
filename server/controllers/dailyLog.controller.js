const DailyLog = require('../models/DailyLog.model');
const OrderItem = require('../models/OrderItem.model');
const WorkOrder = require('../models/WorkOrder.model');
const { computeDeltaPackages, roundPkgProgress, EPS } = require('../utils/dailyLogWorkload');

const refreshWorkOrderFromItems = async (workOrderId) => {
  const items = await OrderItem.find({ workOrderId });
  const wo = await WorkOrder.findById(workOrderId);
  if (!wo || wo.status === 'cancelled') return;

  const allDone = items.length > 0 && items.every((i) => i.status === 'done');
  if (allDone) {
    wo.status = 'completed';
    await wo.save();
  }
};

exports.listDailyLogs = async (req, res) => {
  try {
    const logs = await DailyLog.find()
      .populate('employeeId', 'name email')
      .populate('orderItemId')
      .populate('workOrderId', 'orderCode status')
      .sort({ date: -1 });
    return res.json({ success: true, data: { dailyLogs: logs } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.myLogs = async (req, res) => {
  try {
    const logs = await DailyLog.find({ employeeId: req.user._id })
      .populate('orderItemId')
      .populate('workOrderId', 'orderCode status')
      .sort({ date: -1 });
    return res.json({ success: true, data: { dailyLogs: logs } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createDailyLog = async (req, res) => {
  try {
    const { orderItemId, date, unitsCompleted, notes } = req.body;

    const orderItem = await OrderItem.findById(orderItemId);
    if (!orderItem) {
      return res.status(404).json({ success: false, message: 'Order item not found.' });
    }

    const workOrder = await WorkOrder.findById(orderItem.workOrderId);
    if (!workOrder || workOrder.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Invalid work order.' });
    }

    if (req.user.role === 'employee') {
      if (!orderItem.assignedTo || String(orderItem.assignedTo) !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'You can only log progress on items assigned to you.',
        });
      }
    }

    const { deltaPkgs, err } = computeDeltaPackages(orderItem, unitsCompleted);
    if (err) {
      return res.status(err.status).json({ success: false, message: err.message });
    }

    const u = Number(unitsCompleted);
    const prevDone = Number(orderItem.completedUnits || 0);

    const log = await DailyLog.create({
      employeeId: req.user._id,
      orderItemId,
      workOrderId: orderItem.workOrderId,
      date: date ? new Date(date) : new Date(),
      unitsCompleted: u,
      notes,
    });

    orderItem.completedUnits = roundPkgProgress(prevDone + deltaPkgs);
    const q = Number(orderItem.quantity);
    if (orderItem.completedUnits >= q - EPS) {
      orderItem.completedUnits = q;
      orderItem.status = 'done';
    } else if (orderItem.status === 'queued') {
      orderItem.status = 'in_progress';
    } else if (orderItem.completedUnits > 0 && orderItem.status !== 'done') {
      orderItem.status = 'in_progress';
    }
    await orderItem.save();

    await refreshWorkOrderFromItems(orderItem.workOrderId);

    const populated = await DailyLog.findById(log._id)
      .populate('employeeId', 'name email')
      .populate('orderItemId')
      .populate('workOrderId', 'orderCode status');

    return res.status(201).json({ success: true, data: { dailyLog: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.byWorkOrder = async (req, res) => {
  try {
    const logs = await DailyLog.find({ workOrderId: req.params.workOrderId })
      .populate('employeeId', 'name email')
      .populate('orderItemId')
      .sort({ date: -1 });
    return res.json({ success: true, data: { dailyLogs: logs } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.byEmployee = async (req, res) => {
  try {
    const logs = await DailyLog.find({ employeeId: req.params.empId })
      .populate('orderItemId')
      .populate('workOrderId', 'orderCode status')
      .sort({ date: -1 });
    return res.json({ success: true, data: { dailyLogs: logs } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
