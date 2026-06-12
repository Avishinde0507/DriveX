const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const { recordAuditLog } = require('../utils/auditLogger');
const {
  sendBookingRequestEmail,
  sendBookingApprovedEmail,
  sendBookingRejectedEmail,
  sendBookingCancelledEmail,
  sendBookingCompletedEmail
} = require('../utils/emailService');

// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private/Admin
const getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('customerId', 'name email phone')
      .populate('vehicleId', 'name brand model regNumber location');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('vehicleId', 'name brand model regNumber location ownerId');
    if (booking) res.json(booking);
    else res.status(404).json({ message: 'Booking not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get customer bookings
// @route   GET /api/bookings/customer/:customerId
// @access  Private
const getBookingsByCustomer = async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.params.customerId })
      .populate('vehicleId', 'name brand model image regNumber location');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get owner bookings
// @route   GET /api/bookings/owner/:ownerId
// @access  Private
const getBookingsByOwner = async (req, res) => {
  try {
    const bookings = await Booking.find({ ownerId: req.params.ownerId })
      .populate('customerId', 'name email phone')
      .populate('vehicleId', 'name brand model image regNumber location');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create secure booking with atomic concurrency locks & server-side fare calculation locking
// @route   POST /api/bookings
// @access  Private/Customer
const createBooking = async (req, res) => {
  try {
    const { vehicleId, startDate, endDate, durationType } = req.body;

    if (!vehicleId || !startDate || !endDate || !durationType) {
      return res.status(400).json({ message: 'All booking fields are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ message: 'Start date must be before end date.' });
    }

    // ── ATOMIC VEHICLE LOCK & AVAILABILITY CHECK ──
    // Use an atomic query to check and lock vehicle. This prevents concurrent booking conflicts.
    // If the vehicle's bookingLock is currently set and is less than 5 minutes old, treat as locked.
    const lockExpiryWindow = new Date(Date.now() - 5 * 60 * 1000);

    const vehicle = await Vehicle.findOneAndUpdate(
      {
        _id: vehicleId,
        status: 'available',
        approved: true,
        $or: [
          { bookingLock: null },
          { bookingLock: { $lt: lockExpiryWindow } }
        ]
      },
      {
        bookingLock: Date.now(),
        bookingLockBy: req.user._id
      },
      { new: true }
    );

    if (!vehicle) {
      // Record conflict attempt to audit log
      await recordAuditLog({
        action: 'BOOKING_CONFLICT_BLOCKED',
        userId: req.user._id,
        role: req.user.role,
        entityType: 'vehicle',
        entityId: vehicleId,
        description: 'Concurrent booking attempt blocked due to lock or status conflict.',
        req
      });

      return res.status(409).json({
        message: 'Vehicle is currently being booked by another customer or is unavailable. Please try again.'
      });
    }

    // Double check calendar conflicts in active bookings
    const conflictingBookings = await Booking.find({
      vehicleId,
      status: { $in: ['pending', 'active'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (conflictingBookings.length > 0) {
      // Release booking lock
      await Vehicle.findByIdAndUpdate(vehicleId, { bookingLock: null, bookingLockBy: null });

      return res.status(409).json({
        message: 'Vehicle has a confirmed schedule conflict during your chosen dates.'
      });
    }

    // ── SECURE SERVER-SIDE FARE CALCULATION ──
    let baseRate = vehicle.priceDaily;
    if (durationType === 'weekly') baseRate = vehicle.priceWeekly;
    if (durationType === 'monthly') baseRate = vehicle.priceMonthly;

    // Calculate duration
    const diffTime = Math.abs(end - start);
    let durationCount = Math.max(1, diffTime / (1000 * 60 * 60 * 24));
    if (durationType === 'weekly') durationCount = durationCount / 7;
    if (durationType === 'monthly') durationCount = durationCount / 30;

    const baseFare = Math.round(baseRate * durationCount);
    const tax = Math.round(baseFare * 0.18); // 18% GST standard
    const finalFare = baseFare + tax;

    // ── IMMUTABLE FARE SNAPSHOT CREATION ──
    const fareSnapshot = {
      baseFare,
      perKmRate: 0,
      surgeFare: 0,
      tax,
      discount: 0,
      finalFare,
      lockedAt: Date.now(),
      lockedByPriceDaily: vehicle.priceDaily,
      lockedByPriceWeekly: vehicle.priceWeekly,
      lockedByPriceMonthly: vehicle.priceMonthly
    };

    const booking = new Booking({
      customerId: req.user._id,
      vehicleId,
      ownerId: vehicle.ownerId,
      startDate: start,
      endDate: end,
      durationType,
      totalPrice: finalFare,
      fareSnapshot,
      fareVersion: 1,
      bookingLock: Date.now(),
      paymentStatus: req.body.paymentStatus || 'unpaid',
      paymentMethod: req.body.paymentMethod || null,
      transactionId: req.body.paymentId || req.body.transactionId || null,
      paidAt: req.body.paymentStatus === 'paid' ? Date.now() : null
    });

    const createdBooking = await booking.save();

    // Release vehicle lock
    await Vehicle.findByIdAndUpdate(vehicleId, { bookingLock: null, bookingLockBy: null });

    // Log booking creation
    await recordAuditLog({
      action: 'BOOKING_CREATED',
      userId: req.user._id,
      role: req.user.role,
      entityType: 'booking',
      entityId: createdBooking._id,
      newValue: { totalPrice: finalFare, fareSnapshot },
      description: 'Booking created with locked fare snapshot',
      req
    });

    // Send Booking Request Email (Async)
    sendBookingRequestEmail({
      to: req.user.email,
      customerName: req.user.name,
      bookingId: createdBooking._id.toString(),
      vehicleDetails: `${vehicle.brand} ${vehicle.model} (${vehicle.regNumber})`,
      startDate: start,
      endDate: end,
      durationType,
      fareSummary: finalFare,
      userId: req.user._id
    }).catch(err => console.error('Booking request email failed:', err));

    res.status(201).json(createdBooking);
  } catch (error) {
    // Release lock in case of errors
    if (req.body.vehicleId) {
      await Vehicle.findByIdAndUpdate(req.body.vehicleId, { bookingLock: null, bookingLockBy: null });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update booking status (with RBAC, OCC and dynamic vehicle status syncing)
// @route   PUT /api/bookings/:id/status
// @access  Private
const updateStatus = async (req, res) => {
  try {
    const { status, transactionId, paymentMethod, fareOverride } = req.body || {};
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isOwner = req.user.role === 'owner' && booking.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isCustomer = req.user.role === 'customer' && booking.customerId.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner && !isCustomer) {
      return res.status(403).json({ message: 'Not authorized to update this booking.' });
    }

    // Role-specific action checks
    if (isCustomer && !isAdmin && !isOwner && req.query.status !== 'cancelled' && status !== 'cancelled') {
      return res.status(403).json({ message: 'Customers can only cancel their own bookings.' });
    }

    if (isCustomer && booking.status === 'completed') {
      return res.status(400).json({ message: 'Cannot cancel a completed booking.' });
    }

    // ── PREVENT DUPLICATE PAYMENT / FARE MODIFICATION AFTER PAYMENT ──
    if (booking.paymentStatus === 'paid' && fareOverride) {
      return res.status(400).json({ message: 'Cannot modify fare after successful payment verification.' });
    }

    // ── EXTEND BOOKING LOGIC ──
    if (req.body.extendEndDate && (isCustomer || isAdmin || isOwner)) {
      const newEnd = new Date(req.body.extendEndDate);
      if (newEnd <= booking.endDate) {
        return res.status(400).json({ message: 'New end date must be after current end date.' });
      }

      // Check availability for the extended period
      const conflictingBookings = await Booking.find({
        vehicleId: booking.vehicleId,
        _id: { $ne: booking._id },
        status: { $in: ['pending', 'active'] },
        $or: [
          { startDate: { $lte: newEnd }, endDate: { $gte: booking.endDate } }
        ]
      });

      if (conflictingBookings.length > 0) {
        return res.status(409).json({ message: 'Vehicle is already booked for the extended period.' });
      }

      // Recalculate fare for the extension (simplistic approach: just add prorated daily fare or ignore for now)
      // For a robust system, we should use the calculatePrice logic. But here we just update the date.
      booking.endDate = newEnd;
      // Ideally, would calculate additional fare here, but keeping it simple as per requirement.
    }

    const oldStatus = booking.status;
    const oldFare = booking.totalPrice;

    // Apply status update
    if (req.query.status) {
      booking.status = req.query.status;
    } else if (status) {
      booking.status = status;
    }

    // Handle payment details
    if (transactionId) {
      if (booking.paymentStatus === 'paid') {
        return res.status(409).json({ message: 'Payment has already been processed for this booking.' });
      }
      booking.paymentStatus = 'paid';
      booking.transactionId = transactionId;
      booking.paymentMethod = paymentMethod || 'Razorpay';
      booking.paidAt = Date.now();
    }

    // Fare updates (Admin only or owner under constraints)
    if (fareOverride && (isAdmin || isOwner)) {
      booking.totalPrice = fareOverride;
      booking.fareVersion += 1;
      booking.fareSnapshot.finalFare = fareOverride;

      // Log fare override
      await recordAuditLog({
        action: 'FARE_OVERRIDE',
        userId: req.user._id,
        role: req.user.role,
        entityType: 'booking',
        entityId: booking._id,
        oldValue: oldFare,
        newValue: fareOverride,
        description: `Fare override performed. Version: ${booking.fareVersion}`,
        req
      });
    }

    // Save with Mongoose OCC check
    const updatedBooking = await booking.save();

    // Sync vehicle availability status based on booking status
    if (booking.status === 'active') {
      await Vehicle.findByIdAndUpdate(booking.vehicleId, { status: 'rented' });
    } else if (['completed', 'cancelled', 'rejected'].includes(booking.status)) {
      await Vehicle.findByIdAndUpdate(booking.vehicleId, { status: 'available' });

      // Handle automatic refund creation
      if (['cancelled', 'rejected'].includes(booking.status) && booking.paymentStatus === 'paid') {
        booking.paymentStatus = 'refunded';
        await booking.save();
      }
    }

    // Email Notifications (Async)
    try {
      const populatedBooking = await Booking.findById(booking._id)
        .populate('customerId', 'name email')
        .populate('vehicleId', 'brand model regNumber location')
        .populate('ownerId', 'name email phone');

      const customer = populatedBooking.customerId;
      const vehicleObj = populatedBooking.vehicleId;
      const owner = populatedBooking.ownerId;
      const vehicleString = `${vehicleObj.brand} ${vehicleObj.model} (${vehicleObj.regNumber})`;

      if (booking.status === 'active' && oldStatus !== 'active') {
        sendBookingApprovedEmail({
          to: customer.email,
          customerName: customer.name,
          bookingId: booking._id.toString(),
          vehicleDetails: vehicleString,
          startDate: booking.startDate,
          endDate: booking.endDate,
          pickupLocation: vehicleObj.location,
          fareSummary: booking.totalPrice,
          ownerPhone: owner.phone || 'Not provided',
          userId: customer._id
        }).catch(e => console.error(e));
      } else if (booking.status === 'rejected' && oldStatus !== 'rejected') {
        sendBookingRejectedEmail({
          to: customer.email,
          customerName: customer.name,
          bookingId: booking._id.toString(),
          vehicleDetails: vehicleString,
          rejectionReason: 'Owner declined the request.',
          hasPayment: booking.paymentStatus === 'refunded',
          userId: customer._id
        }).catch(e => console.error(e));
      } else if (booking.status === 'cancelled' && oldStatus !== 'cancelled') {
        sendBookingCancelledEmail({
          to: customer.email,
          customerName: customer.name,
          bookingId: booking._id.toString(),
          vehicleDetails: vehicleString,
          cancelDate: new Date(),
          refundEligible: booking.paymentStatus === 'refunded',
          refundAmount: booking.paymentStatus === 'refunded' ? booking.totalPrice : 0,
          userId: customer._id
        }).catch(e => console.error(e));
      } else if (booking.status === 'completed' && oldStatus !== 'completed') {
        sendBookingCompletedEmail({
          to: customer.email,
          customerName: customer.name,
          bookingId: booking._id.toString(),
          vehicleDetails: vehicleString,
          endDate: new Date(),
          totalPaid: booking.totalPrice,
          userId: customer._id
        }).catch(e => console.error(e));
      }
    } catch (emailErr) {
      console.error('Failed to trigger status update emails:', emailErr);
    }

    // Record audit log
    await recordAuditLog({
      action: 'BOOKING_STATUS_CHANGED',
      userId: req.user._id,
      role: req.user.role,
      entityType: 'booking',
      entityId: booking._id,
      oldValue: { status: oldStatus },
      newValue: { status: booking.status, paymentStatus: booking.paymentStatus },
      description: `Booking status changed to ${booking.status}`,
      req
    });

    res.json(updatedBooking);
  } catch (error) {
    if (error.name === 'VersionError') {
      return res.status(409).json({
        message: 'Concurrency conflict: This booking was modified by another request. Please refresh.'
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check booking availability calendar
// @route   GET /api/bookings/availability
// @access  Public
const checkAvailability = async (req, res) => {
  try {
    const { vehicleId, startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const conflictingBookings = await Booking.find({
      vehicleId,
      status: { $in: ['pending', 'active'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    res.json({ available: conflictingBookings.length === 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBookings,
  getBookingById,
  getBookingsByCustomer,
  getBookingsByOwner,
  createBooking,
  updateStatus,
  checkAvailability
};
