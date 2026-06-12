const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  complaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', default: null },
  refundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Refund', default: null },
  type: { 
    type: String, 
    required: true,
    enum: [
      'booking_request', 'booking_approved', 'booking_rejected', 'booking_cancelled',
      'refund_initiated', 'refund_completed',
      'complaint_registered', 'complaint_under_review', 'complaint_owner_response', 'complaint_resolved',
      'other'
    ]
  },
  subject: { type: String, required: true },
  recipientEmail: { type: String, required: true },
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
  sentAt: { type: Date, default: Date.now },
  mailProviderResponse: { type: String, default: '' },
  retryCount: { type: Number, default: 0 },
  errorDetails: { type: String, default: null }
}, {
  timestamps: true
});

const EmailLog = mongoose.model('EmailLog', emailLogSchema);
module.exports = EmailLog;
