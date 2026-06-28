/**
 * ════════════════════════════════════════════════════════════════
 *  DriveX — Production-Ready Email Transporter
 *  ─────────────────────────────────────────────────────────────
 *  Strategy:
 *    1. Resend API (HTTP) ← PRIMARY  — works on Render/Railway/Docker
 *       because it sends over HTTPS (port 443), never SMTP.
 *    2. Nodemailer SMTP (port 587/465) ← FALLBACK — works locally.
 *
 *  Why SMTP fails on cloud hosts:
 *    Render, Railway, Heroku, and most PaaS providers BLOCK outbound
 *    traffic on ports 25, 465 and 587 to prevent spam abuse.
 *    The IPv6 ENETUNREACH error confirms the TCP SYN packet is
 *    being dropped before it even reaches smtp.gmail.com.
 *    No Nodemailer configuration change can fix a firewall block.
 *    Only an HTTP-API based service bypasses this restriction.
 * ════════════════════════════════════════════════════════════════
 */

'use strict';

const dns = require('dns');
const net = require('net');
const nodemailer = require('nodemailer');

// ── Force Node.js DNS to prefer IPv4 (eliminates ENETUNREACH on IPv6) ──
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// ─────────────────────────────────────────────────────────────────
// ENVIRONMENT DETECTOR
// ─────────────────────────────────────────────────────────────────
const detectEnvironment = () => {
  if (process.env.RENDER)       return 'Render';
  if (process.env.RAILWAY_ENVIRONMENT) return 'Railway';
  if (process.env.HEROKU_APP_NAME)     return 'Heroku';
  if (process.env.FLY_APP_NAME)        return 'Fly.io';
  if (process.env.VERCEL)              return 'Vercel';
  // Docker / WSL detection via cgroup
  try {
    const fs = require('fs');
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
    if (cgroup.includes('docker') || cgroup.includes('kubepods')) return 'Docker/K8s';
    const osRelease = fs.readFileSync('/proc/version', 'utf8');
    if (osRelease.toLowerCase().includes('microsoft')) return 'WSL';
  } catch { /* not Linux */ }
  return 'Localhost';
};

// ─────────────────────────────────────────────────────────────────
// DETAILED SMTP ERROR LOGGER
// ─────────────────────────────────────────────────────────────────
const logSmtpError = (label, error) => {
  console.error(`\n❌ [SMTP Failure] ${label}`);
  console.error(`   ↳ Message  : ${error.message}`);
  console.error(`   ↳ Code     : ${error.code     || 'N/A'}`);
  console.error(`   ↳ Command  : ${error.command  || 'N/A'}`);
  console.error(`   ↳ Response : ${error.response || 'N/A'}`);
  console.error(`   ↳ Syscall  : ${error.syscall  || 'N/A'}`);

  const c = error.code;
  if (c === 'ENETUNREACH' || c === 'ESOCKET') {
    console.error('   💡 Cause: Network unreachable — IPv6 routing failure or SMTP port blocked by hosting provider.');
    console.error('   ✅ Fix  : Use Resend / SendGrid (HTTP API) instead of SMTP on cloud hosts.');
  } else if (c === 'ETIMEDOUT' || (error.message || '').includes('timeout')) {
    console.error('   💡 Cause: Connection timeout — outbound ports 587/465 are firewalled by the hosting provider.');
    console.error('   ✅ Fix  : Use Resend / SendGrid (HTTP API). Set RESEND_API_KEY in env vars.');
  } else if (c === 'EAUTH' || (error.message || '').match(/invalid login|password not accepted/i)) {
    console.error('   💡 Cause: Auth failure — wrong password or 2FA without App Password.');
    console.error('   ✅ Fix  : Generate a Gmail App Password at myaccount.google.com/apppasswords');
  } else if (c === 'ENOTFOUND' || error.syscall === 'getaddrinfo') {
    console.error('   💡 Cause: DNS resolution failed — no internet or SMTP hostname is wrong.');
  }
};

// ─────────────────────────────────────────────────────────────────
// TCP PORT PROBE  (non-blocking, best-effort)
// ─────────────────────────────────────────────────────────────────
const probePort = (host, port, timeoutMs = 5000) =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeoutMs);
    sock.connect(port, host, () => { sock.destroy(); resolve(true);  });
    sock.on('timeout', ()      => { sock.destroy(); resolve(false); });
    sock.on('error',   ()      => { sock.destroy(); resolve(false); });
  });

// ─────────────────────────────────────────────────────────────────
// RESEND SENDER  (HTTP API — bypasses all SMTP port restrictions)
// ─────────────────────────────────────────────────────────────────
class ResendSender {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.Resend = require('resend').Resend;
    this.client = new this.Resend(apiKey);
    console.log('📧 [Email] Using Resend HTTP API (SMTP-free, works on all cloud hosts)');
  }

  async verify() {
    // Resend has no verify() equivalent but we can do a lightweight domains list call
    return true;
  }

  async sendMail({ from, to, subject, html, text }) {
    // Resend requires a verified sender domain.
    // On free plan: only 'onboarding@resend.dev' works without domain verification.
    // Using a gmail.com from address will be rejected by Resend's API.
    const safeFrom =
      process.env.RESEND_FROM ||
      'DriveX <onboarding@resend.dev>';

    // Warn if caller tried to use a gmail address (which Resend rejects)
    if (from && from.includes('@gmail.com')) {
      console.warn(`⚠️  [Resend] Cannot use Gmail address as sender ("${from}").`);
      console.warn(`   ↳ Using fallback: ${safeFrom}`);
      console.warn('   ↳ To send from your own domain, verify it at https://resend.com/domains');
    }

    const { data, error } = await this.client.emails.send({
      from: safeFrom,
      to:   Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    });

    if (error) {
      const err = new Error(error.message || 'Resend API error');
      err.resendError = error;
      throw err;
    }

    return { messageId: data?.id || 'resend-ok' };
  }
}

