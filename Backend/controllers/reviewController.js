const Review = require('../models/Review');
const Booking = require('../models/Booking');
const { recordAuditLog } = require('../utils/auditLogger');
const { sendReviewSubmittedEmail } = require('../utils/emailService');

// @desc    Submit a review for a booking
// @route   POST /api/reviews
// @access  Private/Customer
const submitReview = async (req, res) => {
  try {
    const { bookingId, rating, feedback } = req.body;

    if (!bookingId || !rating || !feedback) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Must be the customer who booked it
    if (booking.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the customer who made this booking can submit a review.' });
    }

    // Must be a completed booking
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'You can only review completed rental bookings.' });
    }

    // Prevent duplicate reviews
    const existing = await Review.findOne({ bookingId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already submitted a review for this booking.' });
    }

    const review = new Review({
      bookingId,
      vehicleId: booking.vehicleId,
      userId: req.user._id,
      ownerId: booking.ownerId,
      rating,
      feedback
    });

    await review.save();

    await recordAuditLog({
      action: 'REVIEW_CREATED',
      userId: req.user._id,
      role: req.user.role,
      entityType: 'review',
      entityId: review._id,
      newValue: { rating, feedback },
      description: `Review submitted for booking: ${bookingId}`,
      req
    });

    // Send email notification (Async)
    sendReviewSubmittedEmail({
      to: req.user.email,
      customerName: req.user.name,
      bookingId: bookingId,
      rating: rating,
      userId: req.user._id
    }).catch(err => console.error('Review submitted email failed:', err));

    res.status(201).json({ success: true, review });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A duplicate review exists for this booking.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reviews for a vehicle (Public)
// @route   GET /api/reviews/vehicle/:vehicleId
// @access  Public
const getVehicleReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      vehicleId: req.params.vehicleId,
      moderationStatus: 'visible',
      isDeleted: false
    })
      .populate('userId', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all reviews (Admin and role-specific check)
// @route   GET /api/reviews
// @access  Private
const getReviews = async (req, res) => {
  try {
    const filter = { isDeleted: false };
    if (req.user.role === 'owner') {
      filter.ownerId = req.user._id;
    } else if (req.user.role === 'customer') {
      filter.userId = req.user._id;
    }

    // Admins can see hidden reviews as well
    if (req.user.role !== 'admin') {
      filter.moderationStatus = 'visible';
    } else {
      // Admins want to see all including soft deleted/hidden reviews for moderation
      delete filter.isDeleted;
    }

    const reviews = await Review.find(filter)
      .populate('userId', 'name email')
      .populate('vehicleId', 'name brand model')
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Moderate review (Admin only)
// @route   PUT /api/reviews/:id/moderate
// @access  Private/Admin
const moderateReview = async (req, res) => {
  try {
    const { moderationStatus, moderationReason } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const oldStatus = review.moderationStatus;
    review.moderationStatus = moderationStatus;
    review.moderatedBy = req.user._id;
    review.moderatedAt = Date.now();
    review.moderationReason = moderationReason;

    await review.save();

    await recordAuditLog({
      action: 'REVIEW_MODERATED',
      userId: req.user._id,
      role: req.user.role,
      entityType: 'review',
      entityId: review._id,
      oldValue: { moderationStatus: oldStatus },
      newValue: { moderationStatus: review.moderationStatus, reason: moderationReason },
      description: `Review moderated to: ${moderationStatus}`,
      req
    });

    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Soft-delete review (Admin only — prevents owners from deleting negative feedback)
// @route   DELETE /api/reviews/:id
// @access  Private/Admin
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    // Force soft-delete only
    review.isDeleted = true;
    review.deletedBy = req.user._id;
    review.deletedAt = Date.now();
    await review.save();

    await recordAuditLog({
      action: 'REVIEW_HIDDEN',
      userId: req.user._id,
      role: req.user.role,
      entityType: 'review',
      entityId: review._id,
      newValue: { isDeleted: true },
      description: 'Review soft deleted by admin moderation',
      req
    });

    res.json({ success: true, message: 'Review successfully removed (soft-deleted).' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all featured and visible testimonials (Public)
// @route   GET /api/testimonials
// @access  Public
const getTestimonials = async (req, res) => {
  try {
    const testimonials = await Review.find({
      isFeatured: true,
      moderationStatus: 'visible',
      isDeleted: false
    })
      .populate('userId', 'name email profileImage')
      .populate('vehicleId', 'name brand model image')
      .sort({ createdAt: -1 });

    res.json({ success: true, testimonials });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark review as featured (Admin only)
// @route   PUT /api/admin/reviews/:id/feature
// @access  Private/Admin
const featureReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    review.isFeatured = true;
    await review.save();

    await recordAuditLog({
      action: 'REVIEW_FEATURED',
      userId: req.user._id,
      role: req.user.role,
      entityType: 'review',
      entityId: review._id,
      newValue: { isFeatured: true },
      description: `Review marked as featured: ${review._id}`,
      req
    });

    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove review from featured (Admin only)
// @route   PUT /api/admin/reviews/:id/unfeature
// @access  Private/Admin
const unfeatureReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    review.isFeatured = false;
    await review.save();

    await recordAuditLog({
      action: 'REVIEW_UNFEATURED',
      userId: req.user._id,
      role: req.user.role,
      entityType: 'review',
      entityId: review._id,
      newValue: { isFeatured: false },
      description: `Review removed from featured: ${review._id}`,
      req
    });

    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  submitReview,
  getVehicleReviews,
  getReviews,
  moderateReview,
  deleteReview,
  getTestimonials,
  featureReview,
  unfeatureReview
};
