const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const Complaint = require('../models/Complaint');
const Refund = require('../models/Refund');
const Review = require('../models/Review');

/**
 * Validates ownership of entities based on user role.
 * - Admin always passes.
 * - Customer must match customerId or userId.
 * - Owner must match ownerId or vehicle ownerId.
 */
const validateOwnership = (modelName) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ success: false, message: 'Unauthorized. User context missing.' });
      }

      // Admin has full bypass access
      if (user.role === 'admin') {
        return next();
      }

      let entity;
      switch (modelName.toLowerCase()) {
        case 'booking':
          entity = await Booking.findById(id);
          break;
        case 'vehicle':
          entity = await Vehicle.findById(id);
          break;
        case 'complaint':
          entity = await Complaint.findById(id);
          break;
        case 'refund':
          entity = await Refund.findById(id);
          break;
        case 'review':
          entity = await Review.findById(id);
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid ownership validation model.' });
      }

      if (!entity) {
        return res.status(404).json({ success: false, message: 'Resource not found.' });
      }

      // Customer check
      if (user.role === 'customer') {
        const customerId = entity.customerId || entity.userId || (entity.customerId ? entity.customerId.toString() : null);
        if (customerId && customerId.toString() !== user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied. You do not own this resource.' });
        }
      }

      // Owner check
      if (user.role === 'owner') {
        let ownerId = entity.ownerId;
        // If it's a vehicle, it has ownerId. If it's a booking, it has ownerId.
        // If it's a complaint, it has ownerId. If it's a review, it has ownerId.
        // If it's a refund, we check its booking first or use booking's ownerId.
        if (modelName.toLowerCase() === 'refund') {
          const booking = await Booking.findById(entity.bookingId);
          ownerId = booking ? booking.ownerId : null;
        }

        if (!ownerId && entity.vehicleId) {
          const vehicle = await Vehicle.findById(entity.vehicleId);
          ownerId = vehicle ? vehicle.ownerId : null;
        }

        if (!ownerId || ownerId.toString() !== user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied. Resource does not belong to your agency.' });
        }
      }

      // Attach entity to req for controller optimization
      req.validatedEntity = entity;
      next();
    } catch (error) {
      console.error('Ownership validation error:', error);
      res.status(500).json({ success: false, message: 'Internal server error validating ownership.' });
    }
  };
};

module.exports = { validateOwnership };
