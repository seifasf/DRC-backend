const BlockProduct = require('../models/BlockProduct.model');

/**
 * Validates block lines and snapshots prices.
 * When blocksProvidedBy === 'lab', uses catalog pricePerUnit; otherwise billing is 0 (customer / outsourced blocks).
 */
async function buildWorkOrderBlockLines(blocksProvidedBy, rawLines, session) {
  const lines = [];
  let blocksTotal = 0;

  for (const row of rawLines || []) {
    const q = BlockProduct.findById(row.blockProductId);
    if (session) q.session(session);
    const bp = await q;

    if (!bp) {
      const err = new Error(`Block product not found: ${row.blockProductId}`);
      err.status = 400;
      throw err;
    }
    if (!bp.isAvailable) {
      const err = new Error(`Block product unavailable: ${bp.name}`);
      err.status = 400;
      throw err;
    }

    const qty = Number(row.quantity);
    if (Number.isNaN(qty) || qty < 0) {
      const err = new Error('Each block line needs a non-negative quantity.');
      err.status = 400;
      throw err;
    }

    const unitPrice = blocksProvidedBy === 'lab' ? bp.pricePerUnit : 0;
    const subtotal = qty * unitPrice;
    blocksTotal += subtotal;

    lines.push({
      blockProductId: bp._id,
      quantity: qty,
      unitPrice,
      subtotal,
    });
  }

  return { lines, blocksTotal };
}

module.exports = buildWorkOrderBlockLines;
