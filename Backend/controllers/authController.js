const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendEmail, sendActivationConfirmationEmail, sendPasswordResetConfirmationEmail } = require('../utils/emailService');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new user (Unverified initially + sends OTP)
// @route   POST /api/users/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, city, company } = req.body;

    const userExists = await User.findOne({ email });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    if (userExists) {
      if (userExists.isVerified) {
        return res.status(400).json({ success: false, message: 'User already exists' });
      } else {
        // User exists but is unverified, update registration details and send new OTP
        userExists.name = name;
        userExists.password = password; // Will be hashed in pre-save hook
        userExists.role = role;
        userExists.phone = phone || '';
        userExists.city = city || '';
        userExists.company = company || '';
        userExists.otp = otp;
        userExists.otpExpires = otpExpires;

        await userExists.save();

        const emailSent = await sendEmail({
          to: email,
          subject: 'Verify your DriveX Account',
          title: 'Verify Your Email Address',
          text: 'Thank you for registering with DriveX! Please use the following One-Time Password (OTP) to activate your account:',
          otp
        });

        return res.status(200).json({
          success: true,
          message: emailSent
            ? 'Registration updated. Verification OTP sent to email.'
            : 'Registration updated, but email sending failed. Use the OTP below.',
          email: userExists.email,
          isVerified: false,
          ...(!emailSent || process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {})
        });
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      city,
      company,
      isVerified: false,
      otp,
      otpExpires
    });

    if (user) {
      const emailSent = await sendEmail({
        to: email,
        subject: 'Verify your DriveX Account',
        title: 'Verify Your Email Address',
        text: 'Thank you for registering with DriveX! Please use the following One-Time Password (OTP) to activate your account:',
        otp
      });

      res.status(201).json({
        success: true,
        message: emailSent
          ? 'Registration successful! Verification OTP sent to email.'
          : 'Registration successful, but email sending failed. Use the OTP below.',
        email: user.email,
        isVerified: false,
        ...(!emailSent || process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {})
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Auth user & get token (Verifies status)
// @route   POST /api/users/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      // Check if email is verified
      if (!user.isVerified) {
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        const emailSent = await sendEmail({
          to: user.email,
          subject: 'Verify your DriveX Account',
          title: 'Verify Your Email Address',
          text: 'Your email address is not verified yet. Please use the following One-Time Password (OTP) to activate your account:',
          otp
        });

        return res.status(401).json({
          success: false,
          isUnverified: true,
          email: user.email,
          message: emailSent
            ? 'Account not verified. A new verification OTP has been sent to your email.'
            : 'Account not verified, and email sending failed. Use the OTP below.',
          ...(!emailSent || process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {})
        });
      }

      // Check if active
      if (!user.active) {
        return res.status(401).json({ success: false, message: 'Account is deactivated. Contact admin.' });
      }

      res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id)
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP for account activation
// @route   POST /api/users/verify-otp
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'User is already verified.' });
    }

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    // Send confirmation email asynchronously (with robust error handling)
    try {
      await sendActivationConfirmationEmail({
        to: user.email,
        name: user.name
      });
      console.log(`✅ [Activation Email] Sent confirmation successfully to ${user.email}`);
    } catch (emailError) {
      console.error(`❌ [Activation Email Failed] Failed to send confirmation to ${user.email}:`, emailError.message);
    }

    res.status(200).json({
      success: true,
      message: 'Account activated successfully!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Resend OTP code
// @route   POST /api/users/resend-otp
const resendOTP = async (req, res) => {
  try {
    const { email, reason } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const isForgot = reason === 'forgot';
    const emailSent = await sendEmail({
      to: email,
      subject: isForgot ? 'Reset your DriveX Password' : 'Verify your DriveX Account',
      title: isForgot ? 'Password Reset OTP' : 'Verify Your Email Address',
      text: isForgot
        ? 'You requested a password reset. Please use the following One-Time Password (OTP) to securely reset your password:'
        : 'Please use the following One-Time Password (OTP) to activate your account:',
      otp
    });

    res.status(200).json({
      success: true,
      message: emailSent
        ? 'OTP resent successfully.'
        : 'OTP generated, but email sending failed. Use the OTP below.',
      ...(!emailSent || process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {})
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Initiate forgot password (Sends OTP)
// @route   POST /api/users/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No registered account found with this email.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const emailSent = await sendEmail({
      to: email,
      subject: 'Reset your DriveX Password',
      title: 'Password Reset OTP',
      text: 'You requested a password reset. Please use the following One-Time Password (OTP) to verify your request and reset your password:',
      otp
    });

    res.status(200).json({
      success: true,
      message: emailSent
        ? 'OTP sent successfully to your registered email.'
        : 'OTP generated, but email sending failed. Use the OTP below.',
      ...(!emailSent || process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {})
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP for forgot password
// @route   POST /api/users/verify-forgot-otp
const verifyForgotPasswordOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    res.status(200).json({ success: true, message: 'OTP verified. You can now reset your password.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset password after OTP verification
// @route   POST /api/users/reset-password
const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP verification context.' });
    }

    user.password = password; // Will be hashed in pre-save hook
    user.otp = null;
    user.otpExpires = null;
    await user.save();
    console.log(`🔑 [Password Reset] Password updated successfully in DB for ${user.email}`);

    // Send password reset confirmation email (only fires once after successful DB update)
    try {
      await sendPasswordResetConfirmationEmail({ to: user.email, name: user.name });
      console.log(`✅ [Password Reset Email] Security notification sent to ${user.email}`);
    } catch (emailError) {
      console.error(`❌ [Password Reset Email Failed] Could not send notification to ${user.email}:`, emailError.message);
    }

    res.status(200).json({ success: true, message: 'Password has been reset successfully. Please login with your new password.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyOTP,
  resendOTP,
  forgotPassword,
  verifyForgotPasswordOTP,
  resetPassword
};
