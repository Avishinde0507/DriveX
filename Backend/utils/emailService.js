const nodemailer = require('nodemailer');
const EmailLog = require('../models/EmailLog');
const dns = require('dns');

// Force DNS lookup to prioritize IPv4 over IPv6 globally
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Helper to log detailed SMTP connection errors
const logDetailedSmtpError = (error) => {
  console.error(`   Message: ${error.message}`);
  console.error(`   Code: ${error.code || 'N/A'}`);
  console.error(`   Command: ${error.command || 'N/A'}`);
  console.error(`   Response: ${error.response || 'N/A'}`);
  console.error(`   Syscall: ${error.syscall || 'N/A'}`);
  
  if (error.code === 'ENOTUNREACH') {
    console.error('   💡 Root Cause: Network Unreachable (ENOTUNREACH). Nodemailer cannot reach the server. This typically means outbound SMTP ports are blocked or IPv6 routing is failing.');
  } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
    console.error('   💡 Root Cause: Connection Timeout. Outbound SMTP ports (587 or 465) are likely blocked by your hosting provider (e.g. Render, Railway, Docker, WSL, or VPS).');
  } else if (error.code === 'EAUTH' || error.message.includes('Invalid login') || error.message.includes('Username and Password not accepted')) {
    console.error('   💡 Root Cause: Authentication Failure. If using Gmail, you MUST use a 16-character GMAIL APP PASSWORD, NOT your regular account password.');
  } else if (error.code === 'EDNS' || error.syscall === 'getaddrinfo') {
    console.error('   💡 Root Cause: DNS resolution failed. Make sure you have active internet connection and can resolve the SMTP hostname.');
  }
};

