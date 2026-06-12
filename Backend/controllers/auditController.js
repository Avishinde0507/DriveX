const AuditLog = require('../models/AuditLog');

// @desc    Get all audit logs (Admin only)
// @route   GET /api/audit
// @access  Private/Admin
const getAuditLogs = async (req, res) => {
  try {
    const { action, entityType, limit = 50, skip = 0 } = req.query;
    const filter = {};

    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;

    const logs = await AuditLog.find(filter)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await AuditLog.countDocuments(filter);

    res.json({
      success: true,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAuditLogs };
