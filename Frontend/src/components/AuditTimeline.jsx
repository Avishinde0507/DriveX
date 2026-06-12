import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { auditAPI } from '../services/api';
import { formatDate } from '../utils/helpers';

export default function AuditTimeline() {
  const { showToast } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [limit, setLimit] = useState(50);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await auditAPI.getAll({
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        limit
      });
      if (res.success) {
        setLogs(res.logs);
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch audit trails.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter, limit]);

  const getActionColor = (action) => {
    if (action.includes('CREATED') || action.includes('APPROVED')) return '#2ecc71';
    if (action.includes('CONFLICT') || action.includes('BLOCKED') || action.includes('FAILED')) return '#e74c3c';
    if (action.includes('UPDATED') || action.includes('CHANGED') || action.includes('OVERRIDE')) return '#f1c40f';
    return 'var(--accent)';
  };

  return (
    <div className="panel animate-visible">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2>Security Audit Logs</h2>
          <p style={{ margin: 0, fontSize: '.8rem', color: 'var(--text-muted)' }}>Real-time immutable transaction security trails</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ padding: '6px 12px', fontSize: '.85rem' }}>
            <option value="">-- All Actions --</option>
            <option value="FARE_OVERRIDE">Fare Override</option>
            <option value="BOOKING_CONFLICT_BLOCKED">Booking Blocked (Conflict)</option>
            <option value="BOOKING_CREATED">Booking Created</option>
            <option value="COMPLAINT_RESOLVED">Complaint Resolved</option>
            <option value="REFUND_APPROVED">Refund Approved</option>
            <option value="REVIEW_MODERATED">Review Moderated</option>
          </select>
          <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} style={{ padding: '6px 12px', fontSize: '.85rem' }}>
            <option value="">-- All Entities --</option>
            <option value="booking">Bookings</option>
            <option value="complaint">Complaints</option>
            <option value="refund">Refunds</option>
            <option value="review">Reviews</option>
            <option value="vehicle">Vehicles</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={fetchLogs} disabled={loading}>
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>}
          </button>
        </div>
      </div>
      <div className="panel-body">
        {loading && logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}><i className="fas fa-spinner fa-spin fa-2x"></i></div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No audit trails match the current filters.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', borderLeft: '2px dashed var(--glass-border)', paddingLeft: '20px', marginLeft: '10px' }}>
            {logs.map(log => (
              <div key={log.id} style={{ position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                {/* Dot */}
                <div style={{
                  position: 'absolute', left: '-29px', top: '18px', width: '14px', height: '14px',
                  borderRadius: '50%', background: getActionColor(log.action), border: '3px solid var(--bg-card)'
                }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{
                      textTransform: 'uppercase', fontWeight: 800, fontSize: '.78rem',
                      color: getActionColor(log.action), padding: '2px 8px',
                      background: 'rgba(255,255,255,0.03)', border: `1px solid ${getActionColor(log.action)}`,
                      borderRadius: '4px', marginRight: '10px'
                    }}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
                      on {log.entityType.toUpperCase()}:{log.entityId?.substring(0, 8)}
                    </span>
                  </div>
                  <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{formatDate(log.createdAt)}</span>
                </div>

                <p style={{ margin: '0 0 8px 0', fontSize: '.9rem', color: 'var(--text-secondary)' }}>
                  {log.description}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '8px' }}>
                  <span>User: <strong>{log.userId?.name || 'Unknown'}</strong> ({log.role.toUpperCase()})</span>
                  <span>IP: <code>{log.ipAddress || 'internal'}</code></span>
                </div>

                {(log.oldValue || log.newValue) && (
                  <div style={{
                    marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)',
                    borderRadius: '4px', fontSize: '.8rem', fontFamily: 'monospace', overflowX: 'auto'
                  }}>
                    {log.oldValue && <div><span style={{ color: '#e74c3c' }}>- PREV:</span> {JSON.stringify(log.oldValue)}</div>}
                    {log.newValue && <div style={{ marginTop: '2px' }}><span style={{ color: '#2ecc71' }}>+ NEW:</span> {JSON.stringify(log.newValue)}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
