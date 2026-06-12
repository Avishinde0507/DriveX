import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useApp } from '../context/AppContext';

export default function Login() {
  const { currentUser, login, showToast } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login'); // 'login', 'register', 'verify-otp', 'forgot-password'
  const [selectedRole, setSelectedRole] = useState('customer');
  const [loading, setLoading] = useState(false);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [regData, setRegData] = useState({ name: '', email: '', password: '', phone: '', city: '', company: '' });
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);

  // Verification & Resend States
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Forgot Password Flow States
  const [forgotStep, setForgotStep] = useState('email'); // 'email', 'otp', 'reset'
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);

  // Countdown timer effect for resending OTPs
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (currentUser) {
      const dashMap = { customer: '/customer', owner: '/owner', admin: '/admin' };
      navigate(dashMap[currentUser.role] || '/customer');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!loginData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginData.email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    if (!loginData.password) {
      showToast('Password is required.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.login(loginData.email, loginData.password);
      if (result.success) {
        login(result.user);
        showToast('Welcome back, ' + result.user.name + '!', 'success');
        const dashMap = { customer: '/customer', owner: '/owner', admin: '/admin' };
        setTimeout(() => navigate(dashMap[result.user.role] || '/customer'), 800);
      }
    } catch (err) {
      // If user is unverified, handle redirection to OTP view
      if (err.message && err.message.includes('not verified')) {
        showToast(err.message, 'warning');
        setVerificationEmail(loginData.email);
        setResendTimer(60);
        setTab('verify-otp');
      } else {
        showToast(err.message || 'Login failed.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!regData.name.trim()) {
      showToast('Full Name is required.', 'error');
      return;
    }

    if (!regData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regData.email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    if (regData.phone && !/^[6-9]\d{9}$/.test(regData.phone)) {
      showToast('Please enter a valid 10-digit phone number.', 'error');
      return;
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(regData.password)) {
      showToast('Password must be at least 8 characters long and contain both letters and numbers.', 'error');
      return;
    }

    if (selectedRole === 'owner' && !regData.company.trim()) {
      showToast('Agency/Fleet name is required for owners.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.register({
        name: regData.name,
        email: regData.email,
        password: regData.password,
        role: selectedRole,
        phone: regData.phone || '',
        city: regData.city || '',
        company: regData.company || '',
      });

      if (result.success) {
        showToast(result.message || 'OTP sent to registered email.', 'success');
        setVerificationEmail(regData.email);
        setResendTimer(60);
        setOtp('');
        setTab('verify-otp');
      }
    } catch (err) {
      showToast(err.message || 'Registration failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // OTP Account Activation verification handler
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      showToast('Please enter a valid 6-digit verification code.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.verifyOTP(verificationEmail, otp);
      if (result.success) {
        showToast('Account activated successfully! Please login with your email and password.', 'success');
        setLoginData({ email: verificationEmail, password: '' });
        setOtp('');
        setTab('login');
      }
    } catch (err) {
      showToast(err.message || 'Invalid OTP. Please check the code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Shared Resend OTP handler
  const handleResend = async (reason) => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const result = await authAPI.resendOTP(verificationEmail, reason);
      if (result.success) {
        showToast('A fresh OTP has been sent to your email address.', 'success');
        setResendTimer(60);
      }
    } catch (err) {
      showToast(err.message || 'Resend failed. Please try again later.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Forgot password flow handlers
  const handleForgotEmailSubmit = async (e) => {
    e.preventDefault();
    if (!verificationEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verificationEmail)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.forgotPassword(verificationEmail);
      if (result.success) {
        showToast('Verification code sent successfully!', 'success');
        setResendTimer(60);
        setOtp('');
        setForgotStep('otp');
      }
    } catch (err) {
      showToast(err.message || 'Failed to send reset code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotOtpSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      showToast('Please enter a valid 6-digit code.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.verifyForgotOTP(verificationEmail, otp);
      if (result.success) {
        showToast('OTP verified. Please set your new password.', 'success');
        setResetOtp(otp);
        setNewPassword('');
        setConfirmPassword('');
        setForgotStep('reset');
      }
    } catch (err) {
      showToast(err.message || 'Invalid or expired reset code.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      showToast('Password must be at least 8 characters long and contain both letters and numbers.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match. Please verify.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.resetPassword(verificationEmail, resetOtp, newPassword);
      if (result.success) {
        showToast('Your password has been updated. Please login.', 'success');
        setTab('login');
        setLoginData({ email: verificationEmail, password: '' });
        setForgotStep('email');
      }
    } catch (err) {
      showToast(err.message || 'Password reset failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Render method helpers
  const handleBackToLogin = () => {
    setTab('login');
    setForgotStep('email');
    setOtp('');
  };

  return (
    <div className="auth-page">
      <div className="hero-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      <div className={`auth-card animate-visible ${tab === 'register' ? 'register-mode' : 'glass-card'}`}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
          <Link to="/" className="logo">
            <img src="/DriveX-logo.png" alt="DriveX Logo" style={{ height: '100px', objectFit: 'contain', display: 'block' }} />
          </Link>
        </div>

        {/* Dynamic Card Header / Sub-flows */}
        {(tab === 'login' || tab === 'register') ? (
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Login</button>
            <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Register</button>
          </div>
        ) : tab === 'verify-otp' ? (
          <h3 className="text-center mt-4 mb-2 font-heading font-bold" style={{ fontSize: '1.5rem' }}>
            Verify Email
          </h3>
        ) : (
          <h3 className="text-center mt-4 mb-2 font-heading font-bold" style={{ fontSize: '1.5rem' }}>
            Forgot Password
          </h3>
        )}

        {/* LOGIN FORM */}
        {tab === 'login' && (
          <form className="auth-form active" onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email Address <span className="required-asterisk">*</span></label>
              <div className="input-icon">
                <i className="fas fa-envelope"></i>
                <input type="email" placeholder="name@example.com" required
                  value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} />
              </div>
            </div>
            <div className="form-group mb-1">
              <label>Password <span className="required-asterisk">*</span></label>
              <div className="input-icon">
                <i className="fas fa-lock"></i>
                <input type={showLoginPass ? "text" : "password"} placeholder="••••••••" required
                  value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} />
                <span className="pass-toggle" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLoginPass(prev => !prev); }}>
                  <i className={`fas ${showLoginPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </span>
              </div>
            </div>

            <div className="forgot-password-link-container">
              <span className="forgot-password-link" onClick={() => { setVerificationEmail(loginData.email); setTab('forgot-password'); setForgotStep('email'); }}>
                Forgot Password?
              </span>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg mt-2" disabled={loading}>
              {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sign-in-alt"></i>} Login
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {tab === 'register' && (
          <form className="auth-form active" onSubmit={handleRegister}>
            <div className="form-group">
              <label>Select Role</label>
              <div className="role-selector">
                {[
                  { role: 'customer', icon: 'fa-user', label: 'Customer' },
                  { role: 'owner', icon: 'fa-building', label: 'Renter Agency' },
                ].map(opt => (
                  <div key={opt.role}
                    className={`role-option ${selectedRole === opt.role ? 'selected' : ''}`}
                    onClick={() => setSelectedRole(opt.role)}>
                    <i className={`fas ${opt.icon}`}></i>
                    <span>{opt.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Full Name <span className="required-asterisk">*</span></label>
              <div className="input-icon">
                <i className="fas fa-user-circle"></i>
                <input type="text" placeholder="Enter your name" required
                  value={regData.name} onChange={e => setRegData({ ...regData, name: e.target.value })} />
              </div>
            </div>
            {selectedRole === 'owner' && (
              <div className="form-group">
                <label>Agency / Fleet Name <span className="required-asterisk">*</span></label>
                <div className="input-icon">
                  <i className="fas fa-id-card"></i>
                  <input type="text" placeholder="e.g. Mumbai Rentals" required
                    value={regData.company} onChange={e => setRegData({ ...regData, company: e.target.value })} />
                </div>
              </div>
            )}
            <div className="form-group">
              <label>Email Address <span className="required-asterisk">*</span></label>
              <div className="input-icon">
                <i className="fas fa-at"></i>
                <input type="email" placeholder="email@example.com" required
                  value={regData.email} onChange={e => setRegData({ ...regData, email: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone Number <span className="required-asterisk">*</span></label>
                <div className="input-icon">
                  <i className="fas fa-phone-alt"></i>
                  <input type="tel" placeholder="Contact no." required
                    value={regData.phone} onChange={e => setRegData({ ...regData, phone: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Location / City <span className="required-asterisk">*</span></label>
                <div className="input-icon">
                  <i className="fas fa-map-marked-alt"></i>
                  <input type="text" placeholder="e.g. Pune" required
                    value={regData.city} onChange={e => setRegData({ ...regData, city: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Secure Password <span className="required-asterisk">*</span></label>
              <div className="input-icon">
                <i className="fas fa-shield-alt"></i>
                <input type={showRegPass ? "text" : "password"} placeholder="Min 8 chars (Letter + Number)" required minLength="8"
                  value={regData.password} onChange={e => setRegData({ ...regData, password: e.target.value })} />
                <span className="pass-toggle" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowRegPass(prev => !prev); }}>
                  <i className={`fas ${showRegPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </span>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg mt-3" disabled={loading}>
              {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-user-plus"></i>} Create Account
            </button>
          </form>
        )}

        {/* REGISTRATION OTP VERIFICATION FORM */}
        {tab === 'verify-otp' && (
          <form className="auth-form active" onSubmit={handleVerifyOTP}>
            <div className="auth-header-desc">
              We have sent a 6-digit activation code to <br /><strong>{verificationEmail}</strong>.<br />
              Please enter it below to activate your account.
            </div>

            <div className="form-group">
              <label className="text-center w-100">Verification OTP Code</label>
              <div className="input-icon text-center">
                <input type="text" className="otp-single-input" placeholder="••••••" required
                  maxLength="6" minLength="6" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg mt-3" disabled={loading}>
              {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check-circle"></i>} Activate Account
            </button>

            <div className="otp-timer-container">
              {resendTimer > 0 ? (
                <span><i className="far fa-clock"></i> Resend code in <strong>{resendTimer}s</strong></span>
              ) : (
                <button type="button" className="resend-btn" onClick={() => handleResend('register')} disabled={loading}>
                  <i className="fas fa-paper-plane"></i> Resend OTP Code
                </button>
              )}
            </div>

            <div className="text-center">
              <span className="auth-back-link cursor-pointer" onClick={handleBackToLogin}>
                <i className="fas fa-arrow-left"></i> Back to Login
              </span>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD WORKFLOW */}
        {tab === 'forgot-password' && (
          <div className="auth-form active">
            {/* Step 1: Input Email */}
            {forgotStep === 'email' && (
              <form onSubmit={handleForgotEmailSubmit}>
                <div className="auth-header-desc">
                  Enter your registered email address below. We'll send you a One-Time Password (OTP) to securely reset your password.
                </div>
                <div className="form-group">
                  <label>Email Address <span className="required-asterisk">*</span></label>
                  <div className="input-icon">
                    <i className="fas fa-envelope"></i>
                    <input type="email" placeholder="email@example.com" required
                      value={verificationEmail} onChange={e => setVerificationEmail(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-block btn-lg mt-3" disabled={loading}>
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>} Send Reset OTP
                </button>
                <div className="text-center">
                  <span className="auth-back-link cursor-pointer" onClick={handleBackToLogin}>
                    <i className="fas fa-arrow-left"></i> Back to Login
                  </span>
                </div>
              </form>
            )}

            {/* Step 2: Input Reset OTP */}
            {forgotStep === 'otp' && (
              <form onSubmit={handleForgotOtpSubmit}>
                <div className="auth-header-desc">
                  We've sent a 6-digit password reset code to <br /><strong>{verificationEmail}</strong>.
                </div>
                <div className="form-group">
                  <label className="text-center w-100 font-bold">Enter Reset OTP</label>
                  <div className="input-icon">
                    <input type="text" className="otp-single-input" placeholder="••••••" required
                      maxLength="6" minLength="6" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-block btn-lg mt-3" disabled={loading}>
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>} Verify Code
                </button>

                <div className="otp-timer-container">
                  {resendTimer > 0 ? (
                    <span><i className="far fa-clock"></i> Resend code in <strong>{resendTimer}s</strong></span>
                  ) : (
                    <button type="button" className="resend-btn" onClick={() => handleResend('forgot')} disabled={loading}>
                      <i className="fas fa-paper-plane"></i> Resend Reset OTP
                    </button>
                  )}
                </div>

                <div className="text-center">
                  <span className="auth-back-link cursor-pointer" onClick={() => setForgotStep('email')}>
                    <i className="fas fa-arrow-left"></i> Back
                  </span>
                </div>
              </form>
            )}

            {/* Step 3: Enter New Password */}
            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPasswordSubmit}>
                <div className="auth-header-desc">
                  Set a secure new password for your account <strong>{verificationEmail}</strong>.
                </div>
                <div className="form-group">
                  <label>New Password <span className="required-asterisk">*</span></label>
                  <div className="input-icon">
                    <i className="fas fa-lock"></i>
                    <input type={showResetPass ? "text" : "password"} placeholder="Min 8 chars (Letter + Number)" required minLength="8"
                      value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <span className="pass-toggle" onClick={() => setShowResetPass(prev => !prev)}>
                      <i className={`fas ${showResetPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirm Password <span className="required-asterisk">*</span></label>
                  <div className="input-icon">
                    <i className="fas fa-shield-alt"></i>
                    <input type={showResetPass ? "text" : "password"} placeholder="Confirm your password" required minLength="8"
                      value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-block btn-lg mt-3" disabled={loading}>
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>} Update Password
                </button>
                <div className="text-center">
                  <span className="auth-back-link cursor-pointer" onClick={handleBackToLogin}>
                    <i className="fas fa-arrow-left"></i> Cancel and Login
                  </span>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="auth-footer">
          <Link to="/"><i className="fas fa-arrow-left"></i><span>Home Page</span></Link>
        </div>
      </div>
    </div>
  );
}
