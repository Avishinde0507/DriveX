const mongoose = require('mongoose');

// Immutable fare snapshot — locked at booking creation, never recalculated
const fareSnapshotSchema = new mongoose.Schema({
  baseFare: { type: Number, required: true },
  perKmRate: { type: Number, default: 0 },
  surgeFare: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  finalFare: { type: Number, required: true },
  lockedAt: { type: Date, default: Date.now },
  lockedByPriceDaily: { type: Number, default: 0 },
  lockedByPriceWeekly: { type: Number, default: 0 },
  lockedByPriceMonthly: { type: Number, default: 0 },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  durationType: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
  totalPrice: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'active', 'completed', 'cancelled', 'rejected'], default: 'pending' },

  // Payment fields
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
  paymentMethod: { type: String, default: null },
  transactionId: { type: String, default: null },
  paidAt: { type: Date, default: null },

  // ── FARE CONFLICT MANAGEMENT ──
  fareSnapshot: { type: fareSnapshotSchema, default: null },
  fareVersion: { type: Number, default: 1 },

  // ── CONCURRENCY CONTROL ──
  bookingLock: { type: Date, default: null }, // Atomic lock timestamp
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  optimisticConcurrency: true  // Enables __v based OCC
});

// Indexes for performance optimization
bookingSchema.index({ customerId: 1 });
bookingSchema.index({ ownerId: 1 });
bookingSchema.index({ vehicleId: 1, status: 1, startDate: 1, endDate: 1 });

bookingSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;