// ─────────────────────────────────────────────────────────────────
// TRANSPORTER SETUP WITH RETRY AND CONNECTION VERIFICATION
// ─────────────────────────────────────────────────────────────────
const getTransporter = async () => {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';

  if (user && pass) {
    // Port 587 STARTTLS configuration (Primary)
    const primaryConfig = {
      host: host,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: true,
      auth: { user, pass },
      tls: {
        family: 4, // Force IPv4
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    };

    // Port 465 SSL/TLS configuration (Fallback)
    const fallbackConfig = {
      host: host,
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: {
        family: 4, // Force IPv4
        rejectUnauthorized: false
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    };

    const configs = [
      { name: 'Primary (STARTTLS Port 587)', options: primaryConfig },
      { name: 'Fallback (Implicit SSL Port 465)', options: fallbackConfig }
    ];

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      console.log(`📡 [SMTP Connection Test] Verifying ${config.name} for ${user}...`);
      try {
        const transporter = nodemailer.createTransport(config.options);
        // Perform connection test
        await transporter.verify();
        console.log(`✅ [SMTP Connected] Successful verification on ${config.name}`);
        return transporter;
      } catch (error) {
        console.error(`❌ [SMTP Error on ${config.name}]`);
        logDetailedSmtpError(error);

        if (i === configs.length - 1) {
          console.error('🚨 [SMTP Connection Failure] Both primary and fallback Gmail SMTP configurations failed.');
          return null;
        }
        console.log('🔄 [SMTP Retry] Attempting fallback configuration (Port 465)...');
      }
    }
  }

  // Fallback to Ethereal if no credentials are provided at all
  console.log('ℹ️ No Gmail SMTP credentials provided. Creating Ethereal test account...');
  try {
    const testAccount = await nodemailer.createTestAccount();
    const testTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
      tls: { family: 4 },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });
    await testTransporter.verify();
    return testTransporter;
  } catch (err) {
    console.error('❌ Ethereal SMTP failed:', err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────
// BASE HTML STYLES
// ─────────────────────────────────────────────────────────────────
const baseStyles = `
  body { margin:0; padding:0; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0d1117; color:#e6edf3; }
  .wrap { max-width:600px; margin:40px auto; background:linear-gradient(135deg,rgba(22,27,34,.95),rgba(13,17,23,.98)); border:1px solid rgba(240,88,12,.25); border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.7); }
  .header { background:linear-gradient(90deg,#1a1f2e,#111827); padding:28px 30px; text-align:center; border-bottom:2px solid #f0580c; }
  .logo { font-size:28px; font-weight:800; color:#fff; letter-spacing:1px; }
  .logo span { color:#f0580c; }
  .badge { display:inline-block; margin-top:10px; background:rgba(240,88,12,.12); border:1px solid rgba(240,88,12,.3); color:#f0580c; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; padding:4px 14px; border-radius:20px; }
  .content { padding:36px 30px; line-height:1.7; }
  .title { font-size:22px; font-weight:700; color:#fff; margin:0 0 8px; }
  .subtitle { color:#f0580c; font-size:12px; font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-bottom:24px; }
  .text { font-size:15px; color:#8b949e; margin-bottom:14px; }
  .detail-box { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:10px; padding:20px 24px; margin:20px 0; }
  .detail-row { display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid rgba(255,255,255,.05); font-size:14px; }
  .detail-row:last-child { border-bottom:none; }
  .detail-label { color:#484f58; }
  .detail-value { color:#e6edf3; font-weight:600; text-align:right; }
  .timeline { padding:0; margin:20px 0; list-style:none; }
  .timeline li { padding:8px 0 8px 20px; border-left:2px solid #f0580c; margin-left:8px; margin-bottom:8px; font-size:13px; color:#8b949e; position:relative; }
  .timeline li::before { content:''; position:absolute; left:-5px; top:14px; width:8px; height:8px; border-radius:50%; background:#f0580c; }
  .status-badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
  .status-open { background:rgba(240,88,12,.15); color:#f0580c; border:1px solid rgba(240,88,12,.3); }
  .status-review { background:rgba(52,152,219,.15); color:#3498db; border:1px solid rgba(52,152,219,.3); }
  .status-responded { background:rgba(155,89,182,.15); color:#9b59b6; border:1px solid rgba(155,89,182,.3); }
  .status-resolved { background:rgba(46,204,113,.15); color:#2ecc71; border:1px solid rgba(46,204,113,.3); }
  .status-closed { background:rgba(127,140,141,.15); color:#7f8c8d; border:1px solid rgba(127,140,141,.3); }
  .priority-critical { background:rgba(231,76,60,.15); color:#e74c3c; border:1px solid rgba(231,76,60,.3); display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; }
  .priority-high { background:rgba(230,126,34,.15); color:#e67e22; border:1px solid rgba(230,126,34,.3); display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; }
  .priority-medium { background:rgba(241,196,15,.15); color:#f1c40f; border:1px solid rgba(241,196,15,.3); display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; }
  .priority-low { background:rgba(46,204,113,.15); color:#2ecc71; border:1px solid rgba(46,204,113,.3); display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; }
  .cta { text-align:center; margin:28px 0 20px; }
  .btn { display:inline-block; background:linear-gradient(135deg,#f0580c,#e84393); color:#fff !important; text-decoration:none; font-weight:700; font-size:15px; padding:13px 32px; border-radius:8px; box-shadow:0 6px 24px rgba(240,88,12,.35); }
  .alert-box { padding:16px 20px; border-radius:10px; margin:20px 0; font-size:14px; }
  .alert-success { background:rgba(46,204,113,.08); border:1px solid rgba(46,204,113,.25); border-left:3px solid #2ecc71; color:#8b949e; }
  .alert-warning { background:rgba(231,76,60,.08); border:1px solid rgba(231,76,60,.25); border-left:3px solid #e74c3c; color:#8b949e; }
  .footer { background:#090d13; padding:20px; text-align:center; font-size:12px; color:#484f58; border-top:1px solid rgba(240,88,12,.1); }
  .footer a { color:#f0580c; text-decoration:none; }
`;

// ─────────────────────────────────────────────────────────────────
// RETRY LOGIC & LOGGING WRAPPER
// ─────────────────────────────────────────────────────────────────
const sendMailWithRetry = async ({ to, subject, html, logData, consoleMeta, maxRetries = 2 }) => {
  const transporter = await getTransporter();
  let attempt = 0;
  let success = false;
  let providerResponse = '';
  let errorDetails = null;

  console.log('\n═══════════════════════════════════════════');
  console.log(`📧 [DriveX Notification]`);
  console.log(`   To      : ${to}`);
  console.log(`   Subject : ${subject}`);
  if (consoleMeta) Object.entries(consoleMeta).forEach(([k, v]) => console.log(`   ${k.padEnd(8)}: ${v}`));
  console.log('═══════════════════════════════════════════\n');

  while (attempt <= maxRetries && !success) {
    try {
      if (transporter) {
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || '"DriveX Support" <noreply@drivex.com>',
          to, subject, html
        });
        providerResponse = info.response || 'Success';
        success = true;
        const preview = nodemailer.getTestMessageUrl(info);
        if (preview) console.log(`   🔗 Preview: ${preview}`);
      } else {
        errorDetails = 'No transporter available';
        break;
      }
    } catch (e) {
      attempt++;
      errorDetails = e.message;
      console.error(`Email send error (Attempt ${attempt}):`, e.message);
    }
  }

  // Save to DB
  if (logData && logData.userId) {
    try {
      await EmailLog.create({
        userId: logData.userId,
        bookingId: logData.bookingId || null,
        complaintId: logData.complaintId || null,
        refundId: logData.refundId || null,
        type: logData.type || 'other',
        subject: subject,
        recipientEmail: to,
        status: success ? 'sent' : 'failed',
        mailProviderResponse: providerResponse,
        retryCount: Math.max(0, attempt - 1),
        errorDetails: success ? null : errorDetails
      });
    } catch (dbErr) {
      console.error('Failed to save EmailLog:', dbErr.message);
    }
  }
};

