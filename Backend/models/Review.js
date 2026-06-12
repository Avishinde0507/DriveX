const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // One review per booking — enforced by unique index
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Review content
  rating: { type: Number, required: true, min: 1, max: 5 },
  feedback: { type: String, required: true, maxlength: 1000 },

  // Moderation — only admin can change
  moderationStatus: {
    type: String,
    enum: ['visible', 'hidden', 'flagged'],
    default: 'visible'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderationReason: { type: String, default: null },
  moderatedAt: { type: Date, default: null },

  // Soft-delete — owners cannot hard-delete
  isDeleted: { type: Boolean, default: false },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deletedAt: { type: Date, default: null },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// CRITICAL: One review per booking
reviewSchema.index({ bookingId: 1 }, { unique: true });

// Query indexes
reviewSchema.index({ vehicleId: 1, moderationStatus: 1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ ownerId: 1 });

reviewSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
