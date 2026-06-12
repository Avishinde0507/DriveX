import React, { useState, useEffect, useCallback } from 'react';
import { reviewAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/helpers';
import StatusBadge from './StatusBadge';

export default function ReviewsPanel({ userRole }) {
  const { showToast } = useApp();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await reviewAPI.getAll();
      if (res.success) {
        setReviews(res.reviews);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleModerate = async (id, status) => {
    if (userRole !== 'admin') return;
    try {
      const reason = status === 'hidden' || status === 'flagged' ? prompt('Enter moderation reason:') : '';
      if ((status === 'hidden' || status === 'flagged') && reason === null) return; // cancelled prompt

      await reviewAPI.moderate(id, status, reason);
      showToast(`Review marked as ${status}`, 'success');
      loadReviews();
    } catch (err) {
      showToast(err.message || 'Moderation failed', 'error');
    }
  };

  const handleToggleFeature = async (id, currentFeatured) => {
    if (userRole !== 'admin') return;
    try {
      if (currentFeatured) {
        await reviewAPI.unfeature(id);
        showToast('Review removed from featured testimonials', 'success');
      } else {
        await reviewAPI.feature(id);
        showToast('Review marked as featured testimonial', 'success');
      }
      loadReviews();
    } catch (err) {
      showToast(err.message || 'Action failed', 'error');
    }
  };

  // 1. Calculate Admin Analytics
  const totalReviews = reviews.length;
  const featuredReviews = reviews.filter(r => r.isFeatured).length;
  const visibleReviews = reviews.filter(r => r.moderationStatus === 'visible');
  const averageRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
    : '0.0';
  const hiddenReviews = reviews.filter(r => r.moderationStatus === 'hidden').length;
  const flaggedReviews = reviews.filter(r => r.moderationStatus === 'flagged').length;

  // 2. Search and Filter Logic
  const filteredReviews = reviews.filter(r => {
    // Text search (name, email, vehicle, feedback text)
    const matchesSearch =
      !searchQuery ||
      r.userId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.userId?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.vehicleId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.feedback?.toLowerCase().includes(searchQuery.toLowerCase());

    // Moderation/Featured Status filter
    let matchesStatus = true;
    if (statusFilter === 'featured') {
      matchesStatus = r.isFeatured;
    } else if (statusFilter !== 'all') {
      matchesStatus = r.moderationStatus === statusFilter;
    }

    // Rating Filter
    const matchesRating = ratingFilter === 'all' || r.rating === Number(ratingFilter);

    return matchesSearch && matchesStatus && matchesRating;
  });

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading reviews...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── ADMIN ANALYTICS GRID ── */}
      {userRole === 'admin' && (
        <div className="kpi-grid">
          {[
            { icon: 'fa-comments', cls: 'blue', val: totalReviews, label: 'Total Reviews' },
            { icon: 'fa-star', cls: 'orange', val: featuredReviews, label: 'Featured Testimonials' },
            { icon: 'fa-star-half-alt', cls: 'green', val: `${averageRating} / 5.0`, label: 'Average Rating' },
            { icon: 'fa-eye-slash', cls: 'purple', val: hiddenReviews, label: 'Hidden Reviews' },
            { icon: 'fa-flag', cls: 'red', val: flaggedReviews, label: 'Flagged Reviews' },
          ].map((k, i) => (
            <div key={i} className="kpi-card" style={{ flex: '1 1 180px' }}>
              <div className={`kpi-icon ${k.cls}`}><i className={`fas ${k.icon}`}></i></div>
              <div className="kpi-value">{k.val}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="panel" style={{ padding: '16px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          alignItems: 'center'
        }}>
          {/* Text Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <i className="fas fa-search" style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }}></i>
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '36px', height: '42px', borderRadius: '8px' }}
              placeholder="Search reviews, users, or vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              className="form-control"
              style={{ height: '42px', borderRadius: '8px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Moderation Status</option>
              <option value="featured">Featured Testimonials</option>
              <option value="visible">Visible Only</option>
              <option value="hidden">Hidden Only</option>
              <option value="flagged">Flagged Only</option>
            </select>
          </div>

          {/* Rating Filter */}
          <div>
            <select
              className="form-control"
              style={{ height: '42px', borderRadius: '8px' }}
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── REVIEWS TABLE PANEL ── */}
      <div className="panel">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Customer Reviews Moderation Center</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Showing {filteredReviews.length} of {reviews.length} reviews
          </span>
        </div>

        <div className="panel-body no-pad">
          {filteredReviews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <i className="fas fa-search" style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '20px' }}></i>
              <h3>No reviews found</h3>
              <p>Try resetting or modifying your search/filters.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Rating</th>
                    <th>Feedback</th>
                    <th>Date</th>
                    {userRole === 'admin' && <th>Featured</th>}
                    {userRole === 'admin' && <th>Moderation Status</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map(r => (
                    <tr key={r._id}>
                      {/* Customer Info (Name, Profile Image/Initials, Email) */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover, #d04d0b))',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}>
                            {r.userId?.profileImage ? (
                              <img src={r.userId.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              r.userId?.name ? r.userId.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'
                            )}
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text-primary)' }}>{r.userId?.name || 'Unknown'}</strong>
                            <br />
                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>{r.userId?.email}</small>
                          </div>
                        </div>
                      </td>

                      {/* Vehicle Name */}
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>{r.vehicleId?.name || 'Unknown'}</strong>
                        {r.vehicleId?.brand && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.vehicleId.brand}</div>}
                      </td>

                      {/* Rating Stars */}
                      <td>
                        <div style={{ color: 'var(--warning)', letterSpacing: '2px', fontSize: '0.9rem' }} title={`${r.rating} Stars`}>
                          {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                        </div>
                      </td>

                      {/* Feedback Text */}
                      <td style={{ maxWidth: '280px' }}>
                        <div
                          style={{
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            fontSize: '0.85rem',
                            lineHeight: '1.4',
                            color: 'var(--text-primary)'
                          }}
                          title={r.feedback}
                        >
                          {r.feedback}
                        </div>
                        {r.moderationReason && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '4px', fontStyle: 'italic' }}>
                            Reason: {r.moderationReason}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {formatDate(r.createdAt)}
                      </td>

                      {/* Featured (Star Button) */}
                      {userRole === 'admin' && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleFeature(r._id, r.isFeatured)}
                            disabled={r.moderationStatus !== 'visible'}
                            className="btn btn-link"
                            title={r.moderationStatus !== 'visible' ? 'Only visible reviews can be featured.' : r.isFeatured ? 'Remove from Featured Testimonials' : 'Mark as Featured Testimonial'}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: r.isFeatured ? 'var(--warning)' : 'var(--text-muted)',
                              cursor: r.moderationStatus === 'visible' ? 'pointer' : 'not-allowed',
                              fontSize: '1.2rem',
                              opacity: r.moderationStatus !== 'visible' ? 0.3 : 1,
                              transition: 'all 0.2s ease',
                              padding: '4px 8px'
                            }}
                          >
                            <i className={r.isFeatured ? 'fas fa-star' : 'far fa-star'}></i>
                          </button>
                        </td>
                      )}

                      {/* Moderation Dropdown */}
                      {userRole === 'admin' && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <StatusBadge status={r.moderationStatus === 'visible' ? 'available' : r.moderationStatus === 'hidden' ? 'maintenance' : 'pending'} />
                            <select
                              className="form-control"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.8rem',
                                width: 'auto',
                                height: '30px',
                                borderRadius: '6px',
                                border: '1px solid var(--glass-border)',
                                background: 'var(--bg-card)',
                                color: 'var(--text-primary)'
                              }}
                              value={r.moderationStatus}
                              onChange={(e) => handleModerate(r._id, e.target.value)}
                            >
                              <option value="visible">Visible</option>
                              <option value="hidden">Hidden</option>
                              <option value="flagged">Flagged</option>
                            </select>
                          </div>
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
    </div>
  );
}
