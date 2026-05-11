const Test = require('../models/Test.model');
const Machine = require('../models/Machine.model');

const populateTest = [
  { path: 'createdBy', select: 'name email' },
  { path: 'machineId', select: 'name description isActive' },
];

async function ensureMachineExists(machineId) {
  if (machineId === undefined || machineId === null) return;
  const machine = await Machine.findById(machineId);
  if (!machine) {
    const err = new Error('Machine not found');
    err.status = 400;
    throw err;
  }
}

exports.listTests = async (req, res) => {
  try {
    const filter = {};
    if (!req.user || req.user.role !== 'admin') {
      filter.isAvailable = true;
    }
    const tests = await Test.find(filter).populate(populateTest).sort({ category: 1, name: 1 }).lean();
    return res.json({ success: true, data: { tests } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).populate(populateTest).lean();
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }
    if (!test.isAvailable && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }
    return res.json({ success: true, data: { test } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createTest = async (req, res) => {
  try {
    await ensureMachineExists(req.body.machineId);

    const allowed = [
      'name',
      'category',
      'description',
      'unitLabel',
      'pricePerUnit',
      'pricingTiers',
      'pricingComponents',
      'machine',
      'machineId',
      'isAvailable',
    ];
    const payload = { createdBy: req.user._id };
    for (const key of allowed) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    if (payload.pricePerUnit === undefined) payload.pricePerUnit = 0;

    const created = await Test.create(payload);
    const test = await Test.findById(created._id).populate(populateTest);
    return res.status(201).json({ success: true, data: { test } });
  } catch (err) {
    console.error(err);
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateTest = async (req, res) => {
  try {
    if (req.body.machineId !== undefined) {
      await ensureMachineExists(req.body.machineId);
    }

    const allowed = [
      'name',
      'category',
      'description',
      'unitLabel',
      'pricePerUnit',
      'pricingTiers',
      'pricingComponents',
      'machine',
      'machineId',
      'isAvailable',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const test = await Test.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate(populateTest)
      .exec();

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }
    return res.json({ success: true, data: { test } });
  } catch (err) {
    console.error(err);
    if (err.status === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/** Admin only — set price for one catalog test */
exports.updateTestPrice = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }

    test.pricePerUnit = req.body.pricePerUnit;
    await test.save();

    const populated = await Test.findById(test._id).populate(populateTest);
    return res.json({ success: true, data: { test: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/** Admin only — set prices for many tests in one request */
exports.bulkUpdateTestPrices = async (req, res) => {
  try {
    const { updates } = req.body;
    const results = [];

    for (const row of updates) {
      const test = await Test.findById(row.testId);
      if (!test) {
        results.push({ testId: row.testId, ok: false, message: 'Test not found' });
        continue;
      }
      test.pricePerUnit = row.pricePerUnit;
      await test.save();
      results.push({ testId: row.testId, ok: true, pricePerUnit: test.pricePerUnit });
    }

    return res.json({ success: true, data: { results } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.toggleTest = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }
    test.isAvailable = !test.isAvailable;
    await test.save();
    const populated = await Test.findById(test._id).populate(populateTest);
    return res.json({ success: true, data: { test: populated } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.deleteTest = async (req, res) => {
  try {
    const test = await Test.findByIdAndDelete(req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found.' });
    }
    return res.json({ success: true, data: { message: 'Test deleted.' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
