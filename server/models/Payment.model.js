const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkOrder',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: ['cash', 'bank_transfer', 'card', 'visa', 'vodafone_cash', 'other'],
      required: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paidAt: { type: Date, required: true },
    notes: String,
  },
  { timestamps: true }
);

paymentSchema.index({ workOrderId: 1 });
paymentSchema.index({ paidAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
