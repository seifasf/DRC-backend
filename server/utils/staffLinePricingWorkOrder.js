const WorkOrder = require('../models/WorkOrder.model');

/** Detects explicit price override fields on a request body (same inputs as pricing resolution). */
function bodyHasPricingOverrideFields(body) {
  if (!body || typeof body !== 'object') return false;
  const cup = body.componentUnitPrices;
  if (cup && typeof cup === 'object' && !Array.isArray(cup)) {
    for (const v of Object.values(cup)) {
      if (v != null && String(v).trim() !== '') return true;
    }
  }
  if (body.tierPriceOverride != null && body.tierPriceOverride !== '') return true;
  if (body.simpleUnitPriceOverride != null && body.simpleUnitPriceOverride !== '') return true;
  return false;
}

function isStaffPricingActor(role) {
  return role === 'employee' || role === 'manager';
}

/** Latest qualifying edit wins (timestamp + user updated each time). */
async function recordStaffLinePricingEdit(workOrderId, userId) {
  await WorkOrder.findByIdAndUpdate(workOrderId, {
    staffLinePricingUsed: true,
    staffLinePricingAt: new Date(),
    staffLinePricingBy: userId,
  });
}

module.exports = {
  bodyHasPricingOverrideFields,
  isStaffPricingActor,
  recordStaffLinePricingEdit,
};
