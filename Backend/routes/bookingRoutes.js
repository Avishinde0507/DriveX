const express = require('express');
const router = express.Router();
const {
  getBookings, getBookingById, getBookingsByCustomer, getBookingsByOwner,
  createBooking, updateStatus, checkAvailability
} = require('../controllers/bookingController');
const { protect, admin, ownerOrAdmin } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, admin, getBookings)
  .post(protect, createBooking);

router.get('/availability', checkAvailability);
router.get('/customer/:customerId', protect, getBookingsByCustomer);
router.get('/owner/:ownerId', protect, ownerOrAdmin, getBookingsByOwner);

router.route('/:id')
  .get(protect, getBookingById);

router.put('/:id/status', protect, updateStatus);

module.exports = router;