const statusLabel = (s) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Open';
const priorityClass = (p) => `priority-${p || 'medium'}`;
const statusClass = (s) => {
  const map = { open: 'status-open', under_review: 'status-review', owner_responded: 'status-responded', admin_verified: 'status-responded', resolved: 'status-resolved', closed: 'status-closed' };
  return map[s] || 'status-open';
};
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';


// ─────────────────────────────────────────────────────────────────
// BOOKING EMAILS
// ─────────────────────────────────────────────────────────────────

const sendBookingRequestEmail = async ({ to, customerName, bookingId, vehicleDetails, startDate, endDate, durationType, fareSummary, userId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge">📅 Booking Request</div></div>
    <div class="content">
      <div class="title">Your Booking Request Has Been Submitted</div>
      <div class="subtitle">Awaiting Owner Approval</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">We've successfully received your booking request. It is currently <strong style="color:#f1c40f">Pending Approval</strong> from the vehicle owner.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Booking ID</span><span class="detail-value" style="color:#f0580c;font-family:monospace">${bookingId}</span></div>
        <div class="detail-row"><span class="detail-label">Vehicle</span><span class="detail-value">${vehicleDetails}</span></div>
        <div class="detail-row"><span class="detail-label">Dates</span><span class="detail-value">${formatDate(startDate)} — ${formatDate(endDate)} (${durationType})</span></div>
        <div class="detail-row"><span class="detail-label">Est. Total</span><span class="detail-value" style="color:#2ecc71">₹${fareSummary}</span></div>
      </div>
      <p class="text" style="font-size:13px;color:#484f58">We will notify you as soon as the owner approves or rejects your request.</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `Your Booking Request Has Been Submitted - ${bookingId}`, html,
    consoleMeta: { 'Booking': bookingId },
    logData: { userId, bookingId, type: 'booking_request' }
  });
};

const sendBookingApprovedEmail = async ({ to, customerName, bookingId, vehicleDetails, startDate, endDate, pickupLocation, fareSummary, ownerPhone, userId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge" style="background:rgba(46,204,113,.15);color:#2ecc71;border-color:rgba(46,204,113,.3)">✅ Booking Confirmed</div></div>
    <div class="content">
      <div class="title">Your DriveX Booking Has Been Approved</div>
      <div class="subtitle" style="color:#2ecc71">Get ready for your trip!</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">Great news! The vehicle owner has approved your booking request.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Booking ID</span><span class="detail-value" style="color:#f0580c;font-family:monospace">${bookingId}</span></div>
        <div class="detail-row"><span class="detail-label">Vehicle</span><span class="detail-value">${vehicleDetails}</span></div>
        <div class="detail-row"><span class="detail-label">Dates</span><span class="detail-value">${formatDate(startDate)} — ${formatDate(endDate)}</span></div>
        <div class="detail-row"><span class="detail-label">Pickup Location</span><span class="detail-value">${pickupLocation}</span></div>
        <div class="detail-row"><span class="detail-label">Contact</span><span class="detail-value">${ownerPhone}</span></div>
        <div class="detail-row" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)"><span class="detail-label">Final Fare</span><span class="detail-value" style="color:#2ecc71;font-size:16px">₹${fareSummary}</span></div>
      </div>
      <div class="alert-box alert-warning" style="margin-top: 20px;">
        <strong style="color:#e74c3c; display:block; margin-bottom:10px;"><span style="font-size: 16px;">⚠️ Mandatory Document Verification</span></strong>
        <p style="margin:0 0 10px 0; color:#8b949e; font-size:13px;">Please ensure you bring the following <strong>original documents</strong> for verification at the time of key handover:</p>
        <ol style="margin:0; padding-left:20px; color:#e6edf3; font-size:14px; font-weight:600; line-height: 1.5;">
          <li>Aadhar Card</li>
          <li>PAN Card</li>
          <li>Driving License</li>
          <li>2 Photographs</li>
        </ol>
        <p style="margin:10px 0 0 0; color:#8b949e; font-size:12px;"><em>Note: The owner will verify these documents before handing over the keys. Failure to present original documents may result in booking cancellation.</em></p>
      </div>
      <div class="cta">
         <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/customer/dashboard" class="btn">View Booking / Pay</a>
      </div>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `Your DriveX Booking Has Been Approved - ${bookingId}`, html,
    consoleMeta: { 'Booking': bookingId },
    logData: { userId, bookingId, type: 'booking_approved' }
  });
};

