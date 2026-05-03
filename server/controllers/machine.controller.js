const Machine = require('../models/Machine.model');
const Test = require('../models/Test.model');

exports.listMachines = async (req, res) => {
  try {
    const filter = {};
    if (!req.user || req.user.role !== 'admin') {
      filter.isActive = true;
    }
    const machines = await Machine.find(filter).sort({ name: 1 });
    return res.json({ success: true, data: { machines } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getMachine = async (req, res) => {
  try {
    const machine = await Machine.findById(req.params.id);
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found.' });
    }
    if (!machine.isActive && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({ success: false, message: 'Machine not found.' });
    }
    return res.json({ success: true, data: { machine } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createMachine = async (req, res) => {
  try {
    const allowed = ['name', 'description', 'isActive'];
    const payload = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }

    const machine = await Machine.create(payload);
    return res.status(201).json({ success: true, data: { machine } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateMachine = async (req, res) => {
  try {
    const allowed = ['name', 'description', 'isActive'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const machine = await Machine.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found.' });
    }
    return res.json({ success: true, data: { machine } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.toggleMachine = async (req, res) => {
  try {
    const machine = await Machine.findById(req.params.id);
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found.' });
    }
    machine.isActive = !machine.isActive;
    await machine.save();
    return res.json({ success: true, data: { machine } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.deleteMachine = async (req, res) => {
  try {
    const machine = await Machine.findById(req.params.id);
    if (!machine) {
      return res.status(404).json({ success: false, message: 'Machine not found.' });
    }

    const inUse = await Test.exists({ machineId: machine._id });
    if (inUse) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a machine that is linked to one or more tests. Unlink tests first.',
      });
    }

    await machine.deleteOne();
    return res.json({ success: true, data: { message: 'Machine deleted.' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
