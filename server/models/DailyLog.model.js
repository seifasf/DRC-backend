const mongoose = require('mongoose');

const dailyLogSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderItem',
      required: true,
    },
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkOrder',
      required: true,
    },
    date: { type: Date, required: true },
    unitsCompleted: { type: Number, required: true, min: 0 },
    notes: String,
  },
  { timestamps: true }
);

dailyLogSchema.index({ employeeId: 1 });
dailyLogSchema.index({ date: -1 });
dailyLogSchema.index({ orderItemId: 1 });
dailyLogSchema.index({ workOrderId: 1, date: -1 });

module.exports = mongoose.model('DailyLog', dailyLogSchema);
