const mongoose = require('mongoose');
const generateOrderCode = require('../utils/generateOrderCode');

const blockLineSchema = new mongoose.Schema(
  {
    blockProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlockProduct',
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const workOrderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, unique: true, sparse: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    notes: String,
    /** Referring / treating doctor (for linking and contact; may differ from client account holder). */
    doctorName: { type: String, trim: true },
    doctorPhone: { type: String, trim: true },
    /** Lab supplies blocks (priced from catalog) vs customer / outsourced blocks (not billed here). */
    blocksProvidedBy: {
      type: String,
      enum: ['lab', 'customer'],
      default: 'customer',
    },
    /** Snapshot lines: quantity + unitPrice/subtotal at save time (subtotal 0 when blocksProvidedBy is customer). */
    blockLines: {
      type: [blockLineSchema],
      default: [],
    },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    dueDate: Date,
    /** Non-admin staff applied explicit line price overrides (tier / component / simple). */
    staffLinePricingUsed: { type: Boolean, default: false },
    staffLinePricingAt: Date,
    staffLinePricingBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Manager marks when the referring doctor collected the order; hides from delivery queue. */
    doctorReceivedOrder: { type: Boolean, default: false },
    doctorReceivedAt: Date,
    doctorReceivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

workOrderSchema.index({ status: 1, paymentStatus: 1, doctorReceivedOrder: 1 });

workOrderSchema.index({ status: 1 });
workOrderSchema.index({ status: 1, paymentStatus: 1 });
workOrderSchema.index({ createdAt: -1 });
workOrderSchema.index({ doctorPhone: 1 });
workOrderSchema.index({ doctorName: 1, doctorPhone: 1 });

workOrderSchema.pre('save', async function () {
  if (this.isNew && !this.orderCode) {
    this.orderCode = await generateOrderCode();
  }
});

module.exports = mongoose.model('WorkOrder', workOrderSchema);
