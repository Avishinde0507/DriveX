const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // What action was performed
  action: {
    type: String,
    required: true,
    enum: [
      'FARE_UPDATED', 'FARE_LOCKED', 'FARE_OVERRIDE',
      'BOOKING_CREATED', 'BOOKING_STATUS_CHANGED', 'BOOKING_CONFLICT_BLOCKED',
      'COMPLAINT_CREATED', 'COMPLAINT_STATUS_CHANGED', 'COMPLAINT_RESPONDED', 'COMPLAINT_RESOLVED',
      'REFUND_REQUESTED', 'REFUND_APPROVED', 'REFUND_REJECTED', 'REFUND_PROCESSED',
      'REVIEW_CREATED', 'REVIEW_MODERATED', 'REVIEW_HIDDEN',
      'PAYMENT_CAPTURED', 'PAYMENT_DUPLICATE_BLOCKED',
      'VEHICLE_PRICE_UPDATED', 'VEHICLE_LOCKED', 'VEHICLE_UNLOCKED',
      'USER_ROLE_ACTION'
    ]
  },

  // Who performed the action
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['customer', 'owner', 'admin'], required: true },

  // What entity was affected
  entityType: {
    type: String,
    enum: ['booking', 'vehicle', 'complaint', 'refund', 'review', 'payment', 'user'],
    required: true
  },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },

  // Change tracking
  oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  description: { type: String, default: '' },

  // Request metadata
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

auditLogSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
