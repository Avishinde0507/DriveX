const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  // Link to booking and payment
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Payment reference (immutable snapshot)
  paymentTransactionId: { type: String, required: true },
  originalAmount: { type: Number, required: true },
  refundAmount: { type: Number, required: true },

  // Refund workflow
  status: {
    type: String,
    enum: ['pending', 'processing', 'success', 'failed'],
    default: 'pending'
  },

  // Reason and processing info
  refundReason: { type: String, required: true, maxlength: 1000 },
  adminNotes: { type: String, default: null },

  // Who processed it
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  processedAt: { type: Date, default: null },

  // Refund transaction tracking
  refundTransactionId: { type: String, default: null },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// CRITICAL: Prevent duplicate refunds — one refund per booking
refundSchema.index({ bookingId: 1 }, { unique: true });

// Query indexes
refundSchema.index({ customerId: 1, status: 1 });
refundSchema.index({ status: 1 });

refundSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

const Refund = mongoose.model('Refund', refundSchema);
module.exports = Refund;
