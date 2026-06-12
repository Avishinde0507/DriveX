import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { complaintAPI, vehicleAPI } from '../services/api';
import { formatDate } from '../utils/helpers';

// ─── Status/Priority helpers ──────────────────────────────────────
const STATUS_COLORS = {
  open: { bg: 'rgba(240,88,12,.15)', color: '#f0580c', border: 'rgba(240,88,12,.3)' },
  under_review: { bg: 'rgba(52,152,219,.15)', color: '#3498db', border: 'rgba(52,152,219,.3)' },
  owner_responded: { bg: 'rgba(155,89,182,.15)', color: '#9b59b6', border: 'rgba(155,89,182,.3)' },
  admin_verified: { bg: 'rgba(0,206,201,.15)', color: '#00CEC9', border: 'rgba(0,206,201,.3)' },
  resolved: { bg: 'rgba(46,204,113,.15)', color: '#2ecc71', border: 'rgba(46,204,113,.3)' },
  closed: { bg: 'rgba(127,140,141,.15)', color: '#7f8c8d', border: 'rgba(127,140,141,.3)' },
};
const PRIORITY_COLORS = {
  critical: { bg: 'rgba(231,76,60,.15)', color: '#e74c3c', border: 'rgba(231,76,60,.3)' },
  high: { bg: 'rgba(230,126,34,.15)', color: '#e67e22', border: 'rgba(230,126,34,.3)' },
  medium: { bg: 'rgba(241,196,15,.15)', color: '#f1c40f', border: 'rgba(241,196,15,.3)' },
  low: { bg: 'rgba(46,204,113,.15)', color: '#2ecc71', border: 'rgba(46,204,113,.3)' },
};
const Badge = ({ label, colors }) => (
  <span style={{
    display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
    fontSize: '.72rem', fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase',
    background: colors?.bg, color: colors?.color, border: `1px solid ${colors?.border}`
  }}>{label}</span>
);
const StatusBadge = ({ status }) => <Badge label={(status || 'open').replace(/_/g, ' ')} colors={STATUS_COLORS[status] || STATUS_COLORS.open} />;
const PriorityBadge = ({ priority }) => <Badge label={priority || 'medium'} colors={PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium} />;

// ─── Role icons ───────────────────────────────────────────────────
const ROLE_ICON = { customer: 'fa-user', owner: 'fa-car', admin: 'fa-shield-alt' };
const ROLE_COLOR = { customer: '#3498db', owner: '#9b59b6', admin: '#f0580c' };

// ─── Stat card ────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)', padding: '18px 20px',
    display: 'flex', alignItems: 'center', gap: '14px'
  }}>
    <div style={{
      width: '42px', height: '42px', borderRadius: '10px', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: `${color}22`, color, fontSize: '1.1rem', flexShrink: 0
    }}>
      <i className={`fas ${icon}`} />
    </div>
    <div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{value ?? 0}</div>
      <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>{label}</div>
    </div>
  </div>
);

