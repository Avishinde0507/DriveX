import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { reviewAPI } from '../services/api';
import { formatDate } from '../utils/helpers';

export default function ReviewPanel({ bookings = [], userRole }) {
  const { showToast } = useApp();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);

  // Review submission state
  const [selectedBooking, setSelectedBooking] = useState('');
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin moderation state
  const [reason, setReason] = useState('');
  const [activeReview, setActiveReview] = useState(null);
  const [moderating, setModerating] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await reviewAPI.getAll();
      if (res.success) {
        setReviews(res.reviews);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load reviews.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return showToast('Please select a booking.', 'error');
    if (!feedback.trim()) return showToast('Please write some feedback.', 'error');

    setSubmitting(true);
    try {
      const res = await reviewAPI.submit(selectedBooking, rating, feedback);
      if (res.success) {
        showToast('Review submitted successfully.', 'success');
        setFeedback('');
        setRating(5);
        setSelectedBooking('');
        fetchReviews();
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit review.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleModerate = async (status) => {
    if (!activeReview) return;
    setModerating(true);
    try {
      const res = await reviewAPI.moderate(activeReview.id, status, reason);
      if (res.success) {
        showToast(`Review status updated: ${status}`, 'success');
        setReason('');
        setActiveReview(null);
        fetchReviews();
      }
    } catch (err) {
      showToast(err.message || 'Moderation failed.', 'error');
    } finally {
      setModerating(false);
    }
  };

  const handleSoftDelete = async (id) => {
    if (!window.confirm('Are you sure you want to soft-delete this review? Owners will no longer see it.')) return;
    try {
      const res = await reviewAPI.delete(id);
      showToast(res.message || 'Review removed.', 'success');
      fetchReviews();
    } catch (err) {
      showToast(err.message || 'Delete failed.', 'error');
    }
  };

  // Only bookings that are completed and do not have reviews yet
  const eligibleBookings = bookings.filter(b => {
    const isCompleted = b.status === 'completed';
    const alreadyReviewed = reviews.some(r => r.bookingId === b.id || r.bookingId?.id === b.id);
    return isCompleted && !alreadyReviewed;
  });

  const renderStars = (num) => {
    return Array.from({ length: 5 }, (_, idx) => (
      <i key={idx} className={`${idx < num ? 'fas text-accent' : 'far'} fa-star`} style={{ marginRight: 2 }}></i>
    ));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: activeReview ? '1fr 400px' : '1fr', gap: '24px', transition: 'all 0.3s' }}>

      {/* Left Column - List and Creation */}
      <div className="panel animate-visible">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Vehicle Reviews &amp; Moderation</h2>
          <button className="btn btn-ghost btn-sm" onClick={fetchReviews} disabled={loading}>
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt"></i>}
          </button>
        </div>
        <div className="panel-body">

          {userRole === 'customer' && eligibleBookings.length > 0 && (
            <form onSubmit={handleSubmitReview} style={{ marginBottom: '32px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '14px' }}><i className="fas fa-star text-accent" style={{ marginRight: 8 }}></i>Write a Review</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Booking to Review</label>
                  <select value={selectedBooking} onChange={e => setSelectedBooking(e.target.value)}>
                    <option value="">-- Choose Completed Booking --</option>
                    {eligibleBookings.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.vehicleId?.name} ({formatDate(b.startDate)} to {formatDate(b.endDate)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Rating (1-5)</label>
                  <select value={rating} onChange={e => setRating(parseInt(e.target.value))}>
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Average</option>
                    <option value="2">2 - Poor</option>
                    <option value="1">1 - Terrible</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Review Feedback</label>
                <textarea rows="3" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Share your experience renting this vehicle..." />
              </div>

              <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
                {submitting ? <><i className="fas fa-spinner fa-spin"></i> Submitting...</> : 'Submit Review'}
              </button>
            </form>
          )}

          {reviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <i className="fas fa-star-half-alt" style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.3 }}></i>
              <p>No reviews submitted yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviews.map(r => (
                <div key={r.id} style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '1rem' }}>{r.vehicleId?.name || 'Vehicle'}</strong>
                      <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginLeft: '10px' }}>by {r.userId?.name || 'Customer'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex' }}>{renderStars(r.rating)}</span>
                      {r.isDeleted && <span className="status-badge status-rejected">DELETED</span>}
                      {r.moderationStatus !== 'visible' && (
                        <span className="status-badge status-pending">{r.moderationStatus.toUpperCase()}</span>
                      )}
                    </div>
                  </div>

                  <p style={{ margin: '4px 0', fontSize: '.92rem', color: 'var(--text-secondary)' }}>
                    "{r.feedback}"
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                    <span>Submitted: {formatDate(r.createdAt)}</span>
                    {userRole === 'admin' && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setActiveReview(r)} style={{ padding: '2px 8px' }}>
                          <i className="fas fa-shield-alt"></i> Moderate
                        </button>
                        <button className="btn btn-ghost btn-sm text-rejected" onClick={() => handleSoftDelete(r.id)} style={{ padding: '2px 8px' }}>
                          <i className="fas fa-trash-alt"></i> Soft Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin Moderation Panel Right */}
      {activeReview && userRole === 'admin' && (
        <div className="panel animate-visible">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Moderate Review</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveReview(null)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="panel-body">
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', marginBottom: '20px' }}>
              <div style={{ fontSize: '.9rem', fontStyle: 'italic', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                "{activeReview.feedback}"
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                Rating: {activeReview.rating} Stars | User: {activeReview.userId?.name}
              </div>
            </div>

            <div className="form-group">
              <label>Moderation Reason / Admin Notes</label>
              <textarea rows="3" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this review status changing?" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="btn btn-primary" onClick={() => handleModerate('visible')} disabled={moderating}>
                Approve (Show)
              </button>
              <button className="btn btn-ghost" style={{ border: '1px solid #e67e22', color: '#e67e22' }} onClick={() => handleModerate('flagged')} disabled={moderating}>
                Flag as Suspicious
              </button>
              <button className="btn btn-ghost" style={{ border: '1px solid #e74c3c', color: '#e74c3c' }} onClick={() => handleModerate('hidden')} disabled={moderating}>
                Hide Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
