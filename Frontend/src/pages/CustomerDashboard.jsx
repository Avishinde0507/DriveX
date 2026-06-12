import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Sidebar from '../components/Sidebar';
import StatusBadge from '../components/StatusBadge';
import ManageProfile from '../components/ManageProfile';
import ComplaintPanel from '../components/ComplaintPanel';
import RefundTracker from '../components/RefundTracker';
import ReviewPanel from '../components/ReviewPanel';
import { vehicleAPI, bookingAPI, userAPI } from '../services/api';
import { formatPrice, formatDate, getVehicleImageUrl } from '../utils/helpers';

const NAV_ITEMS = [
  { key: 'browse', icon: 'fa-search', label: 'Browse Vehicles' },
  { key: 'bookings', icon: 'fa-calendar-alt', label: 'My Bookings' },
  { key: 'complaints', icon: 'fa-exclamation-circle', label: 'Complaints' },
  { key: 'refunds', icon: 'fa-receipt', label: 'Refunds' },
  { key: 'reviews', icon: 'fa-star', label: 'Reviews' },
  { key: 'profile', icon: 'fa-user-cog', label: 'Manage Profile' },
];

function VehicleCard({ v, onBook }) {
  const fuelIcon = v.fuel === 'Electric' ? 'fa-charging-station' : 'fa-gas-pump';
  const tagClass = v.type === '2W' ? 'eco' : (v.priceDaily >= 3000 ? 'premium' : '');
  return (
    <div className="vehicle-card-sm">
      <div className="card-img" style={{ background: getVehicleImageUrl(v.image) ? 'var(--bg-card)' : `linear-gradient(135deg, ${v.color || 'var(--accent)'}, #0a0a0a)`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <span className={`vehicle-badge-tag ${tagClass}`}>{v.type === '2W' ? '2-Wheeler' : '4-Wheeler'}</span>
        {getVehicleImageUrl(v.image) ? (
          <img src={getVehicleImageUrl(v.image)} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className="vehicle-icon" style={{ color: 'rgba(255,255,255,0.05)', textShadow: '0 0 15px var(--accent-glow)' }}>
            <i className={`fas ${v.image || 'fa-car'}`} style={{ fontSize: '3.5rem' }}></i>
          </div>
        )}
      </div>
      <div className="card-body">
        <h3>{v.name}</h3>
        <div className="specs">
          <span><i className={`fas ${fuelIcon}`}></i> {v.fuel}</span>
          <span><i className="fas fa-cog"></i> {v.transmission}</span>
          <span><i className="fas fa-user-friends"></i> {v.seats}</span>
          <span><i className="fas fa-map-marker-alt"></i> {v.location}</span>
        </div>
        <div className="pricing-tiers mb-2">
          <div className="pricing-tier"><div className="tier-label">Daily</div><div className="tier-price">{formatPrice(v.priceDaily)}</div></div>
          <div className="pricing-tier"><div className="tier-label">Weekly</div><div className="tier-price">{formatPrice(v.priceWeekly)}</div></div>
          <div className="pricing-tier"><div className="tier-label">Monthly</div><div className="tier-price">{formatPrice(v.priceMonthly)}</div></div>
        </div>
        <div className="card-footer">
          <button className="btn btn-primary btn-block" onClick={() => onBook(v)}>
            <i className="fas fa-calendar-plus"></i> View Details & Book
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  const { currentUser, showToast, theme, toggleTheme, updateUser } = useApp();
  const navigate = useNavigate();
  const [section, setSection] = useState('browse');
  const [allVehicles, setAllVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [vehicleMap, setVehicleMap] = useState({});
  const [filters, setFilters] = useState({ search: '', type: '', fuel: '', priceRange: '' });

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'customer') { navigate('/login'); return; }
  }, [currentUser, navigate]);

  // Load available vehicles once
  useEffect(() => {
    async function load() {
      try {
        const list = await vehicleAPI.getAvailable();
        setAllVehicles(list);
      } catch {
        showToast('Failed to load vehicles.', 'error');
      }
    }
    load();
  }, [showToast]);

  // Load bookings when switching to that section
  useEffect(() => {
    if (!['bookings', 'complaints', 'refunds', 'reviews'].includes(section) || !currentUser) return;
    async function load() {
      try {
        const [bList, vList] = await Promise.all([
          bookingAPI.getByCustomer(currentUser.id),
          vehicleAPI.getAll(),
        ]);
        const map = {};
        if (Array.isArray(vList)) {
          vList.forEach(v => { if (v && (v.id || v._id)) map[v.id || v._id] = v; });
        }
        setVehicleMap(map);
        setBookings(Array.isArray(bList) ? bList : []);
      } catch (err) {
        console.error('Failed to load bookings:', err);
        showToast('Failed to load bookings. ' + (err.message || ''), 'error');
      }
    }
    load();
  }, [section, currentUser, showToast]);

  // Client-side filtering
  const vehicles = allVehicles.filter(v => {
    const q = filters.search.toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) || v.brand.toLowerCase().includes(q) || v.location.toLowerCase().includes(q);
    const matchType = !filters.type || v.type === filters.type;
    const matchFuel = !filters.fuel || v.fuel === filters.fuel;
    let matchPrice = true;
    if (filters.priceRange) {
      const [min, max] = filters.priceRange.split('-').map(Number);
      matchPrice = v.priceDaily >= min && v.priceDaily <= max;
    }
    return matchSearch && matchType && matchFuel && matchPrice;
  });

  const [isProcessing, setIsProcessing] = useState(null);

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? Any payment made will be refunded.')) return;

    setIsProcessing(bookingId);
    try {
      await bookingAPI.updateStatus(bookingId, 'cancelled');
      showToast('Booking cancelled successfully and refund initiated.', 'success');

      // Refresh bookings
      const bList = await bookingAPI.getByCustomer(currentUser.id);
      setBookings(Array.isArray(bList) ? bList : []);
    } catch (err) {
      showToast(err.message || 'Failed to cancel booking.', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleExtend = async (booking) => {
    const currentEnd = new Date(booking.endDate);
    // adjust for timezone to show local time in prompt
    currentEnd.setMinutes(currentEnd.getMinutes() - currentEnd.getTimezoneOffset());
    const newDateStr = window.prompt(
      'Enter new end date and time (YYYY-MM-DDTHH:mm):',
      currentEnd.toISOString().slice(0, 16)
    );
    if (!newDateStr) return;

    setIsProcessing(booking.id || booking._id);
    try {
      await bookingAPI.updateStatus(booking.id || booking._id, booking.status, { extendEndDate: newDateStr });
      showToast('Booking extended successfully!', 'success');

      const bList = await bookingAPI.getByCustomer(currentUser.id);
      setBookings(Array.isArray(bList) ? bList : []);
    } catch (err) {
      showToast(err.message || 'Failed to extend booking.', 'error');
    } finally {
      setIsProcessing(null);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="dashboard-layout" data-theme={theme}>
      <Sidebar navItems={NAV_ITEMS} activeSection={section} onSectionChange={setSection} />
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="dashboard-header-actions" style={{ position: 'absolute', top: '24px', right: '36px', zIndex: 10 }}>
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
              color: 'var(--accent)',
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        </div>

        {section === 'browse' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-search" style={{ color: 'var(--accent)' }}></i> Browse Vehicles</h1>
              <p>Search and filter from our fleet of 2-wheelers and 4-wheelers.</p>
            </div>
            <div className="search-bar">
              <div className="search-input">
                <i className="fas fa-search"></i>
                <input type="text" placeholder="Search by name, brand, or location..."
                  value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
              </div>
              <select value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                <option value="">All Types</option>
                <option value="2W">2-Wheeler</option>
                <option value="4W">4-Wheeler</option>
              </select>
              <select value={filters.fuel} onChange={e => setFilters({ ...filters, fuel: e.target.value })}>
                <option value="">All Fuels</option>
                <option value="Petrol">Petrol</option>
                <option value="Diesel">Diesel</option>
                <option value="Electric">Electric</option>
                <option value="CNG">CNG</option>
              </select>
              <select value={filters.priceRange} onChange={e => setFilters({ ...filters, priceRange: e.target.value })}>
                <option value="">Any Price</option>
                <option value="0-500">Under ₹500/day</option>
                <option value="500-1000">₹500 – ₹1,000</option>
                <option value="1000-3000">₹1,000 – ₹3,000</option>
                <option value="3000-99999">₹3,000+</option>
              </select>
            </div>
            {vehicles.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-search"></i>
                <h3>No vehicles found</h3>
                <p>Try adjusting your filters or search query.</p>
              </div>
            ) : (
              <div className="vehicles-grid">
                {vehicles.map(v => (
                  <VehicleCard key={v.id} v={v} onBook={(v) => navigate(`/customer/book/${v.id}`)} />
                ))}
              </div>
            )}
          </div>
        )}

        {section === 'bookings' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-calendar-alt" style={{ color: 'var(--accent)' }}></i> My Bookings</h1>
              <p>View and track all your vehicle bookings.</p>
            </div>
            {bookings.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-calendar-times"></i>
                <h3>No bookings yet</h3>
                <p>Browse our vehicles and make your first booking!</p>
              </div>
            ) : (
              <div className="panel">
                <div className="panel-body no-pad">
                  <div className="table-wrapper">
                    <table className="table table-hover mb-0">
                      <thead><tr><th>Booking ID</th><th>Vehicle</th><th>Duration</th><th>Dates</th><th>Total</th><th>Payment</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                      <tbody>
                        {bookings.map(b => (
                          <tr key={b.id}>
                            <td><strong>{b.id}</strong></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {getVehicleImageUrl(b.vehicleId?.image || vehicleMap[b.vehicleId]?.image) ? (
                                    <img src={getVehicleImageUrl(b.vehicleId?.image || vehicleMap[b.vehicleId]?.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <i className="fas fa-car" style={{ fontSize: '0.9rem', opacity: 0.2 }}></i>
                                  )}
                                </div>
                                {b.vehicleId?.name || vehicleMap[b.vehicleId]?.name || (typeof b.vehicleId === 'string' ? b.vehicleId : 'Unknown Vehicle')}
                              </div>
                            </td>
                            <td><span className="badge bg-primary text-capitalize">{b.durationType}</span></td>
                            <td>{new Date(b.startDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} → {new Date(b.endDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td><strong>{formatPrice(b.totalPrice)}</strong></td>
                            <td>
                              <span style={{
                                padding: '3px 10px', borderRadius: '12px', fontSize: '.78rem', fontWeight: 600,
                                background: b.paymentStatus === 'paid' ? 'rgba(0,184,148,0.15)' : b.paymentStatus === 'refunded' ? 'rgba(253,203,110,0.15)' : 'rgba(255,255,255,0.08)',
                                color: b.paymentStatus === 'paid' ? '#00b894' : b.paymentStatus === 'refunded' ? '#fdcb6e' : 'var(--text-muted)',
                                border: `1px solid ${b.paymentStatus === 'paid' ? '#00b894' : b.paymentStatus === 'refunded' ? '#fdcb6e' : 'var(--glass-border)'}`,
                                textTransform: 'uppercase', letterSpacing: '.5px',
                              }}>
                                {b.paymentStatus === 'paid' ? '✓ Paid' : b.paymentStatus === 'refunded' ? '↩ Refunded' : '— Unpaid'}
                              </span>
                              {b.paymentMethod && (
                                <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '3px', textTransform: 'capitalize' }}>
                                  <i className={`fas ${b.paymentMethod === 'upi' ? 'fa-mobile-alt' : b.paymentMethod === 'card' ? 'fa-credit-card' : 'fa-university'}`} style={{ marginRight: 4 }}></i>
                                  {b.paymentMethod === 'upi' ? 'UPI' : b.paymentMethod === 'card' ? 'Card' : 'Net Banking'}
                                </div>
                              )}
                            </td>
                            <td><StatusBadge status={b.status} /></td>
                            <td style={{ textAlign: 'right' }}>
                              {b.status === 'pending' && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleCancel(b.id || b._id)}
                                  disabled={isProcessing === (b.id || b._id)}
                                  title="Cancel Booking"
                                >
                                  {isProcessing === (b.id || b._id) ? (
                                    <i className="fas fa-spinner fa-spin"></i>
                                  ) : (
                                    <><i className="fas fa-times-circle"></i> Cancel</>
                                  )}
                                </button>
                              )}
                              {(b.status === 'active' || b.status === 'pending') && (
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  style={{ marginLeft: '6px' }}
                                  onClick={() => handleExtend(b)}
                                  disabled={isProcessing === (b.id || b._id)}
                                  title="Extend Booking"
                                >
                                  {isProcessing === (b.id || b._id) ? (
                                    <i className="fas fa-spinner fa-spin"></i>
                                  ) : (
                                    <><i className="fas fa-clock"></i> Extend</>
                                  )}
                                </button>
                              )}
                              {(b.status === 'cancelled' || b.status === 'rejected' || b.status === 'completed') && (
                                <span className="text-muted" style={{ fontSize: '.75rem' }}>No Actions</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {section === 'complaints' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-exclamation-circle" style={{ color: 'var(--accent)' }}></i> Customer Support &amp; Disputes</h1>
              <p>File or review active disputes regarding bookings, vehicles, or payments.</p>
            </div>
            <ComplaintPanel bookings={bookings} userRole="customer" />
          </div>
        )}
        {section === 'refunds' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-receipt" style={{ color: 'var(--accent)' }}></i> Refund Settlements</h1>
              <p>Track refunds for cancelled bookings.</p>
            </div>
            <RefundTracker bookings={bookings} userRole="customer" />
          </div>
        )}
        {section === 'reviews' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-star" style={{ color: 'var(--accent)' }}></i> My Vehicle Reviews</h1>
              <p>Rate and share feedback on your completed rental trips.</p>
            </div>
            <ReviewPanel bookings={bookings} userRole="customer" />
          </div>
        )}
        {section === 'profile' && <ManageProfile />}
      </main>
    </div>
  );
}