const sendBookingRejectedEmail = async ({ to, customerName, bookingId, vehicleDetails, rejectionReason, hasPayment, userId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge" style="background:rgba(231,76,60,.15);color:#e74c3c;border-color:rgba(231,76,60,.3)">❌ Booking Rejected</div></div>
    <div class="content">
      <div class="title">Your DriveX Booking Request Was Rejected</div>
      <div class="subtitle" style="color:#e74c3c">We're sorry for the inconvenience</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">Unfortunately, the owner has rejected your booking request for <strong>${vehicleDetails}</strong>.</p>
      ${rejectionReason ? `<div class="alert-box alert-warning"><strong style="color:#e74c3c">Reason:</strong> ${rejectionReason}</div>` : ''}
      ${hasPayment ? `<div class="alert-box alert-success"><strong style="color:#2ecc71">Refund Status:</strong> Since you have already made a payment, a full refund has been automatically initiated. It will reflect in your account within 5-7 business days.</div>` : ''}
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `Your DriveX Booking Request Was Rejected - ${bookingId}`, html,
    consoleMeta: { 'Booking': bookingId },
    logData: { userId, bookingId, type: 'booking_rejected' }
  });
};

const sendBookingCancelledEmail = async ({ to, customerName, bookingId, vehicleDetails, cancelDate, refundEligible, refundAmount, userId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge">🚫 Booking Cancelled</div></div>
    <div class="content">
      <div class="title">Your Booking Has Been Cancelled</div>
      <div class="subtitle">Cancellation Processed Successfully</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">We have successfully cancelled your booking as requested.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Booking ID</span><span class="detail-value" style="color:#f0580c;font-family:monospace">${bookingId}</span></div>
        <div class="detail-row"><span class="detail-label">Vehicle</span><span class="detail-value">${vehicleDetails}</span></div>
        <div class="detail-row"><span class="detail-label">Cancelled On</span><span class="detail-value">${formatDate(cancelDate)}</span></div>
        ${refundEligible ? `<div class="detail-row" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)"><span class="detail-label">Refund Initiated</span><span class="detail-value" style="color:#2ecc71">₹${refundAmount}</span></div>` : ''}
      </div>
      ${refundEligible ? `<p class="text" style="font-size:13px;color:#484f58">Your refund has been initiated and should arrive within standard processing times (5-7 business days).</p>` : ''}
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `Your DriveX Booking Has Been Cancelled Successfully - ${bookingId}`, html,
    consoleMeta: { 'Booking': bookingId },
    logData: { userId, bookingId, type: 'booking_cancelled' }
  });
};

const sendBookingCompletedEmail = async ({ to, customerName, bookingId, vehicleDetails, endDate, totalPaid, userId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge" style="background:rgba(52,152,219,.15);color:#3498db;border-color:rgba(52,152,219,.3)">🏁 Trip Completed</div></div>
    <div class="content">
      <div class="title">Hope You Had a Great Trip!</div>
      <div class="subtitle" style="color:#3498db">Your booking has been marked as completed</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">Your rental period for <strong>${vehicleDetails}</strong> has officially ended.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Booking ID</span><span class="detail-value" style="color:#f0580c;font-family:monospace">${bookingId}</span></div>
        <div class="detail-row"><span class="detail-label">Vehicle</span><span class="detail-value">${vehicleDetails}</span></div>
        <div class="detail-row"><span class="detail-label">Completed On</span><span class="detail-value">${formatDate(endDate)}</span></div>
        <div class="detail-row" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)"><span class="detail-label">Total Paid</span><span class="detail-value" style="color:#2ecc71;font-size:16px">₹${totalPaid}</span></div>
      </div>
      <div class="cta">
         <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/customer/dashboard" class="btn">Leave a Review</a>
      </div>
      <p class="text" style="font-size:13px;color:#484f58;text-align:center;">Thank you for choosing DriveX. We hope to see you again soon!</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `Your DriveX Trip Is Complete - ${bookingId}`, html,
    consoleMeta: { 'Booking': bookingId },
    logData: { userId, bookingId, type: 'booking_completed' }
  });
};

// ─────────────────────────────────────────────────────────────────
// REVIEW EMAILS
// ─────────────────────────────────────────────────────────────────

const sendReviewSubmittedEmail = async ({ to, customerName, bookingId, rating, userId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge" style="background:rgba(241,196,15,.15);color:#f1c40f;border-color:rgba(241,196,15,.3)">⭐ Review Submitted</div></div>
    <div class="content">
      <div class="title">Thank You For Your Review!</div>
      <div class="subtitle" style="color:#f1c40f">Your feedback helps us improve</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">We've received your recent review for booking <strong style="color:#f0580c;font-family:monospace">${bookingId}</strong>.</p>
      <div class="detail-box" style="text-align:center;">
        <div style="font-size:32px;color:#f1c40f;margin-bottom:10px;">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>
        <div style="font-size:14px;color:#8b949e;">You rated this trip ${rating} out of 5 stars.</div>
      </div>
      <p class="text" style="font-size:14px;color:#e6edf3;">Your response is really very important for us and helps future customers make informed decisions.</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `[DriveX] Thank You For Your Review! (${rating} Stars)`, html,
    consoleMeta: { 'Booking': bookingId, 'Rating': rating },
    logData: { userId, bookingId, type: 'review_submitted' }
  });
};

