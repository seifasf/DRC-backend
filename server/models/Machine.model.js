const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

machineSchema.index({ name: 1 });
machineSchema.index({ isActive: 1 });

module.exports = mongoose.model('Machine', machineSchema);
