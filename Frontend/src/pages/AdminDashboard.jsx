import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Sidebar from '../components/Sidebar';
import StatusBadge from '../components/StatusBadge';
import ManageProfile from '../components/ManageProfile';
import ComplaintPanel from '../components/ComplaintPanel';
import ReviewsPanel from '../components/ReviewsPanel';
import { userAPI, vehicleAPI, bookingAPI } from '../services/api';
import { formatPrice, formatDate, getVehicleImageUrl } from '../utils/helpers';

const NAV_ITEMS = [
  { key: 'analytics', icon: 'fa-chart-pie', label: 'Analytics' },
  { key: 'users', icon: 'fa-users', label: 'Manage Users' },
  { key: 'agencies', icon: 'fa-building', label: 'Rental Agencies' },
  { key: 'vehicles', icon: 'fa-car', label: 'Vehicle Listings' },
  { key: 'allbookings', icon: 'fa-clipboard-list', label: 'All Bookings' },
  { key: 'reviews', icon: 'fa-star', label: 'Customer Reviews' },
  { key: 'complaints', icon: 'fa-gavel', label: 'Complaints' },
  { key: 'profile', icon: 'fa-user-cog', label: 'Manage Profile' },
];

export default function AdminDashboard() {
  const { currentUser, showToast, theme, toggleTheme } = useApp();
  const navigate = useNavigate();
  const [section, setSection] = useState('analytics');
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleApprovalFilter, setVehicleApprovalFilter] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingDateFilter, setBookingDateFilter] = useState('');
  const [bookingDateFrom, setBookingDateFrom] = useState('');
  const [bookingDateTo, setBookingDateTo] = useState('');

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') { navigate('/login'); return; }
  }, [currentUser, navigate]);

  const loadAll = useCallback(async () => {
    try {
      const [u, v, b] = await Promise.all([userAPI.getAll(), vehicleAPI.getAll(), bookingAPI.getAll()]);
      setUsers(u);
      setVehicles(v);
      setBookings(b);
    } catch {
      showToast('Failed to load data.', 'error');
    }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleUser = async (id) => {
    try {
      const updated = await userAPI.toggleActive(id);
      showToast(updated.active ? 'User activated.' : 'User deactivated.', updated.active ? 'success' : 'error');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Action failed.', 'error');
    }
  };

  const approveVehicle = async (id) => {
    try {
      await vehicleAPI.approve(id, true);
      showToast('Vehicle listing approved!');
      loadAll();
    } catch (err) {
      showToast(err.message || 'Failed to approve.', 'error');
    }
  };

  if (!currentUser) return null;

  // Computed stats
  const customers = users.filter(u => u.role === 'customer').length;
  const owners = users.filter(u => u.role === 'owner').length;
  const totalBookings = bookings.length;
  const activeBookings = bookings.filter(b => b.status === 'active').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const totalRevenue = bookings.filter(b => ['active', 'completed'].includes(b.status)).reduce((s, b) => s + b.totalPrice, 0);
  const avgDuration = bookings.length > 0
    ? (bookings.reduce((s, b) => s + Math.ceil((new Date(b.endDate) - new Date(b.startDate)) / (1000 * 60 * 60 * 24)), 0) / bookings.length).toFixed(1)
    : 0;
  const conflicts = bookings.filter(b => b.status === 'rejected').length;
  const utilization = vehicles.length > 0 ? Math.round((vehicles.filter(v => v.status === 'rented').length / vehicles.length) * 100) : 0;
  const twoW = vehicles.filter(v => v.type === '2W').length;
  const fourW = vehicles.filter(v => v.type === '4W').length;
  const twoPct = vehicles.length > 0 ? Math.round((twoW / vehicles.length) * 100) : 0;

  // Filtered
  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
      (!userRoleFilter || u.role === userRoleFilter);
  });
  const filteredVehicles = vehicles.filter(v => {
    const q = vehicleSearch.toLowerCase();
    return (!q || v.name.toLowerCase().includes(q) || v.brand.toLowerCase().includes(q)) &&
      (!vehicleApprovalFilter || (vehicleApprovalFilter === 'approved' ? v.approved : !v.approved));
  });
  // Date-range helper — returns [startOfRange, endOfRange] as Date objects
  const getDateRange = (key) => {
    const now = new Date();
    const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());         // start of day
    const eod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); // end of day
    const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
    const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek); // days back to last Monday
    const thisMonday = new Date(now); thisMonday.setDate(now.getDate() + diffToMon);
    const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
    switch (key) {
      case 'today': return [sod(now), eod(now)];
      case 'yesterday': { const y = new Date(now); y.setDate(now.getDate() - 1); return [sod(y), eod(y)]; }
      case 'this_week': return [sod(thisMonday), eod(now)];
      case 'last_week': return [sod(lastMonday), eod(lastSunday)];
      case 'this_month': return [new Date(now.getFullYear(), now.getMonth(), 1), eod(now)];
      case 'last_3_months': { const s = new Date(now); s.setMonth(s.getMonth() - 3); return [sod(s), eod(now)]; }
      case 'last_6_months': { const s = new Date(now); s.setMonth(s.getMonth() - 6); return [sod(s), eod(now)]; }
      case 'last_year': { const s = new Date(now); s.setFullYear(s.getFullYear() - 1); return [sod(s), eod(now)]; }
      default: return null; // 'all' — no date restriction
    }
  };

  const filteredBookings = bookings.filter(b => {
    // Customer name search
    if (bookingSearch) {
      const q = bookingSearch.toLowerCase();
      const c = getUserById(b.customerId) || b.customerId;
      const name = typeof c === 'object' ? (c?.name || '') : (c || '');
      if (!name.toLowerCase().includes(q)) return false;
    }
    // Status filter
    if (bookingStatusFilter && b.status !== bookingStatusFilter) return false;
    // Date range filter
    const d = new Date(b.startDate || b.createdAt);
    if (bookingDateFilter === 'custom') {
      // Custom date range from the two pickers
      if (bookingDateFrom && d < new Date(bookingDateFrom)) return false;
      if (bookingDateTo) { const to = new Date(bookingDateTo); to.setHours(23, 59, 59, 999); if (d > to) return false; }
    } else {
      const range = getDateRange(bookingDateFilter);
      if (range && (d < range[0] || d > range[1])) return false;
    }
    return true;
  });
  const agencies = users.filter(u => u.role === 'owner');

  const statusBar = ['pending', 'active', 'completed', 'rejected', 'cancelled'];
  const barColors = { pending: 'var(--warning)', active: 'var(--info)', completed: 'var(--success)', rejected: 'var(--danger)', cancelled: 'var(--text-muted)' };

  // Lookup maps for optimized data retrieval
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });
  const vehicleMap = {};
  vehicles.forEach(v => { vehicleMap[v.id] = v; });
  const getUserById = (id) => userMap[id];
  const getVehicleById = (id) => vehicleMap[id];
  const getVehiclesByOwner = (ownerId) => vehicles.filter(v => v.ownerId === ownerId);

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

        {/* ── ANALYTICS ── */}
        {section === 'analytics' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-chart-pie" style={{ color: 'var(--accent)' }}></i> System Analytics</h1>
              <p>Key Performance Indicators across the platform.</p>
            </div>
            <div className="kpi-grid">
              {[
                { icon: 'fa-user-tag', cls: 'purple', val: customers, label: 'Verified Customers' },
                { icon: 'fa-building', cls: 'orange', val: owners, label: 'Rental Agencies' },
                { icon: 'fa-car', cls: 'blue', val: vehicles.length, label: 'Total Vehicles' },
                { icon: 'fa-clipboard-check', cls: 'green', val: totalBookings, label: 'Total Bookings' },
                { icon: 'fa-running', cls: 'blue', val: activeBookings, label: 'Active Rentals' },
                { icon: 'fa-clock', cls: 'orange', val: pendingBookings, label: 'Pending Requests' },
                { icon: 'fa-rupee-sign', cls: 'green', val: formatPrice(totalRevenue), label: 'Total Revenue' },
                { icon: 'fa-percentage', cls: 'purple', val: `${utilization}%`, label: 'Utilization Rate' },
                { icon: 'fa-calendar-day', cls: 'blue', val: `${avgDuration} days`, label: 'Avg Duration' },
                { icon: 'fa-exclamation-triangle', cls: 'red', val: conflicts, label: 'Conflicts' },
              ].map((k, i) => (
                <div key={i} className="kpi-card">
                  <div className={`kpi-icon ${k.cls}`}><i className={`fas ${k.icon}`}></i></div>
                  <div className="kpi-value">{k.val}</div>
                  <div className="kpi-label">{k.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
              <div className="panel">
                <div className="panel-header"><h2>Bookings by Status</h2></div>
                <div className="panel-body">
                  {statusBar.map(s => {
                    const count = bookings.filter(b => b.status === s).length;
                    const pct = totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0;
                    return (
                      <div key={s} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.85rem', marginBottom: 4 }}>
                          <span style={{ textTransform: 'capitalize' }}>{s}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                        </div>
                        <div style={{ height: 8, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: barColors[s], borderRadius: 4, transition: '.5s ease' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="panel">
                <div className="panel-header"><h2>Vehicles by Type</h2></div>
                <div className="panel-body">
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 20 }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{twoW}</div>
                      <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>2-Wheelers</div>
                    </div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 700, color: 'var(--info)' }}>{fourW}</div>
                      <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>4-Wheelers</div>
                    </div>
                  </div>
                  <div style={{ height: 10, background: 'var(--bg-card)', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${twoPct}%`, background: 'var(--success)', transition: '.5s' }}></div>
                    <div style={{ width: `${100 - twoPct}%`, background: 'var(--info)', transition: '.5s' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginTop: 6, color: 'var(--text-muted)' }}>
                    <span>2W: {twoPct}%</span><span>4W: {100 - twoPct}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel mt-3">
              <div className="panel-header"><h2>Recent Bookings</h2></div>
              <div className="panel-body no-pad">
                <div className="table-wrapper">
                  <table className="table table-hover mb-0">
                    <thead><tr><th>ID</th><th>Customer</th><th>Vehicle</th><th>Owner</th><th>Dates</th><th>Total</th><th>Status</th></tr></thead>
                    <tbody>
                      {[...bookings].reverse().slice(0, 5).map(b => {
                        const v = getVehicleById(b.vehicleId) || b.vehicleId;
                        const c = getUserById(b.customerId) || b.customerId;
                        const o = getUserById(b.ownerId) || b.ownerId;
                        const vImage = v?.image || (b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId.image : null);
                        return (
                          <tr key={b.id}>
                            <td><strong>{b.id}</strong></td>
                            <td>{c ? (typeof c === 'object' ? c.name : c) : '—'}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {getVehicleImageUrl(vImage) ? (
                                    <img src={getVehicleImageUrl(vImage)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <i className={`fas ${vImage || 'fa-car'}`} style={{ fontSize: '0.8rem', opacity: 0.2 }}></i>
                                  )}
                                </div>
                                {v ? (typeof v === 'object' ? v.name : v) : '—'}
                              </div>
                            </td>
                            <td>{o ? (typeof o === 'object' ? o.name : o) : (b.ownerId && typeof b.ownerId === 'object' ? b.ownerId.name : '—')}</td>
                            <td>{formatDate(b.startDate)} → {formatDate(b.endDate)}</td>
                            <td><strong>{formatPrice(b.totalPrice)}</strong></td>
                            <td><StatusBadge status={b.status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── USERS ── */}
        {section === 'users' && (
          <div className="dashboard-section active">
            <div className="page-header"><h1><i className="fas fa-users" style={{ color: 'var(--accent)' }}></i> Manage Users</h1><p>View and manage all registered users.</p></div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
              <input
                type="text"
                placeholder="🔍 Search by name or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                style={{ flex: '1 1 200px', width: 'auto', minWidth: '180px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.88rem' }}
              />
              <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} style={{ flex: '0 1 160px', width: 'auto', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.85rem' }}>
                <option value="">All Roles</option>
                <option value="customer">Customers</option>
                <option value="owner">Owners</option>
                <option value="admin">Admins</option>
              </select>
              <button className="btn btn-ghost btn-sm" onClick={loadAll} title="Refresh" style={{ flexShrink: 0 }}>
                <i className="fas fa-sync-alt" />
              </button>
            </div>
            <div className="table-wrapper">
              <table className="table table-hover mb-0">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>City</th><th>Joined</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong>{u.company && <><br /><small className="text-muted">{u.company}</small></>}</td>
                      <td>{u.email}</td>
                      <td><span className={`badge ${u.role === 'admin' ? 'bg-danger' : u.role === 'owner' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>{u.role}</span></td>
                      <td>{u.city || '—'}</td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td><StatusBadge status={u.active ? 'available' : 'maintenance'} /></td>
                      <td>
                        {u.role !== 'admin' ? (
                          <button className={`btn btn-xs ${u.active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleUser(u.id)}>
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                        ) : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── AGENCIES ── */}
        {section === 'agencies' && (
          <div className="dashboard-section active">
            <div className="page-header"><h1><i className="fas fa-building" style={{ color: 'var(--accent)' }}></i> Rental Agencies</h1><p>Manage registered rental agencies.</p></div>
            <div className="table-wrapper">
              <table className="table table-hover mb-0">
                <thead><tr><th>Agency Name</th><th>Contact</th><th>Email</th><th>City</th><th>Vehicles</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {agencies.map(a => {
                    const vCount = getVehiclesByOwner(a.id).length;
                    return (
                      <tr key={a.id}>
                        <td><strong>{a.company || a.name}</strong></td>
                        <td>{a.phone || '—'}</td>
                        <td>{a.email}</td>
                        <td>{a.city || '—'}</td>
                        <td><strong>{vCount}</strong></td>
                        <td><StatusBadge status={a.active ? 'available' : 'maintenance'} /></td>
                        <td><button className={`btn btn-xs ${a.active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleUser(a.id)}>{a.active ? 'Deactivate' : 'Activate'}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── VEHICLES ── */}
        {section === 'vehicles' && (
          <div className="dashboard-section active">
            <div className="page-header"><h1><i className="fas fa-car" style={{ color: 'var(--accent)' }}></i> Vehicle Listings</h1><p>Approve or reject vehicle listings submitted by agencies.</p></div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
              <input
                type="text"
                placeholder="🔍 Search vehicles..."
                value={vehicleSearch}
                onChange={e => setVehicleSearch(e.target.value)}
                style={{ flex: '1 1 200px', width: 'auto', minWidth: '180px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.88rem' }}
              />
              <select value={vehicleApprovalFilter} onChange={e => setVehicleApprovalFilter(e.target.value)} style={{ flex: '0 1 180px', width: 'auto', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.85rem' }}>
                <option value="">All Listings</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
              </select>
              <button className="btn btn-ghost btn-sm" onClick={loadAll} title="Refresh" style={{ flexShrink: 0 }}>
                <i className="fas fa-sync-alt" />
              </button>
            </div>
            <div className="table-wrapper">
              <table className="table table-hover mb-0">
                <thead><tr><th>Image</th><th>Vehicle</th><th>Type</th><th>Owner</th><th>Location</th><th>Daily Price</th><th>Status</th><th>Approved</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredVehicles.map(v => {
                    const o = getUserById(v.ownerId);
                    return (
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
                        <td>{o ? (o.company || o.name) : '—'}</td>
                        <td>{v.location}</td>
                        <td>{formatPrice(v.priceDaily)}</td>
                        <td><StatusBadge status={v.status} /></td>
                        <td><StatusBadge status={v.approved ? 'approved' : 'pending'} /></td>
                        <td>
                          {!v.approved
                            ? <button className="btn btn-success btn-xs" onClick={() => approveVehicle(v.id)}><i className="fas fa-check"></i> Approve</button>
                            : <span className="text-muted">✓</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ALL BOOKINGS ── */}
        {section === 'allbookings' && (
          <div className="dashboard-section active">
            <div className="page-header"><h1><i className="fas fa-clipboard-list" style={{ color: 'var(--accent)' }}></i> All Bookings</h1><p>Monitor all bookings across the platform.</p></div>
            {/* ── Filter bar ── */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
              {/* Customer name search */}
              <input
                type="text"
                placeholder="🔍 Search by customer name..."
                value={bookingSearch}
                onChange={e => setBookingSearch(e.target.value)}
                style={{ flex: '1 1 200px', width: 'auto', minWidth: '180px', padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.88rem' }}
              />
              {/* Date preset dropdown */}
              <select
                value={bookingDateFilter}
                onChange={e => { setBookingDateFilter(e.target.value); setBookingDateFrom(''); setBookingDateTo(''); }}
                style={{ flex: '0 1 190px', width: 'auto', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '.85rem' }}
              >
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_3_months">Last 3 Months</option>
                <option value="last_6_months">Last 6 Months</option>
                <option value="last_year">Last Year</option>
                <option value="custom">📅 Custom Range</option>
              </select>
              {/* Custom date pickers — only visible when 'custom' is selected */}
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
              {/* Status filter */}
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
              {/* Result count */}
              <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {filteredBookings.length} / {bookings.length} bookings
              </span>
              {/* Refresh */}
              <button className="btn btn-ghost btn-sm" onClick={loadAll} title="Refresh" style={{ flexShrink: 0 }}>
                <i className="fas fa-sync-alt" />
              </button>
            </div>
            <div className="table-wrapper">
              <table className="table table-hover mb-0">
                <thead><tr><th>ID</th><th>Customer</th><th>Vehicle</th><th>Owner</th><th>Duration</th><th>Dates</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {filteredBookings.map(b => {
                    const v = getVehicleById(b.vehicleId) || b.vehicleId;
                    const c = getUserById(b.customerId) || b.customerId;
                    const o = getUserById(b.ownerId) || b.ownerId;
                    const vImage = v?.image || (b.vehicleId && typeof b.vehicleId === 'object' ? b.vehicleId.image : null);
                    return (
                      <tr key={b.id}>
                        <td><strong>{b.id}</strong></td>
                        <td>{c ? (typeof c === 'object' ? c.name : c) : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {getVehicleImageUrl(vImage) ? (
                                <img src={getVehicleImageUrl(vImage)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <i className={`fas ${vImage || 'fa-car'}`} style={{ fontSize: '0.8rem', opacity: 0.2 }}></i>
                              )}
                            </div>
                            {v ? (typeof v === 'object' ? v.name : v) : '—'}
                          </div>
                        </td>
                        <td>{o ? (typeof o === 'object' ? o.name : o) : (b.ownerId && typeof b.ownerId === 'object' ? b.ownerId.name : '—')}</td>
                        <td><span className="badge bg-primary text-capitalize">{b.durationType}</span></td>
                        <td>{formatDate(b.startDate)} → {formatDate(b.endDate)}</td>
                        <td><strong>{formatPrice(b.totalPrice)}</strong></td>
                        <td><StatusBadge status={b.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── COMPLAINTS ── */}
        {section === 'complaints' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-gavel" style={{ color: 'var(--accent)' }}></i> Complaint Control Center</h1>
              <p>Review, escalate, resolve, and close all platform complaints and disputes.</p>
            </div>
            <ComplaintPanel userRole="admin" />
          </div>
        )}

        {/* ── REVIEWS ── */}
        {section === 'reviews' && (
          <div className="dashboard-section active">
            <div className="page-header">
              <h1><i className="fas fa-star" style={{ color: 'var(--accent)' }}></i> Customer Reviews</h1>
              <p>Monitor and moderate customer reviews across the platform.</p>
            </div>
            <ReviewsPanel userRole="admin" />
          </div>
        )}

        {/* ── MANAGE PROFILE ── */}
        {section === 'profile' && <ManageProfile />}
      </main>
    </div>
  );
}
