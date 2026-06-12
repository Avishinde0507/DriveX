const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  loginUser,
  verifyOTP,
  resendOTP,
  forgotPassword,
  verifyForgotPasswordOTP,
  resetPassword
} = require('../controllers/authController');
const { getUsers, getUserById, getUsersByRole, toggleActive, updateUser, deleteUser } = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/verify-forgot-otp', verifyForgotPasswordOTP);
router.post('/reset-password', resetPassword);

router.route('/')
  .get(protect, admin, getUsers);

router.route('/:id')
  .get(protect, getUserById)
  .put(protect, updateUser)
  .delete(protect, admin, deleteUser);

router.route('/role/:role')
  .get(protect, admin, getUsersByRole);

router.route('/:id/toggle-active')
  .put(protect, admin, toggleActive);

module.exports = router;
