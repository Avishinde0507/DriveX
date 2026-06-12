const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { featureReview, unfeatureReview } = require('../controllers/reviewController');

router.put('/:id/feature', protect, admin, featureReview);
router.put('/:id/unfeature', protect, admin, unfeatureReview);

module.exports = router;
