const Refund = require('../models/Refund');
const Booking = require('../models/Booking');
const { recordAuditLog } = require('../utils/auditLogger');
const {
  sendRefundInitiatedEmail,
  sendRefundCompletedEmail
} = require('../utils/emailService');

// @desc    Request a refund for a cancelled/rejected booking
// @route   POST /api/refunds
// @access  Private/Customer
const requestRefund = async (req, res) => {
  try {
    const { bookingId, refundReason } = req.body;

    if (!bookingId || !refundReason) {
      return res.status(400).json({ success: false, message: 'Booking ID and refund reason are required.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Customer can only request for their own booking
    if (booking.customerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking.' });
    }

    // Must be paid
    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({ success: false, message: 'Refunds can only be requested for paid bookings.' });
    }

    // Check for duplicate refunds
    const existing = await Refund.findOne({ bookingId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A refund has already been requested or processed for this booking.' });
    }

    const refund = new Refund({
      bookingId,
      customerId: booking.customerId,
      paymentTransactionId: booking.transactionId || `TXN_${Date.now()}`,
      originalAmount: booking.totalPrice,
      refundAmount: booking.totalPrice,
      refundReason,
      requestedBy: req.user._id
    });

    await refund.save();

    await recordAuditLog({
      action: 'REFUND_REQUESTED',
      userId: req.user._id,
      role: req.user.role,
      entityType: 'refund',
      entityId: refund._id,
      newValue: { status: refund.status, amount: refund.refundAmount },
      description: `Refund requested for booking: ${bookingId}. Reason: ${refundReason}`,
      req
    });

    // Email Notification (Async)
    sendRefundInitiatedEmail({
      to: req.user.email,
      customerName: req.user.name,
      bookingId: bookingId,
      refundId: refund._id.toString(),
      refundAmount: booking.totalPrice,
      transactionRef: refund.paymentTransactionId,
      userId: req.user._id
    }).catch(err => console.error('Refund initiated email failed:', err));

    res.status(201).json({ success: true, refund });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A duplicate refund request exists for this booking.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all refunds (Admin sees all, Customer sees their own)
// @route   GET /api/refunds
// @access  Private
const getRefunds = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'customer') {
      filter.customerId = req.user._id;
    }

    const refunds = await Refund.find(filter)
      .populate('customerId', 'name email phone')
      .populate('bookingId', 'startDate endDate durationType totalPrice status')
      .sort({ createdAt: -1 });

    res.json({ success: true, refunds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Process/Approve a refund (Admin only)
// @route   PUT /api/refunds/:id/process
// @access  Private/Admin
const processRefund = async (req, res) => {
  try {
    const { status, adminNotes } = req.body; // status: 'success' | 'failed' | 'processing'
    const refund = await Refund.findById(req.params.id);

    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund request not found.' });
    }

    if (refund.status === 'success') {
      return res.status(400).json({ success: false, message: 'Refund has already been successfully processed.' });
    }

    const oldStatus = refund.status;
    refund.status = status;
    if (adminNotes) refund.adminNotes = adminNotes;

    if (status === 'success') {
      refund.processedBy = req.user._id;
      refund.processedAt = Date.now();
      refund.refundTransactionId = `REF_${Date.now()}`;

      // Update related booking payment status to 'refunded'
      const booking = await Booking.findById(refund.bookingId);
      if (booking) {
        booking.paymentStatus = 'refunded';
        await booking.save();
      }
    }

    await refund.save();

    await recordAuditLog({
      action: status === 'success' ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
      userId: req.user._id,
      role: req.user.role,
      entityType: 'refund',
      entityId: refund._id,
      oldValue: { status: oldStatus },
      newValue: { status: refund.status, processedAt: refund.processedAt },
      description: adminNotes || `Refund processed to status: ${status}`,
      req
    });

    // Email Notification (Async)
    if (status === 'success') {
      try {
        const populatedRefund = await Refund.findById(refund._id).populate('customerId', 'name email');
        if (populatedRefund && populatedRefund.customerId) {
          sendRefundCompletedEmail({
            to: populatedRefund.customerId.email,
            customerName: populatedRefund.customerId.name,
            bookingId: refund.bookingId.toString(),
            refundId: refund._id.toString(),
            refundAmount: refund.refundAmount,
            paymentMethod: 'Original Payment Method',
            transactionId: refund.refundTransactionId,
            userId: populatedRefund.customerId._id
          }).catch(err => console.error('Refund completed email failed:', err));
        }
      } catch (err) {
        console.error('Failed to trigger refund completed email:', err);
      }
    }

    res.json({ success: true, refund });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { requestRefund, getRefunds, processRefund };