// ─────────────────────────────────────────────────────────────────
// REFUND EMAILS
// ─────────────────────────────────────────────────────────────────

const sendRefundInitiatedEmail = async ({ to, customerName, bookingId, refundId, refundAmount, transactionRef, userId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge">💸 Refund Initiated</div></div>
    <div class="content">
      <div class="title">Your Refund Has Been Initiated</div>
      <div class="subtitle">Processing your refund</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">We have successfully initiated a refund for your booking.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Booking ID</span><span class="detail-value" style="font-family:monospace">${bookingId}</span></div>
        <div class="detail-row"><span class="detail-label">Transaction Ref</span><span class="detail-value" style="font-family:monospace">${transactionRef}</span></div>
        <div class="detail-row"><span class="detail-label">Refund Amount</span><span class="detail-value" style="color:#2ecc71;font-size:16px">₹${refundAmount}</span></div>
      </div>
      <p class="text" style="font-size:13px;color:#484f58">Please allow 5-7 business days for the amount to reflect in your original payment method.</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `Your DriveX Refund Has Been Initiated`, html,
    consoleMeta: { 'Refund': refundId },
    logData: { userId, bookingId, refundId, type: 'refund_initiated' }
  });
};

const sendRefundCompletedEmail = async ({ to, customerName, bookingId, refundId, refundAmount, paymentMethod, transactionId, userId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge" style="background:rgba(46,204,113,.15);color:#2ecc71;border-color:rgba(46,204,113,.3)">✅ Refund Processed</div></div>
    <div class="content">
      <div class="title">Your Refund Was Processed Successfully</div>
      <div class="subtitle" style="color:#2ecc71">Refund complete</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">Your refund has been successfully processed to your original payment method.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value" style="color:#2ecc71;font-size:16px">₹${refundAmount}</span></div>
        <div class="detail-row"><span class="detail-label">Method</span><span class="detail-value">${paymentMethod || 'Original Method'}</span></div>
        <div class="detail-row"><span class="detail-label">Txn ID</span><span class="detail-value" style="font-family:monospace">${transactionId}</span></div>
      </div>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `Your DriveX Refund Was Processed Successfully`, html,
    consoleMeta: { 'Refund': refundId },
    logData: { userId, bookingId, refundId, type: 'refund_completed' }
  });
};

// ─────────────────────────────────────────────────────────────────
// COMPLAINT EMAILS
// ─────────────────────────────────────────────────────────────────

const sendComplaintRegisteredEmail = async ({ to, customerName, complaintId, complaintType, subject, priority, bookingId, userId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge">🗂️ Complaint Registered</div></div>
    <div class="content">
      <div class="title">Complaint Successfully Submitted</div>
      <div class="subtitle">Your concern has been registered with us</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">Your complaint has been received and assigned a tracking ID. Our team will review it shortly and provide an update within 24–48 hours.</p>
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value" style="color:#f0580c;font-family:monospace">${complaintId}</span></div>
        <div class="detail-row"><span class="detail-label">Subject</span><span class="detail-value">${subject}</span></div>
        <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${(complaintType || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span></div>
        <div class="detail-row"><span class="detail-label">Priority</span><span class="detail-value"><span class="${priorityClass(priority)}">${(priority || 'medium').toUpperCase()}</span></span></div>
        <div class="detail-row"><span class="detail-label">Booking Ref</span><span class="detail-value" style="font-family:monospace;font-size:12px">${bookingId}</span></div>
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="status-badge status-open">OPEN</span></span></div>
      </div>
      <p class="text" style="font-size:13px;color:#484f58">You can track your complaint status and view our team's response from your Customer Dashboard under the "Complaints" section.</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p><p>Need help? <a href="#">Contact Support</a></p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `[DriveX] Complaint Registered — ${complaintId}`, html,
    consoleMeta: { 'ID': complaintId, 'Priority': priority },
    logData: { userId, bookingId, complaintId, type: 'complaint_registered' }
  });
};

const sendComplaintUnderReviewEmail = async ({ to, customerName, complaintId, subject, adminNote, userId, bookingId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge">🔍 Under Review</div></div>
    <div class="content">
      <div class="title">Your Complaint Is Under Review</div>
      <div class="subtitle">Our team is actively investigating</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">We want to let you know that your complaint <strong style="color:#f0580c;font-family:monospace">${complaintId}</strong> regarding "<em>${subject}</em>" is now being actively reviewed by our team.</p>
      ${adminNote ? `<div class="alert-box alert-success"><strong style="color:#2ecc71">Team Note:</strong> ${adminNote}</div>` : ''}
      <ul class="timeline">
        <li>Complaint submitted and registered</li>
        <li><strong style="color:#3498db">Under active review by our team (current)</strong></li>
        <li>Owner/Admin response will be posted</li>
        <li>Resolution and closure</li>
      </ul>
      <p class="text" style="font-size:13px;color:#484f58">We aim to resolve all complaints within 48–72 hours. Please check your Dashboard for updates.</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `[DriveX] Complaint Under Review — ${complaintId}`, html,
    consoleMeta: { 'ID': complaintId, 'Status': 'Under Review' },
    logData: { userId, bookingId, complaintId, type: 'complaint_under_review' }
  });
};

