/**
 * Next order code: simple numeric string "1", "2", "3", …
 * Supports legacy WO-0001-style codes by reading their trailing number.
 */
const generateOrderCode = async () => {
  const WorkOrder = require('../models/WorkOrder.model');
  const rows = await WorkOrder.find(
    { orderCode: { $exists: true, $nin: [null, ''] } },
    { orderCode: 1, _id: 0 }
  ).lean();

  let max = 0;
  for (const row of rows) {
    const code = String(row?.orderCode || '').trim();
    if (!code) continue;
    if (/^\d+$/.test(code)) {
      const n = parseInt(code, 10);
      if (!Number.isNaN(n) && n > max) max = n;
      continue;
    }
    const m = code.match(/(\d+)\s*$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }

  return String(max + 1);
};

module.exports = generateOrderCode;
