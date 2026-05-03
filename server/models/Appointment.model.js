const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedDate: { type: Date, required: true },
    confirmedDate: Date,
    purpose: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  },
  { timestamps: true }
);

appointmentSchema.index({ clientId: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ clientId: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