// ─────────────────────────────────────────────────────────────────
// NODEMAILER SMTP SENDER  (works locally; may fail on cloud hosts)
// ─────────────────────────────────────────────────────────────────
const SMTP_CONFIGS = (user, pass, host) => [
  {
    label: 'STARTTLS port 587',
    options: {
      host,
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      tls: { family: 4, rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout:   30000,
      socketTimeout:     30000,
    },
  },
  {
    label: 'Implicit SSL port 465',
    options: {
      host,
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: { family: 4, rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout:   30000,
      socketTimeout:     30000,
    },
  },
];

const createSmtpTransporter = async (user, pass, host) => {
  const configs = SMTP_CONFIGS(user, pass, host);

  for (const cfg of configs) {
    console.log(`📡 [SMTP Test] Probing TCP ${host}:${cfg.options.port}...`);
    const reachable = await probePort(host, cfg.options.port, 6000);
    if (!reachable) {
      console.warn(`⚠️  [SMTP] Port ${cfg.options.port} is NOT reachable (firewall / blocked by host).`);
      continue;
    }

    console.log(`📡 [SMTP Test] Verifying ${cfg.label}...`);
    try {
      const t = nodemailer.createTransport(cfg.options);
      await t.verify();
      console.log(`✅ [SMTP] Connected via ${cfg.label}`);
      return t;
    } catch (err) {
      logSmtpError(cfg.label, err);
    }
  }

  return null; // all SMTP configs failed
};

// ─────────────────────────────────────────────────────────────────
// PUBLIC FACTORY  — call once per request (or cache the instance)
// ─────────────────────────────────────────────────────────────────
let _cachedSender = null;
let _cacheExpiry  = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // re-verify every 5 minutes

const getSender = async () => {
  const now = Date.now();
  if (_cachedSender && now < _cacheExpiry) return _cachedSender;

  const env = detectEnvironment();
  console.log(`\n🌍 [Email] Environment detected: ${env}`);

  // ── 1. Resend API (preferred on cloud) ──
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const sender = new ResendSender(resendKey);
      _cachedSender = sender;
      _cacheExpiry  = now + CACHE_TTL_MS;
      return sender;
    } catch (e) {
      console.error('❌ [Resend] Failed to initialise:', e.message);
    }
  } else {
    console.warn('⚠️  [Email] RESEND_API_KEY not set. Trying SMTP fallback...');
    if (['Render', 'Railway', 'Heroku', 'Fly.io'].includes(env)) {
      console.warn(`\n${'═'.repeat(60)}`);
      console.warn(`🚨 WARNING: Running on ${env} without RESEND_API_KEY.`);
      console.warn('   SMTP ports 465/587 are BLOCKED by this provider.');
      console.warn('   Emails will NOT be delivered until you set RESEND_API_KEY.');
      console.warn('   → Sign up free at https://resend.com (100 emails/day free)');
      console.warn(`${'═'.repeat(60)}\n`);
    }
  }

  // ── 2. Nodemailer SMTP (works locally) ──
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';

  if (user && pass) {
    const smtp = await createSmtpTransporter(user, pass, host);
    if (smtp) {
      _cachedSender = smtp;
      _cacheExpiry  = now + CACHE_TTL_MS;
      return smtp;
    }
  }

  console.error('🚨 [Email] No working email sender could be initialised.');
  console.error('   Set RESEND_API_KEY (recommended) or valid SMTP credentials.');
  return null;
};

// ─────────────────────────────────────────────────────────────────
// SEND MAIL  — unified API for both Resend and Nodemailer
// ─────────────────────────────────────────────────────────────────
const sendMail = async ({ from, to, subject, html, text }) => {
  const sender = await getSender();
  if (!sender) throw new Error('No email sender available. Check RESEND_API_KEY or SMTP credentials.');

  // For Nodemailer (SMTP), use SMTP_FROM; for Resend, let ResendSender pick its own safe address.
  const isResend = sender instanceof ResendSender;
  const fromAddr = isResend
    ? null  // ResendSender will use RESEND_FROM or onboarding@resend.dev
    : (from || process.env.SMTP_FROM || '"DriveX Support" <noreply@drivex.com>');

  return sender.sendMail({ from: fromAddr, to, subject, html, text });
};

// Invalidate cache (useful after env var changes in tests)
const resetSenderCache = () => { _cachedSender = null; _cacheExpiry = 0; };

module.exports = { getSender, sendMail, resetSenderCache, detectEnvironment, probePort };
