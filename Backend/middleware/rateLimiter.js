// Simple in-memory request store for rate limiting and duplicate request prevention
const requestHistory = new Map();
const duplicatePreventionStore = new Map();

/**
 * Custom Rate Limiter for Complaints and sensitive operations.
 * Defaults to max 5 requests per 5 minutes per user/IP.
 */
const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 5 * 60 * 1000; // 5 minutes
  const maxRequests = options.max || 5;
  const message = options.message || 'Too many requests. Please try again later.';

  return (req, res, next) => {
    const key = (req.user ? req.user._id.toString() : req.ip) + '_' + req.originalUrl;
    const now = Date.now();

    if (!requestHistory.has(key)) {
      requestHistory.set(key, []);
    }

    const timestamps = requestHistory.get(key);
    // Filter timestamps within window
    const activeTimestamps = timestamps.filter(time => now - time < windowMs);
    activeTimestamps.push(now);
    requestHistory.set(key, activeTimestamps);

    if (activeTimestamps.length > maxRequests) {
      return res.status(429).json({ success: false, message });
    }

    next();
  };
};

/**
 * Middleware to prevent duplicate API requests (e.g., clicking book/pay button twice).
 * Prevents identical requests (same user, method, url, body) within a short window (e.g., 3 seconds).
 */
const preventDuplicates = (windowMs = 3000) => {
  return (req, res, next) => {
    // Only apply to state-changing operations
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return next();
    }

    const userId = req.user ? req.user._id.toString() : req.ip;
    const bodyHash = JSON.stringify(req.body || {});
    const key = `${userId}_${req.method}_${req.originalUrl}_${bodyHash}`;
    const now = Date.now();

    if (duplicatePreventionStore.has(key)) {
      const lastRequestTime = duplicatePreventionStore.get(key);
      if (now - lastRequestTime < windowMs) {
        console.warn(`[Duplicate Request Blocked] Key: ${key}`);
        return res.status(409).json({
          success: false,
          message: 'Duplicate request detected. Your transaction is already being processed. Please wait.'
        });
      }
    }

    duplicatePreventionStore.set(key, now);

    // Clean up cache to prevent memory leak
    setTimeout(() => {
      if (duplicatePreventionStore.get(key) === now) {
        duplicatePreventionStore.delete(key);
      }
    }, windowMs);

    next();
  };
};

module.exports = { rateLimiter, preventDuplicates };