const sendOwnerResponseEmail = async ({ to, recipientName, complaintId, subject, ownerName, responseMessage, userId, bookingId }) => {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge">💬 Owner Responded</div></div>
    <div class="content">
      <div class="title">Owner Response Added</div>
      <div class="subtitle">New message on your complaint thread</div>
      <p class="text">Dear <strong style="color:#e6edf3">${recipientName}</strong>,</p>
      <p class="text">The vehicle owner has responded to complaint <strong style="color:#f0580c;font-family:monospace">${complaintId}</strong> — "<em>${subject}</em>".</p>
      <div class="detail-box" style="border-left:3px solid #9b59b6">
        <p style="margin:0 0 8px;font-size:12px;color:#9b59b6;font-weight:700;text-transform:uppercase;letter-spacing:1px">Response from ${ownerName || 'Owner'}</p>
        <p style="margin:0;font-size:14px;color:#e6edf3;line-height:1.6">${responseMessage}</p>
      </div>
      <p class="text" style="font-size:13px;color:#484f58">You can reply to this message and view the full conversation thread in your Dashboard under "Complaints".</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `[DriveX] Owner Response on Complaint ${complaintId}`, html,
    consoleMeta: { 'ID': complaintId, 'From': ownerName },
    logData: { userId, bookingId, complaintId, type: 'complaint_owner_response' }
  });
};

