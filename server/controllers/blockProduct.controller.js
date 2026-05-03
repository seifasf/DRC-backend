const BlockProduct = require('../models/BlockProduct.model');

exports.listBlockProducts = async (req, res) => {
  try {
    const filter = {};
    if (!req.user || req.user.role !== 'admin') {
      filter.isAvailable = true;
    }
    const blockProducts = await BlockProduct.find(filter).sort({ category: 1, name: 1 });
    return res.json({ success: true, data: { blockProducts } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.getBlockProduct = async (req, res) => {
  try {
    const blockProduct = await BlockProduct.findById(req.params.id);
    if (!blockProduct) {
      return res.status(404).json({ success: false, message: 'Block product not found.' });
    }
    if (!blockProduct.isAvailable && (!req.user || req.user.role !== 'admin')) {
      return res.status(404).json({ success: false, message: 'Block product not found.' });
    }
    return res.json({ success: true, data: { blockProduct } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.createBlockProduct = async (req, res) => {
  try {
    const allowed = ['code', 'name', 'category', 'unitLabel', 'pricePerUnit', 'currency', 'isAvailable'];
    const payload = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }

    const blockProduct = await BlockProduct.create(payload);
    return res.status(201).json({ success: true, data: { blockProduct } });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Code must be unique.' });
    }
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateBlockProduct = async (req, res) => {
  try {
    const allowed = ['code', 'name', 'category', 'unitLabel', 'pricePerUnit', 'currency', 'isAvailable'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const blockProduct = await BlockProduct.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!blockProduct) {
      return res.status(404).json({ success: false, message: 'Block product not found.' });
    }
    return res.json({ success: true, data: { blockProduct } });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Code must be unique.' });
    }
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.updateBlockProductPrice = async (req, res) => {
  try {
    const blockProduct = await BlockProduct.findById(req.params.id);
    if (!blockProduct) {
      return res.status(404).json({ success: false, message: 'Block product not found.' });
    }

    blockProduct.pricePerUnit = req.body.pricePerUnit;
    if (req.body.currency !== undefined) blockProduct.currency = req.body.currency;
    await blockProduct.save();

    return res.json({ success: true, data: { blockProduct } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.bulkUpdateBlockProductPrices = async (req, res) => {
  try {
    const { updates } = req.body;
    const results = [];

    for (const row of updates) {
      const bp = await BlockProduct.findById(row.blockProductId);
      if (!bp) {
        results.push({ blockProductId: row.blockProductId, ok: false, message: 'Not found' });
        continue;
      }
      bp.pricePerUnit = row.pricePerUnit;
      if (row.currency !== undefined) bp.currency = row.currency;
      await bp.save();
      results.push({
        blockProductId: row.blockProductId,
        ok: true,
        pricePerUnit: bp.pricePerUnit,
        currency: bp.currency,
      });
    }

    return res.json({ success: true, data: { results } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.toggleBlockProduct = async (req, res) => {
  try {
    const blockProduct = await BlockProduct.findById(req.params.id);
    if (!blockProduct) {
      return res.status(404).json({ success: false, message: 'Block product not found.' });
    }
    blockProduct.isAvailable = !blockProduct.isAvailable;
    await blockProduct.save();
    return res.json({ success: true, data: { blockProduct } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.deleteBlockProduct = async (req, res) => {
  try {
    const blockProduct = await BlockProduct.findById(req.params.id);
    if (!blockProduct) {
      return res.status(404).json({ success: false, message: 'Block product not found.' });
    }

    const WorkOrder = require('../models/WorkOrder.model');
    const inUse = await WorkOrder.exists({
      'blockLines.blockProductId': blockProduct._id,
    });
    if (inUse) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a block type that appears on existing work orders.',
      });
    }

    await blockProduct.deleteOne();
    return res.json({ success: true, data: { message: 'Block product deleted.' } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
