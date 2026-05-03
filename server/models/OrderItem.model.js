const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkOrder',
      required: true,
    },
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    completedUnits: { type: Number, default: 0, min: 0 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['queued', 'in_progress', 'done'],
      default: 'queued',
    },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    /** Snapshot of tier / multi-component / simple pricing at order time. */
    pricingBreakdown: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

orderItemSchema.index({ workOrderId: 1 });
orderItemSchema.index({ testId: 1 });
orderItemSchema.index({ assignedTo: 1 });
orderItemSchema.index({ workOrderId: 1, testId: 1 });

orderItemSchema.pre('save', function (next) {
  if (this.completedUnits > this.quantity) {
    this.completedUnits = this.quantity;
  }
  next();
});

module.exports = mongoose.model('OrderItem', orderItemSchema);
