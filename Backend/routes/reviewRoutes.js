const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { preventDuplicates } = require('../middleware/rateLimiter');
const {
  submitReview,
  getVehicleReviews,
  getReviews,
  moderateReview,
  deleteReview
} = require('../controllers/reviewController');

router.route('/')
  .post(protect, preventDuplicates(3000), submitReview)
  .get(protect, getReviews);

router.get('/vehicle/:vehicleId', getVehicleReviews);

router.route('/:id/moderate')
  .put(protect, admin, moderateReview);

router.route('/:id')
  .delete(protect, admin, deleteReview);

module.exports = router;
