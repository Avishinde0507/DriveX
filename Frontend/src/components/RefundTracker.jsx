import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { refundAPI } from '../services/api';
import { formatPrice, formatDate } from '../utils/helpers';

export default function RefundTracker({ bookings = [], userRole }) {
  const { showToast } = useApp();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin notes/process state
  const [adminNotes, setAdminNotes] = useState('');
  const [activeRefund, setActiveRefund] = useState(null);
  const [processing, setProcessing] = useState(false);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const res = await refundAPI.getAll();
      if (res.success) {
        setRefunds(res.refunds);
      }
    } catch (err) {
      showToast(err.message || 'Error fetching refunds.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const handleRequestRefund = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return showToast('Please select a booking.', 'error');
    if (!refundReason.trim()) return showToast('Please provide a reason.', 'error');

    setSubmitting(true);
    try {
      const res = await refundAPI.request(selectedBooking, refundReason);
      if (res.success) {
        showToast('Refund requested successfully.', 'success');
        setRefundReason('');
        setSelectedBooking('');
        fetchRefunds();
      }
    } catch (err) {
      showToast(err.message || 'Failed to file refund request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessRefund = async (status) => {
    if (!activeRefund) return;
    setProcessing(true);
    try {
      const res = await refundAPI.process(activeRefund.id, status, adminNotes);
      if (res.success) {
        showToast(`Refund status updated to: ${status.toUpperCase()}`, 'success');
        setAdminNotes('');
        setActiveRefund(null);
        fetchRefunds();
      }
    } catch (err) {
      showToast(err.message || 'Failed to update refund status.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (s) => {
    switch (s) {
      case 'pending': return 'status-badge status-pending';
      case 'processing': return 'status-badge status-active';
      case 'success': return 'status-badge status-completed';
      case 'failed': return 'status-badge status-rejected';
      default: return 'status-badge';
    }
  };

  // Filter paid/cancelled bookings that don't have refunds requested
  const refundEligibleBookings = bookings.filter(b => {
    const isCancelledOrRejected = ['cancelled', 'rejected'].includes(b.status);
    const isPaid = b.paymentStatus === 'paid';
    const alreadyRequested = refunds.some(r => r.bookingId?.id === b.id || r.bookingId === b.id);
    return isPaid && isCancelledOrRejected && !alreadyRequested;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: activeRefund ? '1fr 400px' : '1fr', gap: '24px', transition: 'all 0.3s' }}>

      {/* Left List */}
      <div className="panel animate-visible">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Refunds &amp; Settlements</h2>
          <button className="btn btn-ghost btn-sm" onClick={fetchRefunds} disabled={loading}>
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>}
          </button>
        </div>
        <div className="panel-body">

          {userRole === 'customer' && refundEligibleBookings.length > 0 && (
            <form onSubmit={handleRequestRefund} style={{ marginBottom: '32px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px' }}><i className="fas fa-undo text-accent" style={{ marginRight: 8 }}></i>Request Refund</h3>

              <div className="form-group">
                <label>Eligible Cancelled/Rejected Booking</label>
                <select value={selectedBooking} onChange={e => setSelectedBooking(e.target.value)}>
                  <option value="">-- Select Booking --</option>
                  {refundEligibleBookings.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.vehicleId?.name} ({formatPrice(b.totalPrice)}) - ID: {b.id.substring(0, 8)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Reason for Refund</label>
                <textarea rows="2" value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Why are you requesting a refund?" />
              </div>

              <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
                {submitting ? <><i className="fas fa-spinner fa-spin"></i> Requesting...</> : 'Request Refund'}
              </button>
            </form>
          )}

          {refunds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <i className="fas fa-receipt" style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.3 }}></i>
              <p>No refund requests or transactions yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="vrms-table">
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Booking Details</th>
                    <th>Original Amount</th>
                    <th>Status</th>
                    <th>Txn ID</th>
                    <th>Requested At</th>
                    {userRole === 'admin' && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {refunds.map(r => (
                    <tr key={r.id} style={{ cursor: userRole === 'admin' ? 'pointer' : 'default' }} onClick={() => userRole === 'admin' && setActiveRefund(r)}>
                      <td style={{ fontWeight: 700 }}>{r.id.substring(0, 8).toUpperCase()}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{r.bookingId?.vehicleId?.name || 'Vehicle'}</div>
                        <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>Booking: {r.bookingId?.id?.substring(0, 8)}...</span>
                      </td>
                      <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatPrice(r.originalAmount)}</td>
                      <td><span className={getStatusBadge(r.status)}>{r.status.toUpperCase()}</span></td>
                      <td style={{ fontSize: '.8rem', fontFamily: 'monospace' }}>{r.refundTransactionId || 'Pending'}</td>
                      <td>{formatDate(r.createdAt)}</td>
                      {userRole === 'admin' && (
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setActiveRefund(r); }}>
                            <i className="fas fa-edit"></i> Review
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Process/Action Column */}
      {activeRefund && userRole === 'admin' && (
        <div className="panel animate-visible">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Process Refund</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveRefund(null)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="panel-body">
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontWeight: 700 }}>Refund ID: {activeRefund.id.substring(0, 8).toUpperCase()}</span>
                <span className={getStatusBadge(activeRefund.status)}>{activeRefund.status.toUpperCase()}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '.85rem', marginBottom: '12px' }}>
                <div>Original Txn ID:</div>
                <div style={{ fontFamily: 'monospace' }}>{activeRefund.paymentTransactionId}</div>
                <div>Amount to Refund:</div>
                <div style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatPrice(activeRefund.refundAmount)}</div>
                <div>Customer:</div>
                <div>{activeRefund.customerId?.name} ({activeRefund.customerId?.email})</div>
              </div>
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
                <strong>Customer Reason:</strong>
                <p style={{ fontSize: '.88rem', margin: '4px 0 0', color: 'var(--text-secondary)' }}>{activeRefund.refundReason}</p>
              </div>
            </div>

            {activeRefund.status !== 'success' && (
              <div>
                <div className="form-group">
                  <label>Admin Processing Notes</label>
                  <textarea rows="3" value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Details regarding bank settlement, verification..." />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleProcessRefund('success')} disabled={processing}>
                    Approve &amp; Refund
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1, color: '#e74c3c' }} onClick={() => handleProcessRefund('failed')} disabled={processing}>
                    Reject / Fail
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
