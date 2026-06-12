const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { getAuditLogs } = require('../controllers/auditController');

router.get('/', protect, admin, getAuditLogs);

module.exports = router;
