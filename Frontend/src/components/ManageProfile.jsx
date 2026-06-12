import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { profileAPI } from '../services/api';

/**
 * ManageProfile — Shared across Admin, Customer, and Owner dashboards.
 * Handles:
 *  - Profile Overview (name, phone, location, company)
 *  - Email change with OTP verification
 *  - Secure password change (old password required)
 *  - Professional email notifications for both flows
 */
export default function ManageProfile() {
  const { currentUser, showToast, updateUser } = useApp();

  // ── Profile tab state ──
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'security'
  const [loading, setLoading] = useState(false);

  // ── Profile fields ──
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    city: '',
    company: '',
  });
  const [currentEmail, setCurrentEmail] = useState('');

  // ── Email change sub-flow ──
  const [emailStep, setEmailStep] = useState('idle'); // 'idle' | 'input' | 'otp'
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailTimer, setEmailTimer] = useState(0);

  // ── Password change ──
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Resend timer ref
  const timerRef = useRef(null);

  // ── Populate form from context ──
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
        city: currentUser.city || '',
        company: currentUser.company || '',
      });
      setCurrentEmail(currentUser.email || '');
    }
  }, [currentUser]);

  // ── Countdown for email OTP resend ──
  useEffect(() => {
    if (emailTimer > 0) {
      timerRef.current = setInterval(() => setEmailTimer(t => t - 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [emailTimer]);

  // ────────────────────────────────────────────
  // Profile Update Handler
  // ────────────────────────────────────────────
  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim()) { showToast('Full name is required.', 'error'); return; }
    if (profileForm.phone && !/^[6-9]\d{9}$/.test(profileForm.phone)) {
      showToast('Please enter a valid 10-digit Indian phone number.', 'error'); return;
    }
    setLoading(true);
    try {
      const result = await profileAPI.update(profileForm);
      if (result.success) {
        updateUser(result.user);
        showToast('Profile updated successfully!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Profile update failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────
  // Email Change — Step 1: Send OTP
  // ────────────────────────────────────────────
  const handleSendEmailOTP = async (e) => {
    e.preventDefault();
    if (!newEmailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmailInput)) {
      showToast('Please enter a valid email address.', 'error'); return;
    }
    setLoading(true);
    try {
      const result = await profileAPI.sendEmailOTP(newEmailInput);
      if (result.success) {
        showToast(result.message, 'success');
        setEmailStep('otp');
        setEmailTimer(60);
        setEmailOtp('');
      }
    } catch (err) {
      showToast(err.message || 'Failed to send verification code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────
  // Email Change — Step 2: Verify OTP
  // ────────────────────────────────────────────
  const handleVerifyEmailOTP = async (e) => {
    e.preventDefault();
    if (emailOtp.length !== 6) { showToast('Please enter a valid 6-digit code.', 'error'); return; }
    setLoading(true);
    try {
      const result = await profileAPI.verifyEmailOTP(emailOtp);
      if (result.success) {
        updateUser(result.user);
        setCurrentEmail(result.user.email);
        showToast('Email updated and verified successfully! Confirmation email sent.', 'success');
        setEmailStep('idle');
        setNewEmailInput('');
        setEmailOtp('');
      }
    } catch (err) {
      showToast(err.message || 'Invalid OTP. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────
  // Email OTP Resend
  // ────────────────────────────────────────────
  const handleResendEmailOTP = async () => {
    if (emailTimer > 0 || loading) return;
    setLoading(true);
    try {
      const result = await profileAPI.sendEmailOTP(newEmailInput);
      if (result.success) {
        showToast('New verification code sent!', 'success');
        setEmailTimer(60);
        setEmailOtp('');
      }
    } catch (err) {
      showToast(err.message || 'Resend failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────
  // Password Change Handler
  // ────────────────────────────────────────────
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    const { oldPassword, newPassword, confirmPassword } = pwForm;
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('All password fields are required.', 'error'); return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New password and confirm password do not match.', 'error'); return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPassword)) {
      showToast('Password must be at least 8 characters with letters and numbers.', 'error'); return;
    }
    setLoading(true);
    try {
      const result = await profileAPI.changePassword(oldPassword, newPassword, confirmPassword);
      if (result.success) {
        showToast('Password updated successfully! A security email has been sent to you.', 'success');
        setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      showToast(err.message || 'Password change failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  const tabStyle = (key) => ({
    padding: '10px 24px',
    fontWeight: 600,
    fontSize: '0.9rem',
    border: 'none',
    borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
    background: 'transparent',
    color: activeTab === key ? 'var(--accent)' : 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    letterSpacing: '0.3px',
  });

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-dark)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    transition: 'border-color 0.2s',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <div className="dashboard-section active">
      <div className="page-header">
        <h1><i className="fas fa-user-cog" style={{ color: 'var(--accent)' }}></i> Manage Profile</h1>
        <p>Update your personal information and security settings securely.</p>
      </div>

      {/* ── TAB SWITCHER ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '28px', gap: '4px' }}>
        <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>
          <i className="fas fa-id-card" style={{ marginRight: 8 }}></i>Profile Overview
        </button>
        <button style={tabStyle('security')} onClick={() => setActiveTab('security')}>
          <i className="fas fa-lock" style={{ marginRight: 8 }}></i>Security
        </button>
      </div>

      {/* ══════════════════════════════════════════
          PROFILE OVERVIEW TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

          {/* Left: Basic Info Form */}
          <div className="panel">
            <div className="panel-header">
              <h2><i className="fas fa-user" style={{ marginRight: 8, color: 'var(--accent)' }}></i>Personal Information</h2>
            </div>
            <div className="panel-body">
              <form onSubmit={handleProfileSave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input style={inputStyle} type="text" placeholder="Your full name" required
                      value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input style={inputStyle} type="tel" placeholder="10-digit mobile number"
                      value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} />
                  </div>
                  <div>
                    <label style={labelStyle}>Location / City</label>
                    <input style={inputStyle} type="text" placeholder="e.g. Mumbai"
                      value={profileForm.city} onChange={e => setProfileForm({ ...profileForm, city: e.target.value })} />
                  </div>
                  {currentUser.role === 'owner' && (
                    <div>
                      <label style={labelStyle}>Agency / Fleet Name</label>
                      <input style={inputStyle} type="text" placeholder="e.g. Mumbai Rentals"
                        value={profileForm.company} onChange={e => setProfileForm({ ...profileForm, company: e.target.value })} />
                    </div>
                  )}
                </div>

                {/* Current email — read-only display */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={labelStyle}>Current Email</label>
                  <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 10, opacity: 0.7, cursor: 'not-allowed' }}>
                    <i className="fas fa-envelope" style={{ color: 'var(--accent)', flexShrink: 0 }}></i>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentEmail}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 700, flexShrink: 0 }}>✓ Verified</span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    To change your email, use the <strong style={{ color: 'var(--accent)' }}>Email Change</strong> section on the right.
                  </p>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                  {loading
                    ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                    : <><i className="fas fa-save"></i> Save Profile</>}
                </button>
              </form>
            </div>
          </div>

          {/* Right: Email Change Flow */}
          <div className="panel">
            <div className="panel-header">
              <h2><i className="fas fa-at" style={{ marginRight: 8, color: 'var(--info)' }}></i>Change Email Address</h2>
            </div>
            <div className="panel-body">

              {/* Account info card */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '16px 18px', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--info))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                    {currentUser.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{currentUser.name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{currentEmail}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: 2 }}>
                      <i className="fas fa-shield-alt" style={{ marginRight: 4 }}></i>
                      {currentUser.role?.charAt(0).toUpperCase() + currentUser.role?.slice(1)} • Verified Account
                    </div>
                  </div>
                </div>
              </div>

              {/* Email change: idle state */}
              {emailStep === 'idle' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ marginBottom: 16 }}>
                    <i className="fas fa-envelope-open-text" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', opacity: 0.4 }}></i>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '10px 0 0' }}>
                      Changing your email requires OTP verification sent to the new email address.
                    </p>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setEmailStep('input')}>
                    <i className="fas fa-edit"></i> Change Email Address
                  </button>
                </div>
              )}

              {/* Email change: input new email */}
              {emailStep === 'input' && (
                <form onSubmit={handleSendEmailOTP}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>New Email Address <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input style={inputStyle} type="email" placeholder="new@email.com" required autoFocus
                      value={newEmailInput} onChange={e => setNewEmailInput(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }}
                      onClick={() => { setEmailStep('idle'); setNewEmailInput(''); }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                      {loading ? <><i className="fas fa-spinner fa-spin"></i> Sending...</> : <><i className="fas fa-paper-plane"></i> Send OTP</>}
                    </button>
                  </div>
                </form>
              )}

              {/* Email change: verify OTP */}
              {emailStep === 'otp' && (
                <form onSubmit={handleVerifyEmailOTP}>
                  <div style={{ background: 'rgba(0,206,201,0.06)', border: '1px solid rgba(0,206,201,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 18, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    <i className="fas fa-info-circle" style={{ color: 'var(--info)', marginRight: 8 }}></i>
                    A 6-digit verification code was sent to <strong style={{ color: 'var(--text-primary)' }}>{newEmailInput}</strong>. Check your inbox.
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>Enter 6-Digit OTP</label>
                    <input
                      style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '12px' }}
                      type="text" placeholder="••••••" maxLength={6} autoFocus required
                      value={emailOtp} onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }} disabled={loading}>
                    {loading ? <><i className="fas fa-spinner fa-spin"></i> Verifying...</> : <><i className="fas fa-check-circle"></i> Verify & Update Email</>}
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.83rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {emailTimer > 0
                        ? <><i className="far fa-clock"></i> Resend in <strong>{emailTimer}s</strong></>
                        : <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', padding: 0 }}
                          onClick={handleResendEmailOTP} disabled={loading}>
                          <i className="fas fa-redo"></i> Resend OTP
                        </button>
                      }
                    </span>
                    <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.83rem', padding: 0 }}
                      onClick={() => { setEmailStep('idle'); setNewEmailInput(''); setEmailOtp(''); }}>
                      <i className="fas fa-times"></i> Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          SECURITY TAB
      ══════════════════════════════════════════ */}
      {activeTab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>

          {/* Left: Change Password Form */}
          <div className="panel">
            <div className="panel-header">
              <h2><i className="fas fa-shield-alt" style={{ marginRight: 8, color: 'var(--danger)' }}></i>Change Password</h2>
            </div>
            <div className="panel-body">
              <form onSubmit={handlePasswordChange}>
                {[
                  { key: 'oldPassword', label: 'Old Password', placeholder: 'Current password', show: showOldPw, toggle: setShowOldPw },
                  { key: 'newPassword', label: 'New Password', placeholder: 'Min 8 chars (letter + number)', show: showNewPw, toggle: setShowNewPw },
                  { key: 'confirmPassword', label: 'Confirm New Password', placeholder: 'Confirm your new password', show: showNewPw, toggle: null },
                ].map(field => (
                  <div key={field.key} style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>{field.label} <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input
                        style={{ ...inputStyle, paddingRight: field.toggle !== undefined ? 40 : 14 }}
                        type={field.show ? 'text' : 'password'}
                        placeholder={field.placeholder}
                        required
                        value={pwForm[field.key]}
                        onChange={e => setPwForm({ ...pwForm, [field.key]: e.target.value })}
                      />
                      {field.toggle && (
                        <button type="button"
                          onClick={() => field.toggle(p => !p)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', padding: 0 }}>
                          <i className={`fas ${field.show ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Password strength hint */}
                {pwForm.newPassword && (
                  <div style={{ marginBottom: 16 }}>
                    {(() => {
                      const pw = pwForm.newPassword;
                      const hasLen = pw.length >= 8;
                      const hasLetter = /[A-Za-z]/.test(pw);
                      const hasNum = /\d/.test(pw);
                      const strength = [hasLen, hasLetter, hasNum].filter(Boolean).length;
                      const colors = ['var(--danger)', 'var(--warning)', 'var(--success)'];
                      const labels = ['Weak', 'Fair', 'Strong'];
                      return (
                        <div>
                          <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                            {[0, 1, 2].map(i => (
                              <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < strength ? colors[strength - 1] : 'var(--glass-border)', transition: 'background 0.3s' }}></div>
                            ))}
                          </div>
                          <span style={{ fontSize: '0.78rem', color: colors[strength - 1], fontWeight: 600 }}>
                            {labels[strength - 1] || ''}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading
                    ? <><i className="fas fa-spinner fa-spin"></i> Updating...</>
                    : <><i className="fas fa-lock"></i> Update Password</>}
                </button>
              </form>
            </div>
          </div>

          {/* Right: Security Info Panel */}
          <div>
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-header">
                <h2><i className="fas fa-info-circle" style={{ marginRight: 8, color: 'var(--info)' }}></i>Account Status</h2>
              </div>
              <div className="panel-body">
                {[
                  { icon: 'fa-user', label: 'Name', value: currentUser.name },
                  { icon: 'fa-envelope', label: 'Email', value: currentEmail },
                  { icon: 'fa-user-tag', label: 'Role', value: currentUser.role?.charAt(0).toUpperCase() + currentUser.role?.slice(1) },
                  { icon: 'fa-check-circle', label: 'Account Status', value: 'Active & Verified', green: true },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < 3 ? '1px solid var(--glass-border)' : 'none' }}>
                    <i className={`fas ${row.icon}`} style={{ color: 'var(--accent)', width: 18, textAlign: 'center' }}></i>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>{row.label}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: row.green ? 'var(--success)' : 'var(--text-primary)' }}>{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel" style={{ border: '1px solid rgba(240,88,12,0.15)' }}>
              <div className="panel-header" style={{ borderBottom: '1px solid rgba(240,88,12,0.15)' }}>
                <h2><i className="fas fa-exclamation-triangle" style={{ marginRight: 8, color: 'var(--warning)' }}></i>Security Tips</h2>
              </div>
              <div className="panel-body">
                {[
                  'Use a unique password not used on other sites',
                  'Include letters, numbers, and special characters',
                  'Never share your password with anyone',
                  'Update your password every 3–6 months',
                  'Enable a strong email for account recovery',
                ].map((tip, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < 4 ? 12 : 0 }}>
                    <i className="fas fa-shield-alt" style={{ color: 'var(--warning)', fontSize: '0.75rem', marginTop: 3, flexShrink: 0 }}></i>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