const sendComplaintResolvedEmail = async ({ to, customerName, complaintId, subject, status, resolution, activityLog, userId, bookingId }) => {
  const isClosed = status === 'closed';
  const timeline = (activityLog || []).slice(-4).map(l =>
    `<li>${l.message} <span style="color:#484f58;font-size:11px">— ${formatDate(l.createdAt)}</span></li>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyles}</style></head><body>
  <div class="wrap">
    <div class="header"><img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" /><div class="badge">${isClosed ? '🔒 Complaint Closed' : '✅ Complaint Resolved'}</div></div>
    <div class="content">
      <div class="title">Complaint ${isClosed ? 'Closed' : 'Resolved'}</div>
      <div class="subtitle" style="color:#2ecc71">Your case has been ${isClosed ? 'closed' : 'resolved'}</div>
      <p class="text">Dear <strong style="color:#e6edf3">${customerName}</strong>,</p>
      <p class="text">We are happy to inform you that complaint <strong style="color:#f0580c;font-family:monospace">${complaintId}</strong> regarding "<em>${subject}</em>" has been <strong>${isClosed ? 'closed' : 'resolved'}</strong>.</p>
      ${resolution ? `<div class="alert-box alert-success"><strong style="color:#2ecc71">Admin Resolution:</strong> ${resolution}</div>` : ''}
      <div class="detail-box">
        <div class="detail-row"><span class="detail-label">Complaint ID</span><span class="detail-value" style="font-family:monospace;color:#f0580c">${complaintId}</span></div>
        <div class="detail-row"><span class="detail-label">Final Status</span><span class="detail-value"><span class="status-badge ${statusClass(status)}">${statusLabel(status)}</span></span></div>
        <div class="detail-row"><span class="detail-label">Resolved On</span><span class="detail-value">${formatDate(new Date())}</span></div>
      </div>
      ${timeline ? `<p style="font-size:12px;color:#484f58;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Timeline Summary</p><ul class="timeline">${timeline}</ul>` : ''}
      <p class="text" style="font-size:13px;color:#484f58">Thank you for bringing this to our attention. We continuously work to improve your experience with DriveX.</p>
    </div>
    <div class="footer"><p>&copy; ${new Date().getFullYear()} DriveX. All rights reserved.</p></div>
  </div></body></html>`;

  await sendMailWithRetry({
    to, subject: `[DriveX] Complaint ${isClosed ? 'Closed' : 'Resolved'} — ${complaintId}`, html,
    consoleMeta: { 'ID': complaintId, 'Status': status },
    logData: { userId, bookingId, complaintId, type: 'complaint_resolved' }
  });
};

// ─────────────────────────────────────────────────────────────────
// ORIGINAL AUTH EMAILS (Kept for compatibility)
// ─────────────────────────────────────────────────────────────────

const sendEmail = async ({ to, subject, title, text, otp }) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d1117; color: #e6edf3; -webkit-font-smoothing: antialiased; }
        .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, rgba(22, 27, 34, 0.9) 0%, rgba(13, 17, 23, 0.95) 100%); border: 1px solid rgba(240, 88, 12, 0.2); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 50px rgba(240, 88, 12, 0.05); }
        .header { background: linear-gradient(90deg, #1f2937 0%, #111827 100%); padding: 30px; text-align: center; border-bottom: 2px solid #f0580c; }
        .logo { font-size: 28px; font-weight: 800; color: #ffffff; text-decoration: none; letter-spacing: 1px; }
        .logo span { color: #f0580c; }
        .content { padding: 40px 30px; line-height: 1.6; }
        .title { font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 20px; color: #ffffff; text-align: center; }
        .text { font-size: 16px; color: #8b949e; margin-bottom: 30px; text-align: center; }
        .otp-box { background: rgba(240, 88, 12, 0.08); border: 1px dashed #f0580c; border-radius: 12px; padding: 20px; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #f0580c; text-align: center; margin: 30px auto; max-width: 250px; box-shadow: 0 0 20px rgba(240, 88, 12, 0.1); }
        .footer { background-color: #090d13; padding: 20px; text-align: center; font-size: 12px; color: #484f58; border-top: 1px solid rgba(240, 88, 12, 0.1); }
        .footer a { color: #f0580c; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" />
        </div>
        <div class="content">
          <h2 class="title">${title}</h2>
          <p class="text">${text}</p>
          <div class="otp-box">${otp}</div>
          <p class="text" style="font-size: 14px; color: #484f58; margin-top: 30px;">
            This OTP is valid for 10 minutes. Please do not share it with anyone.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} DriveX Vehicle Rental Management. All rights reserved.</p>
          <p>Need help? Contact our <a href="#">support team</a>.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = await getTransporter();

    // Output formatted OTP in terminal for instant testing
    console.log('\n======================================================');
    console.log(`🔒 [DriveX Security OTP Service]`);
    console.log(`✉️  Recipient : ${to}`);
    console.log(`🔑  OTP Code  : ${otp}`);
    console.log(`📝  Purpose   : ${title}`);
    console.log('======================================================\n');

    if (transporter) {
      const mailOptions = {
        from: process.env.SMTP_FROM || '"DriveX Support" <noreply@drivex.com>',
        to,
        subject,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✉️ Email sent to ${to}. Message ID: ${info.messageId}`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
      }
      return true;
    }

    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    return false;
  }
};

