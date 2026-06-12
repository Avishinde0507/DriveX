const express = require('express');
const router = express.Router();
const { getTestimonials } = require('../controllers/reviewController');

router.get('/', getTestimonials);

module.exports = router;
