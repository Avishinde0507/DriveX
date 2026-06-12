const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { sendEmail, sendPasswordResetConfirmationEmail, sendActivationConfirmationEmail } = require('../utils/emailService');

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
    try {
      await sendEmailVerificationSuccessEmail({ to: newEmail, name: user.name, oldEmail });
      console.log(`✅ [Email Change] Confirmation sent to new email ${newEmail}`);
    } catch (emailErr) {
      console.error(`❌ [Email Change Email Failed]:`, emailErr.message);
    }

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
    try {
      await sendDashboardPasswordChangeEmail({ to: user.email, name: user.name });
      console.log(`✅ [Password Change Email] Security notification sent to ${user.email}`);
    } catch (emailErr) {
      console.error(`❌ [Password Change Email Failed]:`, emailErr.message);
    }

    res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// Email helper: Email verification success notification
// ─────────────────────────────────────────────
const sendEmailVerificationSuccessEmail = async ({ to, name, oldEmail }) => {
  const loginUrl = (process.env.CLIENT_URL || 'http://localhost:3000') + '/login';
  const nodemailer = require('nodemailer');

  let transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false }
    });
  }
  if (!transporter) return;

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { margin:0; padding:0; font-family:'Inter',-apple-system,sans-serif; background:#0d1117; color:#e6edf3; }
      .wrap { max-width:600px; margin:40px auto; background:linear-gradient(135deg,rgba(22,27,34,.98),rgba(13,17,23,.98)); border:1px solid rgba(0,206,201,.2); border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.8); }
      .hdr { background:linear-gradient(90deg,#1a1f2e,#111827); padding:28px 30px; text-align:center; border-bottom:2px solid #00CEC9; }
      .logo { font-size:28px; font-weight:800; color:#fff; letter-spacing:1px; }
      .logo span { color:#00CEC9; }
      .badge { display:inline-block; margin-top:10px; background:rgba(0,206,201,.12); border:1px solid rgba(0,206,201,.3); color:#00CEC9; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:4px 14px; border-radius:20px; }
      .body { padding:36px 30px; }
      .title { font-size:22px; font-weight:700; color:#fff; text-align:center; margin-bottom:6px; }
      .sub { text-align:center; color:#00CEC9; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:24px; }
      .text { font-size:15px; color:#8b949e; margin-bottom:16px; line-height:1.7; }
      .info-box { background:rgba(0,206,201,.05); border:1px solid rgba(0,206,201,.15); border-left:3px solid #00CEC9; border-radius:10px; padding:18px 22px; margin:24px 0; }
      .info-box p { margin:0 0 8px; font-size:14px; color:#8b949e; }
      .info-box p:last-child { margin:0; }
      .info-box strong { color:#e6edf3; }
      .btn-wrap { text-align:center; margin:30px 0; }
      .btn { display:inline-block; background:linear-gradient(135deg,#00CEC9,#89E900); color:#fff !important; text-decoration:none; font-weight:700; font-size:15px; padding:13px 34px; border-radius:8px; }
      .notice { font-size:13px; color:#484f58; border-top:1px solid rgba(255,255,255,.05); padding-top:18px; margin-top:24px; }
      .ftr { background:#090d13; padding:18px; text-align:center; font-size:12px; color:#484f58; border-top:1px solid rgba(0,206,201,.1); }
    </style></head><body>
    <div class="wrap">
      <div class="hdr"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge">✅ Email Verified</div></div>
      <div class="body">
        <h2 class="title">Email Updated Successfully</h2>
        <p class="sub">Account Security Notification</p>
        <p class="text">Dear <strong style="color:#e6edf3;">${name}</strong>,</p>
        <p class="text">Your DriveX account email address has been successfully updated and verified.</p>
        <div class="info-box">
          <p>Previous Email: <strong>${oldEmail}</strong></p>
          <p>New Email: <strong>${to}</strong></p>
          <p>Status: <strong style="color:#00CEC9;">✓ Verified</strong></p>
        </div>
        <p class="text">You can now log in using your new email address.</p>
        <div class="btn-wrap"><a href="${loginUrl}" class="btn" target="_blank">Access DriveX</a></div>
        <div class="notice">
          <p><strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.</p>
          <p>Best Regards,<br><strong style="color:#6e7681;">DriveX Security Team</strong></p>
        </div>
      </div>
      <div class="ftr"><p>&copy; ${new Date().getFullYear()} DriveX Vehicle Rental Management. All rights reserved.</p></div>
    </div>
    </body></html>
  `;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"DriveX Support" <noreply@drivex.com>',
    to,
    subject: 'Your DriveX Email Has Been Successfully Verified',
    html
  });
  console.log(`✉️ [Email Verified] Sent to ${to}. Message ID: ${info.messageId}`);
};

// ─────────────────────────────────────────────
// Email helper: Dashboard password change notification
// ─────────────────────────────────────────────
const sendDashboardPasswordChangeEmail = async ({ to, name }) => {
  const loginUrl = (process.env.CLIENT_URL || 'http://localhost:3000') + '/login';
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const nodemailer = require('nodemailer');

  let transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false }
    });
  }
  if (!transporter) return;

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body { margin:0; padding:0; font-family:'Inter',-apple-system,sans-serif; background:#0d1117; color:#e6edf3; }
      .wrap { max-width:600px; margin:40px auto; background:linear-gradient(135deg,rgba(22,27,34,.98),rgba(13,17,23,.98)); border:1px solid rgba(240,88,12,.25); border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.8); }
      .hdr { background:linear-gradient(90deg,#1a1f2e,#111827); padding:28px 30px; text-align:center; border-bottom:2px solid #f0580c; }
      .logo { font-size:28px; font-weight:800; color:#fff; letter-spacing:1px; }
      .logo span { color:#f0580c; }
      .badge { display:inline-block; margin-top:10px; background:rgba(240,88,12,.12); border:1px solid rgba(240,88,12,.3); color:#f0580c; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:4px 14px; border-radius:20px; }
      .body { padding:36px 30px; }
      .title { font-size:22px; font-weight:700; color:#fff; text-align:center; margin-bottom:6px; }
      .sub { text-align:center; color:#f0580c; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; margin-bottom:24px; }
      .text { font-size:15px; color:#8b949e; margin-bottom:16px; line-height:1.7; }
      .security-box { background:rgba(240,88,12,.05); border:1px solid rgba(240,88,12,.15); border-left:3px solid #f0580c; border-radius:10px; padding:20px 24px; margin:24px 0; }
      .security-box h4 { margin:0 0 12px; color:#f0580c; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
      .security-box ul { padding-left:18px; margin:0; color:#8b949e; font-size:14px; }
      .security-box li { margin-bottom:7px; }
      .ts-box { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:8px; padding:12px 16px; margin:20px 0; font-size:13px; color:#484f58; }
      .ts-box strong { color:#6e7681; }
      .btn-wrap { text-align:center; margin:30px 0; }
      .btn { display:inline-block; background:linear-gradient(135deg,#f0580c,#e84393); color:#fff !important; text-decoration:none; font-weight:700; font-size:15px; padding:13px 34px; border-radius:8px; box-shadow:0 6px 24px rgba(240,88,12,.35); }
      .notice { font-size:13px; color:#484f58; border-top:1px solid rgba(255,255,255,.05); padding-top:18px; margin-top:24px; }
      .ftr { background:#090d13; padding:18px; text-align:center; font-size:12px; color:#484f58; border-top:1px solid rgba(240,88,12,.1); }
    </style></head><body>
    <div class="wrap">
      <div class="hdr"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge">🔒 Security Alert</div></div>
      <div class="body">
        <h2 class="title">Password Was Updated</h2>
        <p class="sub">Account Security Notification</p>
        <p class="text">Dear <strong style="color:#e6edf3;">${name}</strong>,</p>
        <p class="text">Your DriveX account password was successfully updated from your dashboard using old password authentication.</p>
        <div class="security-box">
          <h4>⚠️ Security Information</h4>
          <ul>
            <li>This change was made from the <strong>Manage Profile</strong> section</li>
            <li>Your old password is <strong>no longer valid</strong></li>
            <li>Action time: <strong>${timestamp} IST</strong></li>
            <li>If you did not perform this action, <strong>contact support immediately</strong></li>
          </ul>
        </div>
        <div class="ts-box"><strong>Event:</strong> Dashboard Password Change &nbsp;|&nbsp; <strong>Time:</strong> ${timestamp} IST</div>
        <div class="btn-wrap"><a href="${loginUrl}" class="btn" target="_blank">🔑 Access DriveX</a></div>
        <div class="notice">
          <p>Thank you for keeping your account secure.</p>
          <p>Best Regards,<br><strong style="color:#6e7681;">DriveX Security Team</strong></p>
        </div>
      </div>
      <div class="ftr"><p>&copy; ${new Date().getFullYear()} DriveX Vehicle Rental Management. All rights reserved.</p><p>This is an automated security notification. Do not reply.</p></div>
    </div>
    </body></html>
  `;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"DriveX Support" <noreply@drivex.com>',
    to,
    subject: 'Your DriveX Password Was Updated Successfully',
    html
  });
  console.log(`✉️ [Dashboard PWD Change] Sent to ${to}. Message ID: ${info.messageId}`);
};

module.exports = { getProfile, updateProfile, sendEmailOTP, verifyEmailOTP, changePassword };
