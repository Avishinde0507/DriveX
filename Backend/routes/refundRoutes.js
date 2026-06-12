const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { preventDuplicates } = require('../middleware/rateLimiter');
const { validateOwnership } = require('../middleware/ownershipValidator');
const {
  requestRefund,
  getRefunds,
  processRefund
} = require('../controllers/refundController');

router.route('/')
  .post(protect, preventDuplicates(3000), requestRefund)
  .get(protect, getRefunds);

router.route('/:id/process')
  .put(protect, admin, processRefund);

module.exports = router;
