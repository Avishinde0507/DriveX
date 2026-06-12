import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function Sidebar({ navItems, activeSection, onSectionChange }) {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const avatarIcon = {
    customer: 'fa-user',
    owner: 'fa-building',
    admin: 'fa-user-shield',
  }[currentUser?.role] || 'fa-user';

  return (
    <>
      {/* Mobile toggle */}
      <button className="sidebar-toggle d-md-none" onClick={() => setOpen(!open)}>
        <i className="fas fa-bars"></i>
      </button>

      <aside className={`sidebar ${open ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <Link to="/" className="logo" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <img src="/DriveX-logo.png" alt="DriveX Logo" style={{ height: '65px', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          </Link>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">
            <i className={`fas ${avatarIcon}`}></i>
          </div>
          <div className="sidebar-user-info">
            <strong>{currentUser?.name || 'User'}</strong>
            <span style={{ textTransform: 'capitalize' }}>{currentUser?.role || ''}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <a
              key={item.key}
              href={`#${item.key}`}
              className={activeSection === item.key ? 'active' : ''}
              onClick={(e) => { e.preventDefault(); onSectionChange(item.key); setOpen(false); }}
            >
              <i className={`fas ${item.icon}`}></i> {item.label}
            </a>
          ))}
          <div className="nav-divider"></div>
          <Link to="/"><i className="fas fa-home"></i> Home</Link>
        </nav>

        <div className="sidebar-footer">
          <a href="#logout" onClick={(e) => { e.preventDefault(); logout(); navigate('/login'); }}>
            <i className="fas fa-sign-out-alt"></i> Logout
          </a>
        </div>
      </aside>
    </>
  );
}
