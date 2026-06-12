const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getAdminComplaints, adminUpdateStatus, adminResolveDispute } = require('../controllers/complaintController');

// Admin: get all complaints (with filters, search, pagination)
router.get('/', protect, admin, getAdminComplaints);

// Admin: update complaint status/priority/assignee
router.put('/update-status/:id', protect, admin, adminUpdateStatus);

// Admin: resolve or close a complaint (with refund decision)
router.put('/resolve/:id', protect, admin, adminResolveDispute);

module.exports = router;
