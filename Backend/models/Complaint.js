const mongoose = require('mongoose');

// Activity log sub-schema — append-only, never overwrite
const activitySchema = new mongoose.Schema({
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['customer', 'owner', 'admin'], required: true },
  message: { type: String, required: true },
  fromStatus: { type: String, default: null },
  toStatus: { type: String, default: null },
}, { timestamps: true, _id: true });

// Responses thread sub-schema
const responseSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['customer', 'owner', 'admin'], required: true },
  message: { type: String, required: true },
  attachments: [{ type: String }],
}, { timestamps: true, _id: true });

const complaintSchema = new mongoose.Schema({
  // Who filed it
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // What it's about
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Complaint details
  complaintType: {
    type: String,
    required: true,
    enum: ['booking', 'vehicle', 'payment', 'refund', 'owner_behavior', 'trip_issue', 'technical_issue', 'other'],
    default: 'other'
  },
  subject: { type: String, required: true, maxlength: 200 },
  description: { type: String, required: true, maxlength: 2000 },

  // Legacy category support for backward compatibility
  category: {
    type: String,
    required: true,
    enum: ['safety', 'payment', 'delay', 'vehicle_condition', 'service', 'ui_bug', 'other'],
    default: 'other'
  },

  // Priority — low, medium, high, critical
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'medium'
  },

  // Workflow state machine
  status: {
    type: String,
    enum: ['open', 'under_review', 'owner_responded', 'admin_verified', 'resolved', 'closed'],
    default: 'open'
  },

  // File attachments / proof screenshots
  attachments: [{ type: String }],

  // Refund / dispute request fields
  refundRequested: { type: Boolean, default: false },
  refundStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'none'],
    default: 'none'
  },

  // Admin routing
  assignedAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Resolution
  resolution: { type: String, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },

  // Reply message thread & timeline
  responses: [responseSchema],
  activityLog: [activitySchema],

  // Optimistic concurrency control
  __v: { type: Number, select: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Prevent duplicate complaints for same booking within 24 hours
complaintSchema.index(
  { bookingId: 1, customerId: 1, createdAt: -1 },
);

// Efficient lookup indexes
complaintSchema.index({ customerId: 1, status: 1 });
complaintSchema.index({ ownerId: 1, status: 1 });
complaintSchema.index({ status: 1, priority: 1 });

// Auto-set priority based on category/complaintType
complaintSchema.pre('save', function () {
  if (this.isNew) {
    // Map complaintType to legacy category if category not set or other
    if (this.complaintType && (!this.category || this.category === 'other')) {
      const catMap = {
        booking: 'service',
        vehicle: 'vehicle_condition',
        payment: 'payment',
        refund: 'payment',
        owner_behavior: 'service',
        trip_issue: 'delay',
        technical_issue: 'ui_bug'
      };
      this.category = catMap[this.complaintType] || 'other';
    }

    const priorityMap = {
      safety: 'critical',
      payment: 'high',
      vehicle_condition: 'high',
      delay: 'medium',
      service: 'medium',
      ui_bug: 'low',
      other: 'low'
    };

    const typePriorityMap = {
      booking: 'medium',
      vehicle: 'high',
      payment: 'high',
      refund: 'high',
      owner_behavior: 'medium',
      trip_issue: 'medium',
      technical_issue: 'low'
    };

    if (!this.priority || this.priority === 'medium') {
      this.priority = priorityMap[this.category] || typePriorityMap[this.complaintType] || 'medium';
    }
  }
});

complaintSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

const Complaint = mongoose.model('Complaint', complaintSchema);
module.exports = Complaint;
