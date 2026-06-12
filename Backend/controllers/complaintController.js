const Complaint = require('../models/Complaint');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { recordAuditLog } = require('../utils/auditLogger');
const {
  sendComplaintRegisteredEmail,
  sendComplaintUnderReviewEmail,
  sendOwnerResponseEmail,
  sendRefundUpdateEmail,
  sendComplaintResolvedEmail
} = require('../utils/emailService');

// ─── Helper: fetch user email safely ─────────────────────────────
const safeGetUser = async (id) => {
  if (!id) return null;
  try { return await User.findById(id).select('name email role'); } catch { return null; }
};

// ─────────────────────────────────────────────────────────────────
// CUSTOMER — POST /api/complaints/create
// ─────────────────────────────────────────────────────────────────
const createComplaint = async (req, res) => {
  try {
    const {
      bookingId, complaintType, category, subject, description,
      priority, attachments, refundRequested
    } = req.body || {};

    if (!bookingId || !subject || !description) {
      return res.status(400).json({ success: false, message: 'bookingId, subject and description are required.' });
    }
    if (!complaintType && !category) {
      return res.status(400).json({ success: false, message: 'complaintType or category is required.' });
    }

    // Verify booking ownership
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
    if (booking.customerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized for this booking.' });
    }

    // Duplicate prevention — same booking within 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicate = await Complaint.findOne({
      bookingId, customerId: req.user._id, createdAt: { $gte: oneDayAgo }
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'A complaint was already submitted for this booking within the last 24 hours.',
        existingComplaintId: duplicate._id
      });
    }

    // Map complaintType → category if needed
    const catMap = {
      booking: 'service', vehicle: 'vehicle_condition', payment: 'payment',
      refund: 'payment', owner_behavior: 'service', trip_issue: 'delay',
      technical_issue: 'ui_bug', other: 'other'
    };
    const resolvedCategory = category || catMap[complaintType] || 'other';

    const complaint = new Complaint({
      customerId: req.user._id,
      bookingId,
      vehicleId: booking.vehicleId,
      ownerId: booking.ownerId,
      complaintType: complaintType || 'other',
      category: resolvedCategory,
      subject,
      description,
      priority: priority || undefined,
      attachments: Array.isArray(attachments) ? attachments : [],
      refundRequested: !!refundRequested,
      refundStatus: refundRequested ? 'pending' : 'none',
      activityLog: [{
        updatedBy: req.user._id,
        role: req.user.role,
        message: 'Complaint submitted by customer.',
        toStatus: 'open'
      }]
    });

    await complaint.save();

    // Audit log
    await recordAuditLog({
      action: 'COMPLAINT_CREATED', userId: req.user._id, role: req.user.role,
      entityType: 'complaint', entityId: complaint._id,
      newValue: { subject, complaintType, priority: complaint.priority },
      description: `Complaint submitted for booking: ${bookingId}`, req
    });

    // Email notifications (non-blocking)
    const customer = req.user;
    const owner = await safeGetUser(booking.ownerId);
    const admins = await User.find({ role: 'admin' }).select('email name').limit(2);

    const emailPayload = {
      customerName: customer.name,
      complaintId: complaint._id.toString(),
      complaintType: complaint.complaintType,
      subject,
      priority: complaint.priority,
      bookingId
    };

    sendComplaintRegisteredEmail({ to: customer.email, userId: customer._id, ...emailPayload }).catch(() => { });
    if (owner) sendComplaintRegisteredEmail({ to: owner.email, userId: owner._id, ...emailPayload }).catch(() => { });
    admins.forEach(a => sendComplaintRegisteredEmail({ to: a.email, userId: a._id, ...emailPayload }).catch(() => { }));

    res.status(201).json({ success: true, complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// CUSTOMER — GET /api/complaints/my-complaints
// ─────────────────────────────────────────────────────────────────
const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ customerId: req.user._id })
      .populate('bookingId', 'startDate endDate durationType totalPrice status')
      .populate('vehicleId', 'name brand model regNumber image')
      .populate('responses.senderId', 'name role')
      .populate('activityLog.updatedBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// SHARED — GET /api/complaints/:id
// ─────────────────────────────────────────────────────────────────
const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('bookingId', 'startDate endDate durationType totalPrice status')
      .populate('vehicleId', 'name brand model regNumber image')
      .populate('ownerId', 'name email phone')
      .populate('assignedAdmin', 'name email')
      .populate('responses.senderId', 'name role')
      .populate('activityLog.updatedBy', 'name role');

    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    // RBAC
    if (req.user.role === 'customer' && complaint.customerId?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'owner' && complaint.ownerId?.toString() !== req.user._id.toString() &&
      complaint.ownerId?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// SHARED — GET /api/complaints (role-based)
// ─────────────────────────────────────────────────────────────────
const getComplaints = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'customer') filter.customerId = req.user._id;
    else if (req.user.role === 'owner') filter.ownerId = req.user._id;

    const complaints = await Complaint.find(filter)
      .populate('customerId', 'name email')
      .populate('bookingId', 'startDate endDate durationType totalPrice')
      .populate('vehicleId', 'name brand model image')
      .sort({ createdAt: -1 });

    res.json({ success: true, complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// OWNER — GET /api/owner/complaints
// ─────────────────────────────────────────────────────────────────
const getOwnerComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ ownerId: req.user._id })
      .populate('customerId', 'name email phone')
      .populate('bookingId', 'startDate endDate durationType totalPrice status')
      .populate('vehicleId', 'name brand model regNumber image')
      .populate('responses.senderId', 'name role')
      .populate('activityLog.updatedBy', 'name role')
      .sort({ createdAt: -1 });

    res.json({ success: true, complaints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// OWNER — POST /api/owner/complaints/respond/:id
// ─────────────────────────────────────────────────────────────────
const ownerRespondComplaint = async (req, res) => {
  try {
    const { message, attachments } = req.body || {};

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'A response message is required.' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    // Verify ownership
    if (complaint.ownerId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to respond to this complaint.' });
    }

    // Owners cannot respond to resolved/closed complaints
    if (['resolved', 'closed'].includes(complaint.status)) {
      return res.status(400).json({ success: false, message: 'Cannot respond to a resolved or closed complaint.' });
    }

    const oldStatus = complaint.status;

    // Add to response thread
    complaint.responses.push({
      senderId: req.user._id,
      role: 'owner',
      message: message.trim(),
      attachments: Array.isArray(attachments) ? attachments : []
    });

    // Update status to owner_responded
    complaint.status = 'owner_responded';
    complaint.activityLog.push({
      updatedBy: req.user._id,
      role: 'owner',
      message: `Owner responded: "${message.trim().substring(0, 80)}${message.length > 80 ? '...' : ''}"`,
      fromStatus: oldStatus,
      toStatus: 'owner_responded'
    });

    await complaint.save();

    await recordAuditLog({
      action: 'COMPLAINT_OWNER_RESPONDED', userId: req.user._id, role: req.user.role,
      entityType: 'complaint', entityId: complaint._id,
      oldValue: { status: oldStatus }, newValue: { status: 'owner_responded' },
      description: 'Owner responded to complaint', req
    });

    // Notify customer and admins
    const customer = await safeGetUser(complaint.customerId);
    const admins = await User.find({ role: 'admin' }).select('email name').limit(2);
    const owner = req.user;

    const emailPayload = {
      complaintId: complaint._id.toString(),
      subject: complaint.subject,
      ownerName: owner.name,
      responseMessage: message,
      bookingId: complaint.bookingId ? complaint.bookingId.toString() : null
    };
    if (customer) sendOwnerResponseEmail({ to: customer.email, recipientName: customer.name, userId: customer._id, ...emailPayload }).catch(() => { });
    admins.forEach(a => sendOwnerResponseEmail({ to: a.email, recipientName: a.name, userId: a._id, ...emailPayload }).catch(() => { }));

    const updated = await Complaint.findById(complaint._id)
      .populate('responses.senderId', 'name role')
      .populate('activityLog.updatedBy', 'name role');

    res.json({ success: true, complaint: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// ADMIN — GET /api/admin/complaints
// ─────────────────────────────────────────────────────────────────
const getAdminComplaints = async (req, res) => {
  try {
    const { status, priority, complaintType, search, sortBy = 'createdAt', order = 'desc', page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (complaintType) filter.complaintType = complaintType;
    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .populate('customerId', 'name email phone')
        .populate('bookingId', 'startDate endDate durationType totalPrice status')
        .populate('vehicleId', 'name brand model image regNumber')
        .populate('ownerId', 'name email')
        .populate('assignedAdmin', 'name email')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Complaint.countDocuments(filter)
    ]);

    // Analytics aggregation
    const [analytics] = await Complaint.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          under_review: { $sum: { $cond: [{ $eq: ['$status', 'under_review'] }, 1, 0] } },
          owner_responded: { $sum: { $cond: [{ $eq: ['$status', 'owner_responded'] }, 1, 0] } },
          admin_verified: { $sum: { $cond: [{ $eq: ['$status', 'admin_verified'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
          refundPending: { $sum: { $cond: [{ $eq: ['$refundStatus', 'pending'] }, 1, 0] } },
          refundApproved: { $sum: { $cond: [{ $eq: ['$refundStatus', 'approved'] }, 1, 0] } }
        }
      }
    ]);

    res.json({ success: true, complaints, total, page: parseInt(page), analytics: analytics || {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// ADMIN — PUT /api/admin/complaints/update-status/:id
// ─────────────────────────────────────────────────────────────────
const adminUpdateStatus = async (req, res) => {
  try {
    const { status, priority, assignedAdmin, message } = req.body || {};

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    const oldStatus = complaint.status;
    const oldPriority = complaint.priority;

    if (status) {
      if (complaint.status === 'closed') {
        return res.status(400).json({ success: false, message: 'A closed complaint cannot be reopened.' });
      }
      complaint.status = status;
    }
    if (priority) complaint.priority = priority;
    if (assignedAdmin) complaint.assignedAdmin = assignedAdmin;

    const logMsg = message || `Status updated to "${status || complaint.status}" by admin.`;
    complaint.activityLog.push({
      updatedBy: req.user._id,
      role: 'admin',
      message: logMsg,
      fromStatus: oldStatus,
      toStatus: complaint.status
    });

    await complaint.save();

    await recordAuditLog({
      action: 'COMPLAINT_ADMIN_UPDATE', userId: req.user._id, role: req.user.role,
      entityType: 'complaint', entityId: complaint._id,
      oldValue: { status: oldStatus, priority: oldPriority },
      newValue: { status: complaint.status, priority: complaint.priority },
      description: logMsg, req
    });

    // Notify customer when status changes to under_review
    if (status === 'under_review') {
      const customer = await safeGetUser(complaint.customerId);
      if (customer) {
        sendComplaintUnderReviewEmail({
          to: customer.email, customerName: customer.name,
          complaintId: complaint._id.toString(),
          subject: complaint.subject, adminNote: message,
          userId: customer._id, bookingId: complaint.bookingId ? complaint.bookingId.toString() : null
        }).catch(() => { });
      }
    }

    res.json({ success: true, complaint });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// ADMIN — PUT /api/admin/complaints/resolve/:id
// ─────────────────────────────────────────────────────────────────
const adminResolveDispute = async (req, res) => {
  try {
    const { resolution, status, refundStatus, refundAmount, message } = req.body || {};

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    if (complaint.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Complaint is already closed.' });
    }

    const oldStatus = complaint.status;
    const finalStatus = status || 'resolved';

    if (resolution) {
      complaint.resolution = resolution;
      complaint.resolvedBy = req.user._id;
      complaint.resolvedAt = new Date();
    }
    complaint.status = finalStatus;

    // Handle refund decision
    let refundChanged = false;
    if (refundStatus && ['approved', 'rejected'].includes(refundStatus) && complaint.refundRequested) {
      complaint.refundStatus = refundStatus;
      refundChanged = true;
    }

    const logMsg = message || resolution || `Complaint ${finalStatus} by admin.`;
    complaint.activityLog.push({
      updatedBy: req.user._id,
      role: 'admin',
      message: logMsg,
      fromStatus: oldStatus,
      toStatus: finalStatus
    });

    await complaint.save();

    await recordAuditLog({
      action: finalStatus === 'closed' ? 'COMPLAINT_CLOSED' : 'COMPLAINT_RESOLVED',
      userId: req.user._id, role: req.user.role,
      entityType: 'complaint', entityId: complaint._id,
      oldValue: { status: oldStatus }, newValue: { status: finalStatus, refundStatus },
      description: logMsg, req
    });

    // Fire email notifications (non-blocking)
    const customer = await safeGetUser(complaint.customerId);
    const owner = await safeGetUser(complaint.ownerId);

    if (customer) {
      sendComplaintResolvedEmail({
        to: customer.email, customerName: customer.name,
        complaintId: complaint._id.toString(), subject: complaint.subject,
        status: finalStatus, resolution, activityLog: complaint.activityLog,
        userId: customer._id, bookingId: complaint.bookingId ? complaint.bookingId.toString() : null
      }).catch(() => { });

      if (refundChanged) {
        sendRefundUpdateEmail({
          to: customer.email, customerName: customer.name,
          complaintId: complaint._id.toString(),
          refundStatus, bookingId: complaint.bookingId?.toString(), amount: refundAmount,
          userId: customer._id
        }).catch(() => { });
      }
    }
    if (owner) {
      sendComplaintResolvedEmail({
        to: owner.email, customerName: owner.name,
        complaintId: complaint._id.toString(), subject: complaint.subject,
        status: finalStatus, resolution, activityLog: complaint.activityLog,
        userId: owner._id, bookingId: complaint.bookingId ? complaint.bookingId.toString() : null
      }).catch(() => { });
    }

    const updated = await Complaint.findById(complaint._id)
      .populate('customerId', 'name email')
      .populate('vehicleId', 'name brand model')
      .populate('activityLog.updatedBy', 'name role')
      .populate('responses.senderId', 'name role');

    res.json({ success: true, complaint: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// SHARED — Legacy updateComplaint (generic put for customer reply)
// ─────────────────────────────────────────────────────────────────
const updateComplaint = async (req, res) => {
  try {
    const { message, attachments } = req.body || {};
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    // Customer can only reply to own complaint
    if (req.user.role === 'customer' && complaint.customerId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (['resolved', 'closed'].includes(complaint.status)) {
      return res.status(400).json({ success: false, message: 'Cannot reply to a resolved or closed complaint.' });
    }

    if (message) {
      complaint.responses.push({
        senderId: req.user._id,
        role: req.user.role,
        message: message.trim(),
        attachments: Array.isArray(attachments) ? attachments : []
      });
      complaint.activityLog.push({
        updatedBy: req.user._id,
        role: req.user.role,
        message: `${req.user.role === 'customer' ? 'Customer' : 'User'} replied to complaint thread.`,
        fromStatus: complaint.status,
        toStatus: complaint.status
      });
    }

    await complaint.save();

    const updated = await Complaint.findById(complaint._id)
      .populate('responses.senderId', 'name role')
      .populate('activityLog.updatedBy', 'name role');

    res.json({ success: true, complaint: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createComplaint, getMyComplaints, getComplaintById, getComplaints,
  getOwnerComplaints, ownerRespondComplaint,
  getAdminComplaints, adminUpdateStatus, adminResolveDispute,
  updateComplaint
};
