const mongoose = require('mongoose');

const blockProductSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, sparse: true, unique: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    unitLabel: { type: String, default: 'block', trim: true },
    pricePerUnit: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'LE', trim: true },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

blockProductSchema.index({ category: 1 });
blockProductSchema.index({ isAvailable: 1 });

module.exports = mongoose.model('BlockProduct', blockProductSchema);
