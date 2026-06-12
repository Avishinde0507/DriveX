const AuditLog = require('../models/AuditLog');

/**
 * Helper to record audit log.
 * Safe to use without breaking request flow.
 */
const recordAuditLog = async ({
  action,
  userId,
  role,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
  description = '',
  req = null
}) => {
  try {
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      userAgent = req.headers['user-agent'];
    }

    const log = new AuditLog({
      action,
      userId,
      role,
      entityType,
      entityId,
      oldValue,
      newValue,
      description,
      ipAddress,
      userAgent
    });

    await log.save();
    console.log(`[Audit Logged] ${action} on ${entityType}:${entityId} by User ${userId}`);
    return log;
  } catch (error) {
    console.error('❌ Failed to save audit log:', error.message);
    // Do not throw to prevent breaking main business transaction
  }
};

module.exports = { recordAuditLog };
