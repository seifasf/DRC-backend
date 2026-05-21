const mongoose = require('mongoose');

const pricingTierSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    cycles: { type: Number },
    /** For package pricing notes (e.g. chewing simulator includes N samples per package). */
    packageSamples: { type: Number },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'LE', trim: true },
  },
  { _id: false }
);

const pricingComponentSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    pricePerUnit: { type: Number, required: true, min: 0 },
    billUnitLabel: { type: String, default: 'unit', trim: true },
    currency: { type: String, default: 'LE', trim: true },
  },
  { _id: false }
);

const testSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    machine: { type: String, trim: true },
    machineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Machine' },
    /** Billing unit for simple mode; tiered uses packages, components use line bill units. */
    unitLabel: { type: String, default: 'sample', trim: true },
    /** Used when pricingTiers and pricingComponents are empty (simple per-unit billing). */
    pricePerUnit: { type: Number, required: true, min: 0, default: 0 },
    /** Select-one packages (e.g. cycles bands). Order lines must send pricingTierCode + quantity (# packages). */
    pricingTiers: { type: [pricingTierSchema], default: [] },
    /** Sum-of-lines billing. Order lines must send componentQuantities { code: count }. */
    pricingComponents: { type: [pricingComponentSchema], default: [] },
    isAvailable: { type: Boolean, default: true },
    /** When true, staff may set simpleUnitPriceOverride on order lines (catalog price unchanged). */
    allowOrderUnitPriceOverride: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

testSchema.index({ machineId: 1 });
testSchema.index({ category: 1, isAvailable: 1 });
testSchema.index({ name: 1 });

module.exports = mongoose.model('Test', testSchema);
