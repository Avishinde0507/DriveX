const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { rateLimiter, preventDuplicates } = require('../middleware/rateLimiter');
const {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  getComplaints,
  updateComplaint
} = require('../controllers/complaintController');

// Customer: submit a new complaint (rate limited + duplicate prevention)
router.post(
  '/create',
  protect,
  rateLimiter({ max: 3, windowMs: 10 * 60 * 1000, message: 'Too many complaints submitted. Please try again later.' }),
  preventDuplicates(4000),
  createComplaint
);

// Customer: get their own complaints
router.get('/my-complaints', protect, getMyComplaints);

// Shared (role-filtered): get all complaints visible to the caller
router.get('/', protect, getComplaints);

// Shared: get single complaint by ID (RBAC enforced in controller)
router.get('/:id', protect, getComplaintById);

// Customer: add reply to thread
router.put('/:id/reply', protect, updateComplaint);

module.exports = router;