const sendActivationConfirmationEmail = async ({ to, name }) => {
  const loginUrl = (process.env.CLIENT_URL || 'http://localhost:5173') + '/login';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d1117; color: #e6edf3; -webkit-font-smoothing: antialiased; }
        .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, rgba(22, 27, 34, 0.9) 0%, rgba(13, 17, 23, 0.95) 100%); border: 1px solid rgba(0, 206, 201, 0.2); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 50px rgba(0, 206, 201, 0.05); }
        .header { background: linear-gradient(90deg, #1f2937 0%, #111827 100%); padding: 30px; text-align: center; border-bottom: 2px solid #00CEC9; }
        .logo { font-size: 28px; font-weight: 800; color: #ffffff; text-decoration: none; letter-spacing: 1px; }
        .logo span { color: #00CEC9; }
        .content { padding: 40px 30px; line-height: 1.6; }
        .title { font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 20px; color: #ffffff; text-align: center; }
        .text { font-size: 16px; color: #8b949e; margin-bottom: 20px; }
        .btn-container { text-align: center; margin: 35px 0 25px 0; }
        .btn-login { display: inline-block; background: linear-gradient(135deg, #00CEC9, #89E900); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 206, 201, 0.3); }
        .footer { background-color: #090d13; padding: 20px; text-align: center; font-size: 12px; color: #484f58; border-top: 1px solid rgba(0, 206, 201, 0.1); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" />
        </div>
        <div class="content">
          <h2 class="title" style="color: #00CEC9;">Account Activated Successfully</h2>
          <p class="text">Dear ${name},</p>
          <p class="text">Welcome to DriveX.</p>
          <p class="text">Your account has been successfully activated and verified. You can now securely log in and access the platform using the login portal.</p>
          
          <div class="btn-container">
            <a href="${loginUrl}" class="btn-login" target="_blank">Access Login Portal</a>
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} DriveX Vehicle Rental Management. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const mailOptions = {
        from: process.env.SMTP_FROM || '"DriveX Support" <noreply@drivex.com>',
        to,
        subject: 'Your DriveX Account Has Been Successfully Activated',
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`✉️ [Activation Confirmation] Email sent successfully to ${to}. Message ID: ${info.messageId}`);
      return true;
    }
    return true;
  } catch (error) {
    console.error(`❌ [Activation Confirmation Error] Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

const sendPasswordResetConfirmationEmail = async ({ to, name }) => {
  const loginUrl = (process.env.CLIENT_URL || 'http://localhost:5173') + '/login';
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { margin: 0; padding: 0; font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d1117; color: #e6edf3; -webkit-font-smoothing: antialiased; }
        .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, rgba(22, 27, 34, 0.98) 0%, rgba(13, 17, 23, 0.98) 100%); border: 1px solid rgba(240, 88, 12, 0.25); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 60px rgba(240, 88, 12, 0.06); }
        .header { background: linear-gradient(90deg, #1a1f2e 0%, #111827 100%); padding: 28px 30px; text-align: center; border-bottom: 2px solid #f0580c; }
        .logo { font-size: 30px; font-weight: 800; color: #ffffff; letter-spacing: 1px; }
        .logo span { color: #f0580c; }
        .content { padding: 40px 30px; line-height: 1.7; }
        .title { font-size: 22px; font-weight: 700; color: #ffffff; text-align: center; margin: 0 0 8px 0; }
        .text { font-size: 15px; color: #8b949e; margin-bottom: 16px; }
        .btn-container { text-align: center; margin: 32px 0 24px; }
        .btn-login { display: inline-block; background: linear-gradient(135deg, #f0580c, #e84393); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 36px; border-radius: 8px; box-shadow: 0 6px 24px rgba(240, 88, 12, 0.35); letter-spacing: 0.5px; }
        .footer { background-color: #090d13; padding: 20px; text-align: center; font-size: 12px; color: #484f58; border-top: 1px solid rgba(240,88,12,0.1); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${process.env.FRONTEND_URL || 'http://localhost:3000'}/DriveX-logo.png" alt="DriveX" style="height:80px; display:inline-block; vertical-align:middle;" />
        </div>
        <div class="content">
          <h2 class="title">Password Updated Successfully</h2>
          <p class="text">Dear <strong style="color:#e6edf3;">${name}</strong>,</p>
          <p class="text">Your DriveX account password has been updated successfully. This confirms that your password reset request was completed securely using OTP verification.</p>
          <div class="btn-container">
            <a href="${loginUrl}" class="btn-login" target="_blank">🔑 Login to DriveX</a>
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} DriveX Vehicle Rental Management. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"DriveX Support" <noreply@drivex.com>',
        to,
        subject: 'Your DriveX Password Has Been Updated Successfully',
        html: htmlContent,
      });
      console.log(`✅ [Password Reset Email] Confirmation sent to ${to}. Message ID: ${info.messageId}`);
      return true;
    }
    return true;
  } catch (error) {
    console.error(`❌ [Password Reset Email Error] Failed to send to ${to}:`, error.message);
    throw error;
  }
};

const sendEmailVerificationSuccessEmail = async ({ to, name, oldEmail }) => {
  const loginUrl = (process.env.CLIENT_URL || 'http://localhost:3000') + '/login';
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

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"DriveX Support" <noreply@drivex.com>',
        to,
        subject: 'Your DriveX Email Has Been Successfully Verified',
        html
      });
      console.log(`✉️ [Email Verified] Sent to ${to}. Message ID: ${info.messageId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ [Email Change Email Failed]:`, error.message);
    throw error;
  }
};

const sendDashboardPasswordChangeEmail = async ({ to, name }) => {
  const loginUrl = (process.env.CLIENT_URL || 'http://localhost:3000') + '/login';
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
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

  try {
    const transporter = await getTransporter();
    if (transporter) {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"DriveX Support" <noreply@drivex.com>',
        to,
        subject: 'Your DriveX Password Was Updated Successfully',
        html
      });
      console.log(`✉️ [Dashboard PWD Change] Sent to ${to}. Message ID: ${info.messageId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ [Password Change Email Failed]:`, error.message);
    throw error;
  }
};

module.exports = {
  sendBookingRequestEmail,
  sendBookingApprovedEmail,
  sendBookingRejectedEmail,
  sendBookingCancelledEmail,
  sendBookingCompletedEmail,
  sendReviewSubmittedEmail,
  sendRefundInitiatedEmail,
  sendRefundCompletedEmail,
  sendComplaintRegisteredEmail,
  sendComplaintUnderReviewEmail,
  sendOwnerResponseEmail,
  sendComplaintResolvedEmail,
  sendRefundUpdateEmail: sendRefundCompletedEmail,
  sendEmail,
  sendActivationConfirmationEmail,
  sendPasswordResetConfirmationEmail,
  sendEmailVerificationSuccessEmail,
  sendDashboardPasswordChangeEmail
};

