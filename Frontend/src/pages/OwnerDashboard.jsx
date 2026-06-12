import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Sidebar from '../components/Sidebar';
import StatusBadge from '../components/StatusBadge';
import ManageProfile from '../components/ManageProfile';
import ComplaintPanel from '../components/ComplaintPanel';
import ReviewsPanel from '../components/ReviewsPanel';
import { vehicleAPI, bookingAPI, userAPI } from '../services/api';
import { formatPrice, formatDate, getVehicleImageUrl } from '../utils/helpers';

const NAV_ITEMS = [
  { key: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
  { key: 'fleet', icon: 'fa-car', label: 'My Vehicles' },
  { key: 'bookings', icon: 'fa-clipboard-list', label: 'Booking Requests' },
  { key: 'active', icon: 'fa-road', label: 'Active Rentals' },
  { key: 'reviews', icon: 'fa-star', label: 'Customer Reviews' },
  { key: 'complaints', icon: 'fa-exclamation-circle', label: 'Disputes / Complaints' },
  { key: 'profile', icon: 'fa-user-cog', label: 'Manage Profile' },
];

export default function OwnerDashboard() {
  const { currentUser, showToast, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const [section, setSection] = useState('dashboard');
  const [fleet, setFleet] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [userMap, setUserMap] = useState({});   // customerId → user
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingDateFilter, setBookingDateFilter] = useState('');
  const [bookingDateFrom, setBookingDateFrom] = useState('');
  const [bookingDateTo, setBookingDateTo] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'owner') { navigate('/login'); return; }
  }, [currentUser, navigate]);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [fleetData, bookingData] = await Promise.all([
        vehicleAPI.getByOwner(currentUser.id),
        bookingAPI.getByOwner(currentUser.id),
      ]);

      // Create a map from the populated customerId in bookings
      const map = {};
      bookingData.forEach(b => {
        if (b.customerId && typeof b.customerId === 'object') {
          map[b.customerId.id || b.customerId._id] = b.customerId;
        }
      });

      setFleet(fleetData);
      setBookings(bookingData);
      setUserMap(map);
    } catch (err) {
      console.error(err);
      showToast('Failed to load dashboard data.', 'error');
    }
  }, [currentUser, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteVehicle = async (id) => {
    if (!window.confirm('Delete this vehicle?')) return;
    try {
      await vehicleAPI.delete(id);
      showToast('Vehicle removed.', 'error');
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete vehicle.', 'error');
    }
  };

  const handleBookingAction = async (id, status) => {
    try {
      await bookingAPI.updateStatus(id, status);
      showToast(status === 'active' ? 'Booking approved!' : status === 'completed' ? 'Marked as completed.' : 'Booking rejected.');
      loadData();
    } catch (err) {
      showToast(err.message || 'Action failed.', 'error');
    }
  };

  const setVehicleStatus = async (id, status) => {
    try {
      await vehicleAPI.updateStatus(id, status);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error');
    }
  };

  if (!currentUser) return null;

  const active = bookings.filter(b => b.status === 'active').length;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const totalRevenue = bookings.filter(b => ['active', 'completed'].includes(b.status)).reduce((s, b) => s + b.totalPrice, 0);
  const available = fleet.filter(v => v.status === 'available').length;

  const getDateRange = (key) => {
    const now = new Date();
    const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const eod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    const dayOfWeek = now.getDay();
    const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const thisMonday = new Date(now); thisMonday.setDate(now.getDate() + diffToMon);
    const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
    switch (key) {
      case 'today': return [sod(now), eod(now)];
      case 'yesterday': { const y = new Date(now); y.setDate(now.getDate() - 1); return [sod(y), eod(y)]; }
      case 'this_week':
      case 'current_week': return [sod(thisMonday), eod(now)];
      case 'last_week': return [sod(lastMonday), eod(lastSunday)];
      case 'this_month': return [new Date(now.getFullYear(), now.getMonth(), 1), eod(now)];
      case 'last_3_months': { const s = new Date(now); s.setMonth(s.getMonth() - 3); return [sod(s), eod(now)]; }
      case 'last_6_months': { const s = new Date(now); s.setMonth(s.getMonth() - 6); return [sod(s), eod(now)]; }
      case 'last_year': { const s = new Date(now); s.setFullYear(s.getFullYear() - 1); return [sod(s), eod(now)]; }
      default: return null;
    }
  };

  const filteredBookings = bookings.filter(b => {
    // 1. Search by customer or vehicle name
    if (bookingSearch) {
      const q = bookingSearch.toLowerCase();
      const custId = b.customerId?.id || b.customerId?._id || b.customerId;
      const cust = userMap[custId] || (b.customerId && typeof b.customerId === 'object' ? b.customerId : null);
      const custName = cust?.name || (typeof b.customerId === 'string' ? b.customerId : '');

      const vId = b.vehicleId?.id || b.vehicleId?._id || b.vehicleId;
      const v = fleet.find(vv => (vv.id || vv._id) === vId);
      const vName = v ? v.name : (b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId.name : (b.vehicleId || ''));

      if (!custName.toLowerCase().includes(q) && !vName.toLowerCase().includes(q)) {
        return false;
      }
    }

    // 2. Filter by status
    if (bookingStatusFilter && b.status !== bookingStatusFilter) {
      return false;
    }

    // 3. Filter by date range
    const d = new Date(b.startDate || b.createdAt);
    if (bookingDateFilter === 'custom') {
      if (bookingDateFrom && d < new Date(bookingDateFrom)) return false;
      if (bookingDateTo) {
        const to = new Date(bookingDateTo);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
    } else {
      const range = getDateRange(bookingDateFilter);
      if (range && (d < range[0] || d > range[1])) return false;
    }

    return true;
  });

  return (
    <div className="dashboard-layout" data-theme={theme}>
      <Sidebar navItems={NAV_ITEMS} activeSection={section} onSectionChange={setSection} />
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="dashboard-header-actions" style={{ position: 'absolute', top: '24px', right: '36px', zIndex: 10, display: 'flex', gap: '12px', alignItems: 'center' }}>
          {section === 'fleet' && (
            <button className="btn btn-primary" onClick={() => navigate('/owner/add-vehicle')}>
              <i className="fas fa-plus"></i> Add Vehicle
            </button>
          )}
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

        {/* ── DASHBOARD ── */}
        {section === 'dashboard' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-tachometer-alt" style={{ color: 'var(--accent)' }}></i> Agency Dashboard</h1>
              <p>Overview of your vehicles and bookings.</p>
            </div>
            <div className="kpi-grid">
              {[
                { icon: 'fa-car', cls: 'purple', val: fleet.length, label: 'Total Vehicles' },
                { icon: 'fa-check-circle', cls: 'green', val: available, label: 'Available' },
                { icon: 'fa-clock', cls: 'orange', val: pending, label: 'Pending Requests' },
                { icon: 'fa-road', cls: 'blue', val: active, label: 'Active Rentals' },
                { icon: 'fa-rupee-sign', cls: 'green', val: formatPrice(totalRevenue), label: 'Total Revenue' },
              ].map((k, i) => (
                <div key={i} className="kpi-card">
                  <div className={`kpi-icon ${k.cls}`}><i className={`fas ${k.icon}`}></i></div>
                  <div className="kpi-value">{k.val}</div>
                  <div className="kpi-label">{k.label}</div>
                </div>
              ))}
            </div>
            <div className="panel">
              <div className="panel-header"><h2>Recent Booking Requests</h2></div>
              <div className="panel-body no-pad">
                <div className="table-wrapper">
                  <table className="table table-hover mb-0">
                    <thead><tr><th>ID</th><th>Customer</th><th>Vehicle</th><th>Dates</th><th>Total</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {bookings.slice(0, 5).map(b => {
                        const custId = b.customerId?.id || b.customerId?._id || b.customerId;
                        const cust = userMap[custId] || (b.customerId && typeof b.customerId === 'object' ? b.customerId : null);
                        const vId = b.vehicleId?.id || b.vehicleId?._id || b.vehicleId;
                        const v = fleet.find(vv => (vv.id || vv._id) === vId);
                        const vImage = v?.image || (b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId.image : null);
                        return (
                          <tr key={b.id}>
                            <td><strong>{b.id}</strong></td>
                            <td>{cust?.name || (typeof b.customerId === 'string' ? b.customerId : 'Unknown Customer')}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {getVehicleImageUrl(vImage) ? (
                                    <img src={getVehicleImageUrl(vImage)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <i className={`fas ${vImage || 'fa-car'}`} style={{ fontSize: '0.8rem', opacity: 0.2 }}></i>
                                  )}
                                </div>
                                {v ? v.name : (b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId.name : (b.vehicleId || 'Unknown Vehicle'))}
                              </div>
                            </td>
                            <td>{formatDate(b.startDate)} → {formatDate(b.endDate)}</td>
                            <td><strong>{formatPrice(b.totalPrice)}</strong></td>
                            <td>
                              {b.paymentStatus === 'paid' ? (
                                <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#00b894' }}>✓ Paid</span>
                              ) : b.paymentStatus === 'refunded' ? (
                                <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#fdcb6e' }}>↩ Refund</span>
                              ) : (
                                <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>— Unpaid</span>
                              )}
                            </td>
                            <td><StatusBadge status={b.status} /></td>
                            <td>
                              {b.status === 'pending' && (
                                <>
                                  <button className="btn btn-success btn-xs me-1" onClick={() => handleBookingAction(b.id, 'active')}><i className="fas fa-check"></i></button>
                                  <button className="btn btn-danger btn-xs" onClick={() => handleBookingAction(b.id, 'rejected')}><i className="fas fa-times"></i></button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {bookings.length === 0 && <tr><td colSpan="7" className="text-center text-muted">No bookings yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FLEET ── */}
        {section === 'fleet' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-car" style={{ color: 'var(--accent)' }}></i> My Vehicles</h1>
              <p>Manage your vehicles — add, edit, or set maintenance status.</p>
            </div>
            {fleet.length === 0 ? (
              <div className="empty-state"><i className="fas fa-car"></i><h3>No vehicles yet</h3><p>Add your first vehicle to get started.</p></div>
            ) : (
              <div className="table-wrapper">
                <table className="table table-hover mb-0">
                  <thead><tr><th>Image</th><th>Vehicle</th><th>Type</th><th>Reg No.</th><th>Fuel</th><th>Daily Price</th><th>Status</th><th>Approved</th><th>Actions</th></tr></thead>
                  <tbody>
                    {fleet.map(v => (
                      <tr key={v.id}>
                        <td>
                          <div style={{ width: '60px', height: '40px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {getVehicleImageUrl(v.image) ? (
                              <img src={getVehicleImageUrl(v.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <i className={`fas ${v.image || 'fa-car'}`} style={{ opacity: 0.2 }}></i>
                            )}
                          </div>
                        </td>
                        <td><strong>{v.name}</strong><br /><small className="text-muted">{v.brand} {v.model}</small></td>
                        <td><span className={`badge ${v.type === '2W' ? 'bg-success' : 'bg-info text-dark'}`}>{v.type}</span></td>
                        <td>{v.regNumber}</td>
                        <td>{v.fuel}</td>
                        <td>{formatPrice(v.priceDaily)}</td>
                        <td><StatusBadge status={v.status} /></td>
                        <td><StatusBadge status={v.approved ? 'approved' : 'pending'} /></td>
                        <td>
                          <button className="btn btn-ghost btn-xs me-1" onClick={() => navigate(`/owner/update-vehicle/${v.id}`)}><i className="fas fa-edit"></i></button>
                          {v.status === 'available' && <button className="btn btn-ghost btn-xs me-1" title="Set Maintenance" onClick={() => setVehicleStatus(v.id, 'maintenance')}><i className="fas fa-tools"></i></button>}
                          {v.status === 'maintenance' && <button className="btn btn-ghost btn-xs me-1" title="Set Available" onClick={() => setVehicleStatus(v.id, 'available')}><i className="fas fa-check"></i></button>}
                          <button className="btn btn-ghost btn-xs" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteVehicle(v.id)}><i className="fas fa-trash"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── BOOKING REQUESTS ── */}
        {section === 'bookings' && (
          <div className="dashboard-section active">
            <div className="page-header"><h1><i className="fas fa-clipboard-list" style={{ color: 'var(--accent)' }}></i> Booking Requests</h1><p>Approve or reject incoming booking requests.</p></div>

            {/* ── Filter bar ── */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
              <input
                type="text"
                placeholder="🔍 Search by vehicle or customer..."
                value={bookingSearch}
                onChange={e => setBookingSearch(e.target.value)}
                style={{ flex: '1 1 200px', width: 'auto', minWidth: '180px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.88rem' }}
              />

              <select
                value={bookingDateFilter}
                onChange={e => { setBookingDateFilter(e.target.value); setBookingDateFrom(''); setBookingDateTo(''); }}
                style={{ flex: '0 1 190px', width: 'auto', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.85rem' }}
              >
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="current_week">Current Week</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_3_months">Last 3 Months</option>
                <option value="last_6_months">Last 6 Months</option>
                <option value="last_year">Last Year</option>
                <option value="custom">📅 Custom Range</option>
              </select>

              {bookingDateFilter === 'custom' && (
                <>
                  <input
                    type="date"
                    value={bookingDateFrom}
                    onChange={e => setBookingDateFrom(e.target.value)}
                    title="From date"
                    style={{ flex: '0 1 150px', width: 'auto', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: '.85rem' }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '.85rem', flexShrink: 0 }}>→</span>
                  <input
                    type="date"
                    value={bookingDateTo}
                    min={bookingDateFrom || undefined}
                    onChange={e => setBookingDateTo(e.target.value)}
                    title="To date"
                    style={{ flex: '0 1 150px', width: 'auto', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: '.85rem' }}
                  />
                </>
              )}

              <select
                value={bookingStatusFilter}
                onChange={e => setBookingStatusFilter(e.target.value)}
                style={{ flex: '0 1 160px', width: 'auto', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.85rem' }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {filteredBookings.length} / {bookings.length} requests
              </span>

              <button className="btn btn-ghost btn-sm" onClick={loadData} title="Refresh" style={{ flexShrink: 0 }}>
                <i className="fas fa-sync-alt" />
              </button>
            </div>

            {bookings.length === 0 ? (
              <div className="empty-state"><i className="fas fa-inbox"></i><h3>No booking requests</h3></div>
            ) : filteredBookings.length === 0 ? (
              <div className="empty-state"><i className="fas fa-search"></i><h3>No matching requests found</h3></div>
            ) : (
              <div className="panel">
                <div className="panel-body no-pad">
                  <div className="table-wrapper">
                    <table className="table table-hover mb-0">
                      <thead><tr><th>ID</th><th>Customer</th><th>Vehicle</th><th>Duration</th><th>Dates</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>
                        {filteredBookings.map(b => {
                          const custId = b.customerId?.id || b.customerId?._id || b.customerId;
                          const cust = userMap[custId] || (b.customerId && typeof b.customerId === 'object' ? b.customerId : null);
                          const vId = b.vehicleId?.id || b.vehicleId?._id || b.vehicleId;
                          const v = fleet.find(vv => (vv.id || vv._id) === vId);
                          const vImage = v?.image || (b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId.image : null);
                          return (
                            <tr key={b.id}>
                              <td><strong>{b.id}</strong></td>
                              <td>{cust?.name || (typeof b.customerId === 'string' ? b.customerId : 'Unknown Customer')}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {getVehicleImageUrl(vImage) ? (
                                      <img src={getVehicleImageUrl(vImage)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <i className={`fas ${vImage || 'fa-car'}`} style={{ fontSize: '0.8rem', opacity: 0.2 }}></i>
                                    )}
                                  </div>
                                  {v ? v.name : (b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId.name : (b.vehicleId || 'Unknown Vehicle'))}
                                </div>
                              </td>
                              <td><span className="badge bg-primary text-capitalize">{b.durationType}</span></td>
                              <td>{formatDate(b.startDate)} → {formatDate(b.endDate)}</td>
                              <td><strong>{formatPrice(b.totalPrice)}</strong></td>
                              <td><StatusBadge status={b.status} /></td>
                              <td>
                                {b.status === 'pending' && (
                                  <>
                                    <button className="btn btn-success btn-xs me-1" onClick={() => handleBookingAction(b.id, 'active')}>Approve</button>
                                    <button className="btn btn-danger btn-xs" onClick={() => handleBookingAction(b.id, 'rejected')}>Reject</button>
                                  </>
                                )}
                                {b.status === 'active' && (
                                  <button className="btn btn-primary btn-xs" onClick={() => handleBookingAction(b.id, 'completed')}>Complete</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE RENTALS ── */}
        {section === 'active' && (
          <div className="dashboard-section active">
            <div className="page-header"><h1><i className="fas fa-road" style={{ color: 'var(--accent)' }}></i> Active Rentals</h1><p>Track vehicles currently rented out.</p></div>
            {bookings.filter(b => b.status === 'active').length === 0 ? (
              <div className="empty-state"><i className="fas fa-road"></i><h3>No active rentals</h3></div>
            ) : (
              <div className="table-wrapper">
                <table className="table table-hover mb-0">
                  <thead><tr><th>Vehicle</th><th>Customer</th><th>Dates</th><th>Duration</th><th>Total</th><th>Status</th></tr></thead>
                  <tbody>
                    {bookings.filter(b => b.status === 'active').map(b => {
                      const custId = b.customerId?.id || b.customerId?._id || b.customerId;
                      const cust = userMap[custId] || (b.customerId && typeof b.customerId === 'object' ? b.customerId : null);
                      const vId = b.vehicleId?.id || b.vehicleId?._id || b.vehicleId;
                      const v = fleet.find(vv => (vv.id || vv._id) === vId);
                      const vImage = v?.image || (b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId.image : null);
                      return (
                        <tr key={b.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {getVehicleImageUrl(vImage) ? (
                                  <img src={getVehicleImageUrl(vImage)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <i className={`fas ${vImage || 'fa-car'}`} style={{ fontSize: '0.8rem', opacity: 0.2 }}></i>
                                )}
                              </div>
                              {v ? v.name : (b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId.name : (b.vehicleId || 'Unknown Vehicle'))}
                            </div>
                          </td>
                          <td>{cust?.name || (typeof b.customerId === 'string' ? b.customerId : 'Unknown Customer')}</td>
                          <td>{formatDate(b.startDate)} → {formatDate(b.endDate)}</td>
                          <td><span className="badge bg-primary text-capitalize">{b.durationType}</span></td>
                          <td><strong>{formatPrice(b.totalPrice)}</strong></td>
                          <td><StatusBadge status={b.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {section === 'complaints' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-exclamation-circle" style={{ color: 'var(--accent)' }}></i> Customer Complaints &amp; Disputes</h1>
              <p>Respond to complaints submitted by customers regarding your vehicles or services.</p>
            </div>
            <ComplaintPanel bookings={bookings} userRole="owner" />
          </div>
        )}

        {/* ── REVIEWS ── */}
        {section === 'reviews' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-star" style={{ color: 'var(--accent)' }}></i> Customer Reviews</h1>
              <p>View reviews submitted by customers for your rentals.</p>
            </div>
            <ReviewsPanel userRole="owner" />
          </div>
        )}

        {/* ── MANAGE PROFILE ── */}
        {section === 'profile' && <ManageProfile />}
      </main>
    </div>
  );
}
