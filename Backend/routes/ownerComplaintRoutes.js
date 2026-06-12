const express = require('express');
const router = express.Router();
const { protect, ownerOrAdmin } = require('../middleware/authMiddleware');
const { getOwnerComplaints, ownerRespondComplaint } = require('../controllers/complaintController');

// Owner: view complaints related to their vehicles/bookings
router.get('/', protect, ownerOrAdmin, getOwnerComplaints);

// Owner: respond to a specific complaint
router.post('/respond/:id', protect, ownerOrAdmin, ownerRespondComplaint);

module.exports = router;
