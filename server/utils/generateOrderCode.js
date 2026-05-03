/**
 * Generates next order code: WO-YYYY-XXXX (4-digit sequence per year)
 */
const generateOrderCode = async () => {
  const WorkOrder = require('../models/WorkOrder.model');
  const year = new Date().getFullYear();
  const prefix = `WO-${year}-`;

  const last = await WorkOrder.findOne({
    orderCode: new RegExp(`^${prefix}`),
  })
    .sort({ orderCode: -1 })
    .select('orderCode')
    .lean();

  let nextNum = 1;
  if (last?.orderCode) {
    const part = last.orderCode.replace(prefix, '');
    const n = parseInt(part, 10);
    if (!Number.isNaN(n)) nextNum = n + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
};

module.exports = generateOrderCode;
