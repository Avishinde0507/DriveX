const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: { type: String, required: true },
  type: { type: String, enum: ['2W', '4W'], required: true },
  fuel: { type: String, required: true },
  transmission: { type: String, required: true },
  seats: { type: Number, required: true },
  regNumber: { type: String, required: true },
  model: { type: String, required: true },
  priceDaily: { type: Number, required: true },
  priceWeekly: { type: Number, required: true },
  priceMonthly: { type: Number, required: true },
  status: { type: String, enum: ['available', 'rented', 'maintenance'], default: 'available', lowercase: true },
  approved: { type: Boolean, default: false },
  location: { type: String, required: true },
  image: { type: String, default: 'fa-car' },
  images: { type: [String], default: [] },
  color: { type: String, default: '#000000' },
  description: { type: String, default: '' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ── CONFLICT MANAGEMENT ──
  bookingLock: { type: Date, default: null },       // Atomic lock for concurrent booking prevention
  bookingLockBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance optimization
vehicleSchema.index({ ownerId: 1 });
vehicleSchema.index({ status: 1, approved: 1 });
vehicleSchema.index({ location: 1 });

vehicleSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
module.exports = Vehicle;
