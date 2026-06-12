const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  sendEmailOTP,
  verifyEmailOTP,
  changePassword
} = require('../controllers/profileController');

router.get('/me', protect, getProfile);
router.put('/update', protect, updateProfile);
router.post('/send-email-otp', protect, sendEmailOTP);
router.post('/verify-email-otp', protect, verifyEmailOTP);
router.put('/change-password', protect, changePassword);

module.exports = router;