// ─── Timeline entry ───────────────────────────────────────────────
const TimelineEntry = ({ log, idx }) => (
  <div key={log._id || idx} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%',
        background: `${ROLE_COLOR[log.role] || 'var(--accent)'}22`,
        border: `2px solid ${ROLE_COLOR[log.role] || 'var(--accent)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: ROLE_COLOR[log.role] || 'var(--accent)', fontSize: '.8rem'
      }}>
        <i className={`fas ${ROLE_ICON[log.role] || 'fa-info'}`} />
      </div>
      {idx !== undefined && <div style={{ width: '2px', flexGrow: 1, background: 'var(--glass-border)', marginTop: '4px' }} />}
    </div>
    <div style={{ paddingBottom: '16px', flex: 1 }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--text-primary)' }}>
          {log.updatedBy?.name || (log.role ? log.role.charAt(0).toUpperCase() + log.role.slice(1) : 'System')}
        </span>
        <span style={{
          fontSize: '.68rem', padding: '1px 7px', borderRadius: '10px', fontWeight: 700,
          background: `${ROLE_COLOR[log.role] || 'var(--accent)'}22`,
          color: ROLE_COLOR[log.role] || 'var(--accent)'
        }}>{log.role?.toUpperCase()}</span>
        {log.toStatus && <StatusBadge status={log.toStatus} />}
        <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatDate(log.createdAt)}</span>
      </div>
      <p style={{ margin: 0, fontSize: '.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{log.message}</p>
    </div>
  </div>
);

// ─── Thread message ───────────────────────────────────────────────
const ThreadMessage = ({ msg, currentUserId }) => {
  const isMe = msg.senderId?._id === currentUserId || msg.senderId === currentUserId;
  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
      <div style={{
        maxWidth: '80%', padding: '12px 16px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isMe ? 'var(--accent)' : 'rgba(255,255,255,.05)',
        border: `1px solid ${isMe ? 'transparent' : 'var(--glass-border)'}`,
        color: isMe ? '#fff' : 'var(--text-primary)'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '.75rem', fontWeight: 700, opacity: .85 }}>
            {msg.senderId?.name || 'User'}
          </span>
          <span style={{
            fontSize: '.65rem', padding: '1px 6px', borderRadius: '10px',
            background: 'rgba(255,255,255,.15)', fontWeight: 700
          }}>{(msg.role || '').toUpperCase()}</span>
        </div>
        <p style={{ margin: 0, fontSize: '.9rem', lineHeight: 1.5 }}>{msg.message}</p>
        <div style={{ fontSize: '.68rem', opacity: .6, marginTop: '5px', textAlign: isMe ? 'right' : 'left' }}>
          {formatDate(msg.createdAt)}
        </div>
      </div>
    </div>
  );
};

// ─── Main Panel ───────────────────────────────────────────────────
export default function ComplaintPanel({ bookings = [], userRole }) {
  const { currentUser, showToast } = useApp();
  const [complaints, setComplaints] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'form' | 'detail'

  // Filters (admin)
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  // Form state (customer)
  const [form, setForm] = useState({
    bookingId: '', complaintType: 'booking', subject: '', description: '',
    priority: 'medium', attachments: '', refundRequested: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingFiles(true);
    try {
      const urls = await Promise.all(files.map(f => vehicleAPI.uploadImage(f)));
      const current = form.attachments ? form.attachments.split(',').map(s => s.trim()).filter(Boolean) : [];
      setForm(f => ({ ...f, attachments: [...current, ...urls].join(', ') }));
      showToast('Files uploaded successfully', 'success');
    } catch (err) {
      showToast('File upload failed: ' + err.message, 'error');
    } finally {
      setUploadingFiles(false);
    }
  };

  // Reply/response state
  const [replyMsg, setReplyMsg] = useState('');
  const [replying, setReplying] = useState(false);

  // Admin action state
  const [adminStatus, setAdminStatus] = useState('');
  const [adminPriority, setAdminPriority] = useState('');
  const [adminAssignee, setAdminAssignee] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [refundDecision, setRefundDecision] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [updating, setUpdating] = useState(false);

  // ─── Fetch ───────────────────────────────────────────────────────
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (userRole === 'admin') {
        const params = {};
        if (filterStatus) params.status = filterStatus;
        if (filterPriority) params.priority = filterPriority;
        if (filterType) params.complaintType = filterType;
        if (search) params.search = search;
        res = await complaintAPI.adminGetAll(params);
        setAnalytics(res.analytics || {});
      } else if (userRole === 'owner') {
        res = await complaintAPI.ownerGetAll();
      } else {
        res = await complaintAPI.getMyComplaints();
      }
      setComplaints(res.complaints || []);
    } catch (err) {
      showToast(err.message || 'Failed to load complaints.', 'error');
    } finally {
      setLoading(false);
    }
  }, [userRole, filterStatus, filterPriority, filterType, search]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const openDetail = async (c) => {
    setLoading(true);
    try {
      const res = await complaintAPI.getById(c.id || c._id);
      setActive(res.complaint);
      setAdminStatus(res.complaint.status);
      setAdminPriority(res.complaint.priority);
      setAdminAssignee('');
      setAdminNote('');
      setResolution('');
      setRefundDecision('');
      setView('detail');
    } catch (err) {
      showToast('Failed to load complaint details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Customer: Submit ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim()) return showToast('Subject is required.', 'error');
    if (!form.description.trim()) return showToast('Description is required.', 'error');

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        attachments: form.attachments ? form.attachments.split(',').map(s => s.trim()).filter(Boolean) : []
      };
      await complaintAPI.create(payload);
      showToast('✅ Complaint submitted successfully!', 'success');
      setForm({ bookingId: '', complaintType: 'booking', subject: '', description: '', priority: 'medium', attachments: '', refundRequested: false });
      setView('list');
      fetchComplaints();
    } catch (err) {
      showToast(err.message || 'Submission failed. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Customer Reply ───────────────────────────────────────────────
  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyMsg.trim()) return;
    setReplying(true);
    try {
      const res = await complaintAPI.reply(active.id || active._id, { message: replyMsg });
      setActive(res.complaint);
      setReplyMsg('');
      showToast('Reply sent.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to send reply.', 'error');
    } finally {
      setReplying(false);
    }
  };

  // ─── Owner: Respond ───────────────────────────────────────────────
  const handleOwnerRespond = async (e) => {
    e.preventDefault();
    if (!replyMsg.trim()) return showToast('Response message is required.', 'error');
    setReplying(true);
    try {
      const res = await complaintAPI.ownerRespond(active.id || active._id, { message: replyMsg });
      setActive(res.complaint);
      setReplyMsg('');
      showToast('✅ Response submitted!', 'success');
      fetchComplaints();
    } catch (err) {
      showToast(err.message || 'Failed to respond.', 'error');
    } finally {
      setReplying(false);
    }
  };

  // ─── Admin: Update Status ─────────────────────────────────────────
  const handleAdminUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await complaintAPI.adminUpdateStatus(active.id || active._id, {
        status: adminStatus, priority: adminPriority,
        assignedAdmin: adminAssignee || undefined,
        message: adminNote || undefined
      });
      showToast('✅ Complaint updated.', 'success');
      setAdminNote('');
      await openDetail(active);
      fetchComplaints();
    } catch (err) {
      showToast(err.message || 'Update failed.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // ─── Admin: Resolve/Close ─────────────────────────────────────────
  const handleAdminResolve = async (closeIt) => {
    if (!resolution.trim()) return showToast('Resolution text is required to resolve/close a complaint.', 'error');
    setUpdating(true);
    try {
      await complaintAPI.adminResolve(active.id || active._id, {
        resolution, status: closeIt ? 'closed' : 'resolved',
        refundStatus: refundDecision || undefined,
        refundAmount: refundAmount || undefined,
        message: `Complaint ${closeIt ? 'closed' : 'resolved'}: ${resolution}`
      });
      showToast(`✅ Complaint ${closeIt ? 'closed' : 'resolved'} successfully.`, 'success');
      setActive(null);
      setView('list');
      fetchComplaints();
    } catch (err) {
      showToast(err.message || 'Failed to resolve complaint.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────
  const filteredComplaints = complaints.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterPriority && c.priority !== filterPriority) return false;
    if (search && !c.subject?.toLowerCase().includes(search.toLowerCase()) &&
      !c.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const panelStyle = {
    background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden'
  };
  const headerStyle = {
    padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
  };

  // ─── RENDER ───────────────────────────────────────────────────────

  // ── Admin Analytics row ──
  const AdminAnalytics = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '14px', marginBottom: '24px' }}>
      <StatCard icon="fa-comments" label="Total" value={analytics.total} color="#f0580c" />
      <StatCard icon="fa-folder-open" label="Open" value={analytics.open} color="#e67e22" />
      <StatCard icon="fa-search" label="Under Review" value={analytics.under_review} color="#3498db" />
      <StatCard icon="fa-check-circle" label="Resolved" value={analytics.resolved} color="#2ecc71" />
      <StatCard icon="fa-lock" label="Closed" value={analytics.closed} color="#7f8c8d" />
      <StatCard icon="fa-exclamation-circle" label="Critical" value={analytics.critical} color="#e74c3c" />
      <StatCard icon="fa-undo" label="Refund Pending" value={analytics.refundPending} color="#9b59b6" />
    </div>
  );

  // ── Filters row ──
  const Filters = () => (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap', marginBottom: '18px', alignItems: 'center' }}>
      <input
        type="text" placeholder="🔍 Search complaints..." value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ flex: '1 1 200px', width: 'auto', minWidth: '180px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.88rem' }}
      />
      <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: '0 1 180px', width: 'auto', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.85rem' }}>
        <option value="">All Statuses</option>
        <option value="open">Open</option>
        <option value="under_review">Under Review</option>
        <option value="owner_responded">Owner Responded</option>
        <option value="admin_verified">Admin Verified</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>
      <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ flex: '0 1 160px', width: 'auto', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.85rem' }}>
        <option value="">All Priorities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <button className="btn btn-ghost btn-sm" onClick={fetchComplaints} disabled={loading} style={{ flexShrink: 0 }}>
        <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} />
      </button>
    </div>
  );

  // ── Complaint card ──
  const ComplaintCard = ({ c }) => (
    <div
      onClick={() => openDetail(c)}
      style={{
        background: active?.id === (c.id || c._id) ? 'rgba(240,88,12,.06)' : 'rgba(255,255,255,.02)',
        border: `1px solid ${active?.id === (c.id || c._id) ? 'var(--accent)' : 'var(--glass-border)'}`,
        borderRadius: 'var(--radius-md)', padding: '16px', cursor: 'pointer',
        transition: 'all .2s', marginBottom: '10px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '.95rem', flex: 1 }}>{c.subject}</span>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <PriorityBadge priority={c.priority} />
          <StatusBadge status={c.status} />
        </div>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: '.83rem', color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>
        {c.description}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '6px' }}>
        <span>
          <i className="fas fa-tag" style={{ marginRight: 4 }} />
          {(c.complaintType || c.category || 'general').replace(/_/g, ' ').toUpperCase()}
        </span>
        {userRole !== 'customer' && c.customerId?.name && (
          <span><i className="fas fa-user" style={{ marginRight: 4 }} />{c.customerId.name}</span>
        )}
        {c.refundRequested && (
          <span style={{ color: '#f1c40f' }}><i className="fas fa-undo" style={{ marginRight: 4 }} />Refund Requested</span>
        )}
        <span><i className="fas fa-clock" style={{ marginRight: 4 }} />{formatDate(c.createdAt)}</span>
      </div>
    </div>
  );

  // ── Customer Create Form ──
  const CreateForm = () => (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setView('list')}><i className="fas fa-arrow-left" /></button>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}><i className="fas fa-exclamation-circle" style={{ color: 'var(--accent)', marginRight: 8 }} />File a New Complaint</h3>
        </div>
      </div>
      <div style={{ padding: '24px' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Select Booking (Optional)</label>
              <select value={form.bookingId} onChange={e => setForm(f => ({ ...f, bookingId: e.target.value }))}>
                <option value="">-- General / No Specific Booking --</option>
                {bookings.map(b => (
                  <option key={b.id || b._id} value={b.id || b._id}>
                    {b.vehicleId?.name || 'Vehicle'} · {formatDate(b.startDate)} → {formatDate(b.endDate)} · {(b.id || b._id || '').toString().slice(-8)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Complaint Type *</label>
              <select value={form.complaintType} onChange={e => setForm(f => ({ ...f, complaintType: e.target.value }))}>
                <option value="booking">Booking Issue</option>
                <option value="vehicle">Vehicle Condition</option>
                <option value="payment">Payment / Fare Dispute</option>
                <option value="refund">Refund Issue</option>
                <option value="owner_behavior">Owner Behavior</option>
                <option value="trip_issue">Trip Issue</option>
                <option value="technical_issue">Technical Issue</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Subject *</label>
              <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief summary of the issue" maxLength={200} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Detailed Description *</label>
              <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue in full detail — what happened, when, and any relevant context..." maxLength={2000} />
              <small style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>{form.description.length}/2000</small>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Attachments (Screenshots / Documents)</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="text" value={form.attachments} onChange={e => setForm(f => ({ ...f, attachments: e.target.value }))} placeholder="Upload files or paste URLs..." style={{ flex: 1 }} />
                <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0, padding: '10px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center' }}>
                  {uploadingFiles ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-upload" style={{ marginRight: 6 }} /> Upload</>}
                  <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadingFiles} />
                </label>
              </div>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.refundRequested} onChange={e => setForm(f => ({ ...f, refundRequested: e.target.checked }))} />
                <span>I am requesting a <strong>refund</strong> for this complaint</span>
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={() => setView('list')}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
              {submitting ? <><i className="fas fa-spinner fa-spin" /> Submitting...</> : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }} />Submit Complaint</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── Detail/Thread View ──
  const DetailView = () => {
    if (!active) return null;
    const cid = active.id || active._id;
    const isFinal = ['resolved', 'closed'].includes(active.status);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Left: Info + Timeline */}
        <div style={panelStyle}>
          <div style={headerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setActive(null); setView('list'); }}>
                <i className="fas fa-arrow-left" />
              </button>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{active.subject}</h3>
                <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{cid}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <PriorityBadge priority={active.priority} />
              <StatusBadge status={active.status} />
            </div>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {/* Meta info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              {[
                ['Type', (active.complaintType || active.category || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
                ['Customer', active.customerId?.name || '—'],
                ['Vehicle', active.vehicleId?.name || '—'],
                ['Booking', active.bookingId ? formatDate(active.bookingId.startDate) + ' → ' + formatDate(active.bookingId.endDate) : '—'],
                active.refundRequested ? ['Refund', active.refundStatus?.toUpperCase()] : null,
                active.assignedAdmin?.name ? ['Assigned To', active.assignedAdmin.name] : null,
              ].filter(Boolean).map(([label, val]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 600, marginTop: '3px' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: '18px' }}>
              <p style={{ margin: 0, fontSize: '.9rem', lineHeight: 1.7, color: 'var(--text-primary)' }}>{active.description}</p>
            </div>

            {/* Resolution box */}
            {active.resolution && (
              <div style={{ background: 'rgba(46,204,113,.08)', border: '1px solid rgba(46,204,113,.3)', borderLeft: '3px solid #2ecc71', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginBottom: '18px' }}>
                <div style={{ fontSize: '.75rem', color: '#2ecc71', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                  <i className="fas fa-check-circle" style={{ marginRight: 6 }} />Admin Resolution
                </div>
                <p style={{ margin: 0, fontSize: '.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>{active.resolution}</p>
              </div>
            )}

            {/* Attachments */}
            {active.attachments?.length > 0 && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Attachments</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {active.attachments.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{
                      padding: '6px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.05)',
                      border: '1px solid var(--glass-border)', fontSize: '.8rem', color: 'var(--accent)', textDecoration: 'none'
                    }}>
                      <i className="fas fa-paperclip" style={{ marginRight: 5 }} />Attachment {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Activity timeline */}
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
              Activity Timeline
            </div>
            <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
              {(active.activityLog || []).map((log, idx) => (
                <TimelineEntry key={log._id || idx} log={log} idx={idx < active.activityLog.length - 1 ? idx : undefined} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Thread + Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Conversation thread */}
          <div style={{ ...panelStyle, flex: 1 }}>
            <div style={{ ...headerStyle }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}><i className="fas fa-comments" style={{ marginRight: 8, color: 'var(--accent)' }} />Conversation Thread</h3>
              <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{(active.responses || []).length} messages</span>
            </div>
            <div style={{ padding: '16px 20px', maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {(active.responses || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '.9rem' }}>
                  <i className="fas fa-comment-slash" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', opacity: .3 }} />
                  No messages yet. Be the first to respond.
                </div>
              ) : (
                (active.responses || []).map((msg, i) => (
                  <ThreadMessage key={msg._id || i} msg={msg} currentUserId={currentUser?.id || currentUser?._id} />
                ))
              )}
            </div>
            {/* Reply box */}
            {!isFinal && (
              <form onSubmit={userRole === 'owner' ? handleOwnerRespond : handleReply} style={{ padding: '14px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '10px' }}>
                <textarea
                  rows={2} value={replyMsg} onChange={e => setReplyMsg(e.target.value)}
                  placeholder={userRole === 'owner' ? 'Write your response to the customer and admin...' : 'Write a message...'}
                  style={{ flex: 1, resize: 'vertical', minHeight: '60px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.88rem' }}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={replying || !replyMsg.trim()} style={{ alignSelf: 'flex-end' }}>
                  {replying ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
                </button>
              </form>
            )}
          </div>

          {/* Admin Actions Panel */}
          {userRole === 'admin' && !isFinal && (
            <div style={panelStyle}>
              <div style={headerStyle}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}><i className="fas fa-cogs" style={{ marginRight: 8, color: '#f0580c' }} />Admin Actions</h3>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <form onSubmit={handleAdminUpdate}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="form-group">
                      <label>Workflow Status</label>
                      <select value={adminStatus} onChange={e => setAdminStatus(e.target.value)}>
                        <option value="open">Open</option>
                        <option value="under_review">Under Review</option>
                        <option value="owner_responded">Owner Responded</option>
                        <option value="admin_verified">Admin Verified</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Priority Override</label>
                      <select value={adminPriority} onChange={e => setAdminPriority(e.target.value)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                      <label>Internal Note (logged to timeline)</label>
                      <input type="text" value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Optional note for the activity log..." />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }} disabled={updating}>
                    {updating ? <i className="fas fa-spinner fa-spin" /> : 'Save Status / Priority'}
                  </button>
                </form>

                <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '20px', paddingTop: '18px' }}>
                  <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <i className="fas fa-gavel" style={{ marginRight: 6 }} />Resolve / Close Dispute
                  </p>
                  <div className="form-group">
                    <label>Final Resolution Notes *</label>
                    <textarea rows={3} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Describe the final outcome and what actions were taken..." />
                  </div>
                  {active.refundRequested && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label>Refund Decision</label>
                        <select value={refundDecision} onChange={e => setRefundDecision(e.target.value)}>
                          <option value="">-- No change --</option>
                          <option value="approved">✅ Approve Refund</option>
                          <option value="rejected">❌ Reject Refund</option>
                        </select>
                      </div>
                      {refundDecision === 'approved' && (
                        <div className="form-group">
                          <label>Refund Amount (₹)</label>
                          <input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="e.g. 1800" />
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button" className="btn btn-primary btn-sm"
                      style={{ background: 'linear-gradient(135deg,#2ecc71,#27ae60)', boxShadow: 'none' }}
                      onClick={() => handleAdminResolve(false)} disabled={updating}
                    >
                      <i className="fas fa-check-circle" style={{ marginRight: 5 }} />Mark Resolved
                    </button>
                    <button
                      type="button" className="btn btn-sm"
                      style={{ background: 'rgba(127,140,141,.15)', border: '1px solid rgba(127,140,141,.3)', color: '#7f8c8d' }}
                      onClick={() => handleAdminResolve(true)} disabled={updating}
                    >
                      <i className="fas fa-lock" style={{ marginRight: 5 }} />Close Complaint
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Owner respond already handled via thread; just show note if resolved */}
          {isFinal && (
            <div style={{ ...panelStyle, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <i className="fas fa-check-circle" style={{ fontSize: '1.6rem', color: '#2ecc71' }} />
              <div>
                <div style={{ fontWeight: 700 }}>Complaint {active.status === 'closed' ? 'Closed' : 'Resolved'}</div>
                <div style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>This complaint has been finalised. No further actions are available.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── List view ──
  const ListView = () => (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fas fa-gavel" style={{ color: 'var(--accent)', fontSize: '1.1rem' }} />
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
            {userRole === 'admin' ? 'Complaint Control Center'
              : userRole === 'owner' ? 'Complaints Management'
                : 'My Complaints & Disputes'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {userRole === 'customer' && (
            <button className="btn btn-primary btn-sm" onClick={() => setView('form')}>
              <i className="fas fa-plus" style={{ marginRight: 6 }} />New Complaint
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={fetchComplaints} disabled={loading}>
            <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} />
          </button>
        </div>
      </div>
      <div style={{ padding: '20px 24px' }}>
        {userRole === 'admin' && <AdminAnalytics />}
        {(userRole === 'admin' || userRole === 'owner') && <Filters />}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.8rem', marginBottom: 12 }} />
            <p>Loading complaints...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <i className="fas fa-comments" style={{ fontSize: '3rem', display: 'block', marginBottom: '12px', opacity: .2 }} />
            <p style={{ fontSize: '1rem' }}>No complaints found.</p>
            {userRole === 'customer' && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: '12px' }} onClick={() => setView('form')}>
                <i className="fas fa-plus" style={{ marginRight: 6 }} />File Your First Complaint
              </button>
            )}
          </div>
        ) : (
          <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredComplaints.map(c => <ComplaintCard key={c.id || c._id} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-visible">
      {view === 'form' && userRole === 'customer' ? <CreateForm /> :
        view === 'detail' && active ? <DetailView /> :
          <ListView />}
    </div>
  );
}
