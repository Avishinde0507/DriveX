const User = require('../models/User');
const bcrypt = require('bcryptjs');
const {
  sendEmail,
  sendPasswordResetConfirmationEmail,
  sendActivationConfirmationEmail,
  sendEmailVerificationSuccessEmail,
  sendDashboardPasswordChangeEmail
} = require('../utils/emailService');

// ─────────────────────────────────────────────
// @desc    Get current user's profile
// @route   GET /api/profile/me
// @access  Private
// ─────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -otp -otpExpires -emailOtp -emailOtpExpiry');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Update profile (name, phone, city) - NOT email (requires OTP)
// @route   PUT /api/profile/update
// @access  Private
// ─────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, phone, city, company } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Phone validation
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit Indian phone number.' });
    }

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone;
    if (city !== undefined) user.city = city;
    if (company !== undefined) user.company = company;

    await user.save();

    const updatedUser = await User.findById(req.user._id).select('-password -otp -otpExpires -emailOtp -emailOtpExpiry');
    res.status(200).json({ success: true, message: 'Profile updated successfully.', user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Send OTP to new email for verification
// @route   POST /api/profile/send-email-otp
// @access  Private
// ─────────────────────────────────────────────
const sendEmailOTP = async (req, res) => {
  try {
    const { newEmail } = req.body;

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Prevent using same email
    const currentUser = await User.findById(req.user._id);
    if (currentUser.email === newEmail) {
      return res.status(400).json({ success: false, message: 'New email must be different from your current email.' });
    }

    // Prevent duplicate email
    const existing = await User.findOne({ email: newEmail, _id: { $ne: req.user._id } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This email is already in use by another account.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    currentUser.emailOtp = otp;
    currentUser.emailOtpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes
    currentUser.pendingEmail = newEmail;
    await currentUser.save();

    await sendEmail({
      to: newEmail,
      subject: 'Verify your new DriveX email address',
      title: 'Email Verification',
      text: `You requested to change your email on DriveX. Please use the following OTP to verify your new email address (${newEmail}):`,
      otp
    });

    console.log(`📧 [Email Change OTP] Sent to ${newEmail} for user ${currentUser.email}`);
    res.status(200).json({ success: true, message: `Verification code sent to ${newEmail}. Please check your inbox.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Verify OTP and update email
// @route   POST /api/profile/verify-email-otp
// @access  Private
// ─────────────────────────────────────────────
const verifyEmailOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (!user.emailOtp || !user.pendingEmail) {
      return res.status(400).json({ success: false, message: 'No email change request found. Please request a new OTP.' });
    }
    if (user.emailOtp !== otp || user.emailOtpExpiry < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
    }

    const oldEmail = user.email;
    const newEmail = user.pendingEmail;

    user.email = newEmail;
    user.emailOtp = null;
    user.emailOtpExpiry = null;
    user.pendingEmail = null;
    user.isVerified = true;
    await user.save();

    // Send email verification confirmation to new email
    sendEmailVerificationSuccessEmail({ to: newEmail, name: user.name, oldEmail })
      .then(() => console.log(`✅ [Email Change] Confirmation sent to new email ${newEmail}`))
      .catch(emailErr => console.error(`❌ [Email Change Email Failed]:`, emailErr.message));

    const updatedUser = await User.findById(user._id).select('-password -otp -otpExpires -emailOtp -emailOtpExpiry -pendingEmail');
    res.status(200).json({ success: true, message: 'Email updated and verified successfully!', user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc    Change password (requires old password)
// @route   PUT /api/profile/change-password
// @access  Private
// ─────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All password fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirm password do not match.' });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long and contain both letters and numbers.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Verify old password
    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect old password. Please try again.' });
    }

    // Prevent reuse of same password
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return res.status(400).json({ success: false, message: 'New password cannot be the same as your current password.' });
    }

    user.password = newPassword; // Will be hashed in pre-save hook
    await user.save();

    console.log(`🔑 [Dashboard Password Change] Updated successfully for ${user.email}`);

    // Send security notification email
    sendDashboardPasswordChangeEmail({ to: user.email, name: user.name })
      .then(() => console.log(`✅ [Password Change Email] Security notification sent to ${user.email}`))
      .catch(emailErr => console.error(`❌ [Password Change Email Failed]:`, emailErr.message));

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
module.exports = { getProfile, updateProfile, sendEmailOTP, verifyEmailOTP, changePassword };
