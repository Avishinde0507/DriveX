import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { vehicleAPI, bookingAPI, paymentAPI } from '../services/api';
import {
  formatPrice, getTomorrowDateTimeStr,
  getTodayDateTimeStr, addDaysToDateTime, calculatePrice, getVehicleImageUrl
} from '../utils/helpers';
import Sidebar from '../components/Sidebar';

const NAV_ITEMS = [
  { key: 'browse', icon: 'fa-search', label: 'Browse Vehicles' },
  { key: 'bookings', icon: 'fa-calendar-alt', label: 'My Bookings' },
];

function fmtCard(val) {
  return val.replace(/\D/g, '').substring(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function fmtExpiry(val) {
  const d = val.replace(/\D/g, '').substring(0, 4);
  return d.length >= 3 ? d.substring(0, 2) + '/' + d.substring(2) : d;
}
function generateTxnId() {
  return 'TXN' + Date.now() + Math.floor(Math.random() * 9999).toString().padStart(4, '0');
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/* ── Step 1: Booking Preference ── */
function StepBooking({ vehicle, bookingForm, setBookingForm, estimatedPrice, onNext, onCancel, paying }) {
  const allImages = [vehicle.image, ...(vehicle.images || [])].filter(Boolean);
  const [activeImg, setActiveImg] = React.useState(allImages[0] || vehicle.image);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px', alignItems: 'start' }}>
      <div className="panel animate-visible">
        <div className="panel-header"><h2>Vehicle Details</h2></div>
        <div className="panel-body">
          <div style={{
            height: '280px', borderRadius: 'var(--radius-lg)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(135deg, ${vehicle.color || 'var(--accent)'}, #0a0a0a)`,
            marginBottom: '12px', position: 'relative', overflow: 'hidden',
            border: '1px solid var(--glass-border)'
          }}>
            <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 3 }}>
              <span className={`vehicle-badge-tag ${vehicle.type === '2W' ? 'eco' : 'premium'}`}>
                {vehicle.type === '2W' ? '2-Wheeler' : '4-Wheeler'}
              </span>
            </div>
            {getVehicleImageUrl(activeImg) ? (
              <img src={getVehicleImageUrl(activeImg)} alt={vehicle.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'all 0.3s ease' }} />
            ) : (
              <i className={`fas ${activeImg || 'fa-car'}`}
                style={{ fontSize: '6rem', color: 'rgba(255,255,255,0.05)', textShadow: '0 0 15px var(--accent-glow)' }}></i>
            )}
          </div>

          {/* Thumbnail list */}
          {allImages.length > 1 && (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '24px' }}>
              {allImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveImg(img)}
                  style={{
                    width: '64px', height: '48px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer',
                    border: `2px solid ${activeImg === img ? 'var(--accent)' : 'var(--glass-border)'}`,
                    boxShadow: activeImg === img ? '0 0 8px var(--accent-glow)' : 'none',
                    transition: 'all 0.2s', flexShrink: 0, background: 'rgba(255,255,255,0.03)'
                  }}
                >
                  {getVehicleImageUrl(img) ? (
                    <img src={getVehicleImageUrl(img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fas fa-camera" style={{ fontSize: '0.8rem', opacity: 0.3 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{vehicle.name}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>{vehicle.brand} {vehicle.model}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{formatPrice(vehicle.priceDaily)}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>PER DAY</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '24px' }}>
            {[
              { label: 'Fuel', icon: vehicle.fuel === 'Electric' ? 'fa-charging-station' : 'fa-gas-pump', val: vehicle.fuel },
              { label: 'Trans.', icon: 'fa-cog', val: vehicle.transmission },
              { label: 'Seats', icon: 'fa-user-friends', val: vehicle.seats },
              { label: 'City', icon: 'fa-map-marker-alt', val: vehicle.location },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <i className={`fas ${item.icon}`} style={{ display: 'block', color: 'var(--accent)', marginBottom: '6px' }}></i>
                <div style={{ fontSize: '.85rem', fontWeight: 600 }}>{item.val}</div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className="pricing-tiers mb-4">
            <div className="pricing-tier"><div className="tier-label">Daily</div><div className="tier-price">{formatPrice(vehicle.priceDaily)}</div></div>
            <div className="pricing-tier"><div className="tier-label">Weekly</div><div className="tier-price">{formatPrice(vehicle.priceWeekly)}</div></div>
            <div className="pricing-tier"><div className="tier-label">Monthly</div><div className="tier-price">{formatPrice(vehicle.priceMonthly)}</div></div>
          </div>

          <h4 style={{ fontSize: '1rem', marginBottom: '10px' }}>About this vehicle</h4>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{vehicle.description || 'No description provided.'}</p>
        </div>
      </div>

      <div className="panel animate-visible" style={{ position: 'sticky', top: '24px' }}>
        <div className="panel-header"><h2>Booking Preference</h2></div>
        <div className="panel-body">
          <div className="form-group">
            <label>Rental Plan</label>
            <select value={bookingForm.durationType}
              onChange={e => setBookingForm({ ...bookingForm, durationType: e.target.value })}>
              <option value="daily">Daily Rental</option>
              <option value="weekly">Weekly Rental (Saves more)</option>
              <option value="monthly">Monthly Rental (Best Value)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Start Date & Time</label>
            <input type="datetime-local" min={getTodayDateTimeStr()} value={bookingForm.startDate}
              onChange={e => setBookingForm({ ...bookingForm, startDate: e.target.value })} />
          </div>
          <div className="form-group">
            <label>End Date & Time</label>
            <input type="datetime-local" value={bookingForm.endDate}
              onChange={e => setBookingForm({ ...bookingForm, endDate: e.target.value })} />
          </div>

          <div style={{ margin: '24px 0', padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '.9rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Total Amount to Pay</div>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-heading)', textShadow: '0 0 15px var(--accent-glow)' }}>
              {formatPrice(estimatedPrice)}
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>*Price inclusive of all taxes.</div>
          </div>

          <button className="btn btn-primary btn-block btn-lg" onClick={onNext} disabled={paying}>
            {paying ? <><i className="fas fa-spinner fa-spin"></i> Initializing...</> : <><i className="fas fa-credit-card"></i> Proceed to Payment</>}
          </button>
          <button className="btn btn-ghost btn-block mt-2" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Payment ── */
function StepPayment({ vehicle, bookingForm, estimatedPrice, onPay, onBack, paying }) {
  const [method, setMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [bank, setBank] = useState('');
  const [errors, setErrors] = useState({});

  const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Bank of Baroda', 'Punjab National Bank', 'Canara Bank'];

  function validate() {
    const e = {};
    if (method === 'upi') {
      if (!upiId.match(/^[\w.\-]+@[\w]+$/)) e.upiId = 'Enter a valid UPI ID (e.g. name@upi)';
    } else if (method === 'card') {
      if (card.number.replace(/\s/g, '').length < 16) e.number = 'Enter a valid 16-digit card number';
      if (!card.name.trim()) e.name = 'Enter name as on card';
      if (!card.expiry.match(/^\d{2}\/\d{2}$/)) e.expiry = 'Enter expiry as MM/YY';
      if (card.cvv.length < 3) e.cvv = 'Enter a valid CVV';
    } else if (method === 'netbanking') {
      if (!bank) e.bank = 'Please select a bank';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handlePay() {
    if (!validate()) return;
    const info = { method, transactionId: generateTxnId() };
    if (method === 'upi') info.detail = upiId;
    else if (method === 'card') info.detail = '**** **** **** ' + card.number.replace(/\s/g, '').slice(-4);
    else info.detail = bank;
    onPay(info);
  }

  const tabSt = (active) => ({
    flex: 1, padding: '12px 8px', textAlign: 'center', cursor: 'pointer',
    fontWeight: 600, fontSize: '.85rem', borderRadius: 'var(--radius-sm)',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#000' : 'var(--text-secondary)',
    border: 'none', transition: 'all .2s',
  });
  const inpSt = (err) => ({
    width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-card)', border: `1px solid ${err ? '#e74c3c' : 'var(--glass-border)'}`,
    color: 'var(--text-primary)', fontSize: '.95rem', outline: 'none',
    marginTop: '6px', boxSizing: 'border-box',
  });
  const errEl = (msg) => msg ? <div style={{ color: '#e74c3c', fontSize: '.75rem', marginTop: '4px' }}>{msg}</div> : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '24px', alignItems: 'start' }}>

      {/* Order Summary */}
      <div className="panel animate-visible">
        <div className="panel-header"><h2>Order Summary</h2></div>
        <div className="panel-body">
          <div style={{ display: 'flex', gap: '18px', alignItems: 'center', padding: '18px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)', marginBottom: '28px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: getVehicleImageUrl(vehicle.image) ? 'var(--bg-card)' : `linear-gradient(135deg, ${vehicle.color || 'var(--accent)'}, #0a0a0a)`, flexShrink: 0, overflow: 'hidden' }}>
              {getVehicleImageUrl(vehicle.image) ? (
                <img src={getVehicleImageUrl(vehicle.image)} alt={vehicle.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <i className={`fas ${vehicle.image || 'fa-car'}`} style={{ fontSize: '1.8rem', color: 'rgba(255,255,255,0.15)' }}></i>
              )}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{vehicle.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{vehicle.brand} · {vehicle.type === '2W' ? '2-Wheeler' : '4-Wheeler'} · {vehicle.fuel}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginTop: '4px' }}><i className="fas fa-map-marker-alt"></i> {vehicle.location}</div>
            </div>
          </div>

          <h4 style={{ marginBottom: '14px', fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Booking Details</h4>
          {[
            { label: 'Rental Plan', val: bookingForm.durationType.charAt(0).toUpperCase() + bookingForm.durationType.slice(1) },
            { label: 'Start Time', val: new Date(bookingForm.startDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
            { label: 'End Time', val: new Date(bookingForm.endDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) },
            { label: 'Payment Mode', val: method === 'upi' ? 'UPI' : method === 'card' ? 'Card' : 'Net Banking' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '.9rem' }}>{r.label}</span>
              <span style={{ fontWeight: 600, fontSize: '.9rem' }}>{r.val}</span>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0 0', marginTop: '8px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Total Amount</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent)', textShadow: '0 0 10px var(--accent-glow)' }}>{formatPrice(estimatedPrice)}</span>
          </div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Inclusive of all taxes &amp; charges</div>

          <div style={{ display: 'flex', gap: '14px', marginTop: '28px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
            {[{ icon: 'fa-shield-alt', label: '100% Secure' }, { icon: 'fa-lock', label: 'SSL Encrypted' }, { icon: 'fa-undo', label: 'Easy Refund' }].map(b => (
              <div key={b.label} style={{ flex: 1, textAlign: 'center' }}>
                <i className={`fas ${b.icon}`} style={{ color: 'var(--accent)', fontSize: '1.2rem', marginBottom: '5px', display: 'block' }}></i>
                <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <div className="panel animate-visible" style={{ position: 'sticky', top: '24px' }}>
        <div className="panel-header">
          <h2><i className="fas fa-credit-card" style={{ marginRight: 8, color: 'var(--accent)' }}></i>Payment</h2>
        </div>
        <div className="panel-body">

          {/* Method Tabs */}
          <div style={{ display: 'flex', gap: '6px', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', marginBottom: '24px' }}>
            {[
              { id: 'upi', icon: 'fa-mobile-alt', label: 'UPI' },
              { id: 'card', icon: 'fa-credit-card', label: 'Card' },
              { id: 'netbanking', icon: 'fa-university', label: 'Net Banking' },
            ].map(t => (
              <button key={t.id} style={tabSt(method === t.id)} onClick={() => { setMethod(t.id); setErrors({}); }}>
                <i className={`fas ${t.icon}`} style={{ marginRight: 5 }}></i>{t.label}
              </button>
            ))}
          </div>

          {/* UPI */}
          {method === 'upi' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <i className="fas fa-mobile-alt" style={{ fontSize: '1.8rem', color: 'var(--accent)' }}></i>
                </div>
                <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>Pay instantly using any UPI app</div>
              </div>
              <div className="form-group">
                <label>UPI ID</label>
                <input style={inpSt(errors.upiId)} type="text" placeholder="yourname@upi"
                  value={upiId} onChange={e => setUpiId(e.target.value)} />
                {errEl(errors.upiId)}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
                {['Google Pay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
                  <span key={app} style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '.74rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>{app}</span>
                ))}
              </div>
            </div>
          )}

          {/* Card */}
          {method === 'card' && (
            <div>
              <div className="form-group">
                <label>Card Number</label>
                <input style={inpSt(errors.number)} type="text" placeholder="1234 5678 9012 3456" maxLength={19}
                  value={card.number} onChange={e => setCard({ ...card, number: fmtCard(e.target.value) })} />
                {errEl(errors.number)}
              </div>
              <div className="form-group">
                <label>Name on Card</label>
                <input style={inpSt(errors.name)} type="text" placeholder="As printed on card"
                  value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} />
                {errEl(errors.name)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Expiry</label>
                  <input style={inpSt(errors.expiry)} type="text" placeholder="MM/YY" maxLength={5}
                    value={card.expiry} onChange={e => setCard({ ...card, expiry: fmtExpiry(e.target.value) })} />
                  {errEl(errors.expiry)}
                </div>
                <div className="form-group">
                  <label>CVV</label>
                  <input style={inpSt(errors.cvv)} type="password" placeholder="•••" maxLength={4}
                    value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').substring(0, 4) })} />
                  {errEl(errors.cvv)}
                </div>
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                <i className="fas fa-lock" style={{ marginRight: 5 }}></i>Your card details are encrypted &amp; never stored.
              </div>
            </div>
          )}

          {/* Net Banking */}
          {method === 'netbanking' && (
            <div>
              <div className="form-group">
                <label>Select Bank</label>
                <select style={{ ...inpSt(errors.bank), marginTop: 6 }}
                  value={bank} onChange={e => setBank(e.target.value)}>
                  <option value="">-- Choose your bank --</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                {errEl(errors.bank)}
              </div>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', marginBottom: '10px', fontSize: '.82rem', color: 'var(--text-secondary)' }}>
                <i className="fas fa-info-circle" style={{ color: 'var(--accent)', marginRight: 7 }}></i>
                You will be redirected to your bank's secure portal to complete payment.
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-block btn-lg" onClick={handlePay} disabled={paying} style={{ marginTop: '8px' }}>
            {paying
              ? <><i className="fas fa-spinner fa-spin"></i> Processing Payment…</>
              : <><i className="fas fa-lock"></i> Pay {formatPrice(estimatedPrice)} Securely</>}
          </button>
          <button className="btn btn-ghost btn-block mt-2" onClick={onBack} disabled={paying}>
            <i className="fas fa-arrow-left"></i> Back to Booking Details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: Success ── */
function StepSuccess({ vehicle, bookingForm, estimatedPrice, txnId, paymentMethod, onGoToDashboard }) {
  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div className="panel animate-visible">
        <div className="panel-body" style={{ textAlign: 'center', padding: '48px 36px' }}>
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: 'linear-gradient(135deg, #00b894, #00cec9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: '0 0 30px rgba(0,184,148,0.4)',
          }}>
            <i className="fas fa-check" style={{ fontSize: '2.5rem', color: '#fff' }}></i>
          </div>

          <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', marginBottom: '8px' }}>Payment Successful!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Your booking has been confirmed. The owner will review and activate your rental.
          </p>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '24px', textAlign: 'left', marginBottom: '28px' }}>
            <div style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '14px' }}>Payment Receipt</div>
            {[
              { label: 'Vehicle', val: vehicle.name },
              { label: 'Rental Period', val: `${new Date(bookingForm.startDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} → ${new Date(bookingForm.endDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}` },
              { label: 'Plan', val: bookingForm.durationType.charAt(0).toUpperCase() + bookingForm.durationType.slice(1) },
              { label: 'Amount Paid', val: formatPrice(estimatedPrice) },
              { label: 'Payment Method', val: paymentMethod === 'upi' ? 'UPI' : paymentMethod === 'card' ? 'Debit / Credit Card' : 'Net Banking' },
              { label: 'Transaction ID', val: txnId },
              { label: 'Status', val: '✅ PAID' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--glass-border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '.88rem' }}>{r.label}</span>
                <span style={{ fontWeight: 600, fontSize: '.88rem', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>{r.val}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary btn-block btn-lg" onClick={onGoToDashboard}>
            <i className="fas fa-tachometer-alt"></i> Go to My Bookings
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function BookVehicle() {
  const { id } = useParams();
  const { currentUser, showToast } = useApp();
  const navigate = useNavigate();

  const [vehicle, setVehicle] = useState(null);
  const [step, setStep] = useState(1);
  const [bookingForm, setBookingForm] = useState({ durationType: 'daily', startDate: getTomorrowDateTimeStr(), endDate: addDaysToDateTime(getTomorrowDateTimeStr(), 3) });
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [paying, setPaying] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'customer') navigate('/login');
  }, [currentUser, navigate]);

  useEffect(() => {
    async function load() {
      try {
        const v = await vehicleAPI.getById(id);
        if (!v || !v.approved || v.status !== 'available') {
          showToast('Vehicle not available for booking.', 'error');
          navigate('/customer'); return;
        }
        setVehicle(v);
      } catch {
        showToast('Vehicle not found.', 'error');
        navigate('/customer');
      }
    }
    load();
  }, [id, navigate, showToast]);

  useEffect(() => {
    if (!bookingForm.startDate) return;
    let days = 1;
    if (bookingForm.durationType === 'weekly') days = 7;
    if (bookingForm.durationType === 'monthly') days = 30;
    const newEnd = addDaysToDateTime(bookingForm.startDate, days);
    setBookingForm(prev => prev.endDate === newEnd ? prev : { ...prev, endDate: newEnd });
  }, [bookingForm.startDate, bookingForm.durationType]);

  useEffect(() => {
    if (vehicle && bookingForm.startDate && bookingForm.endDate) {
      setEstimatedPrice(calculatePrice(vehicle.priceDaily, vehicle.priceWeekly, vehicle.priceMonthly, bookingForm.durationType, bookingForm.startDate, bookingForm.endDate));
    }
  }, [vehicle, bookingForm]);

  async function handleProceedToPayment() {
    if (!bookingForm.startDate || !bookingForm.endDate) { showToast('Please select dates.', 'error'); return; }
    if (new Date(bookingForm.endDate) <= new Date(bookingForm.startDate)) { showToast('End date must be after start date.', 'error'); return; }

    setPaying(true);
    try {
      // 1. Load Razorpay script
      const res = await loadRazorpayScript();
      if (!res) {
        showToast('Razorpay SDK failed to load. Are you online?', 'error');
        setPaying(false);
        return;
      }

      // 2. Create Order in Backend
      const orderData = await paymentAPI.createOrder(estimatedPrice);

      // 3. Open Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'DriveX VRMS',
        description: `Booking for ${vehicle.name}`,
        image: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            // 4. Verify Payment in Backend
            const verification = await paymentAPI.verifyPayment(response);
            if (verification.valid) {
              // 5. Create Booking
              await bookingAPI.create({
                customerId: currentUser.id,
                vehicleId: vehicle.id,
                ownerId: vehicle.ownerId,
                startDate: bookingForm.startDate,
                endDate: bookingForm.endDate,
                durationType: bookingForm.durationType,
                totalPrice: estimatedPrice,
                paymentStatus: 'paid',
                paymentMethod: 'razorpay',
                paymentId: response.razorpay_payment_id,
              });
              setSuccessInfo({ txnId: response.razorpay_payment_id, paymentMethod: 'razorpay' });
              setStep(2); // Confirmation is now step 2
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              showToast('Payment verification failed.', 'error');
            }
          } catch (err) {
            showToast('Error during verification: ' + err.message, 'error');
          } finally {
            setPaying(false);
          }
        },
        prefill: {
          name: currentUser.name,
          email: currentUser.email,
        },
        theme: {
          color: '#00d2ff',
        },
        modal: {
          ondismiss: function () {
            setPaying(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      showToast(err.message || 'Payment initialization failed.', 'error');
      setPaying(false);
    }
  }

  async function handlePay(paymentInfo) {
    // This is now deprecated as we trigger Razorpay from Step 1
  }

  if (!currentUser || !vehicle) return null;

  const STEPS = [{ n: 1, label: 'Booking Details' }, { n: 2, label: 'Confirmation' }];

  return (
    <div className="dashboard-layout">
      <Sidebar navItems={NAV_ITEMS} activeSection="browse" onSectionChange={() => navigate('/customer')} />
      <main className="main-content">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {step < 2 && (
              <button className="btn btn-ghost" onClick={() => navigate('/customer')} style={{ padding: '8px' }}>
                <i className="fas fa-arrow-left" style={{ fontSize: '1.2rem' }}></i>
              </button>
            )}
            <div>
              <h1>{step === 1 ? 'Confirm Your Booking' : 'Booking Confirmed'}</h1>
              <p>{step === 1 ? 'Review details and pick your rental duration.' : 'Your booking is submitted and payment is received.'}</p>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px', maxWidth: '480px' }}>
          {STEPS.map((s, idx) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '.9rem', border: 'none',
                  background: step >= s.n ? 'var(--accent)' : 'var(--bg-card)',
                  color: step >= s.n ? '#000' : 'var(--text-muted)',
                  outline: `2px solid ${step >= s.n ? 'var(--accent)' : 'var(--glass-border)'}`,
                  boxShadow: step === s.n ? '0 0 12px var(--accent-glow)' : 'none',
                  transition: 'all .3s',
                }}>
                  {step > s.n ? <i className="fas fa-check"></i> : s.n}
                </div>
                <div style={{ fontSize: '.72rem', marginTop: '5px', color: step >= s.n ? 'var(--accent)' : 'var(--text-muted)', fontWeight: step === s.n ? 700 : 400, whiteSpace: 'nowrap' }}>{s.label}</div>
              </div>
              {idx < STEPS.length - 1 && (
                <div style={{ flex: 2, height: '2px', background: step > s.n ? 'var(--accent)' : 'var(--glass-border)', marginBottom: '20px', transition: 'background .3s' }}></div>
              )}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && <StepBooking vehicle={vehicle} bookingForm={bookingForm} setBookingForm={setBookingForm} estimatedPrice={estimatedPrice} onNext={handleProceedToPayment} onCancel={() => navigate('/customer')} paying={paying} />}
        {step === 2 && successInfo && <StepSuccess vehicle={vehicle} bookingForm={bookingForm} estimatedPrice={estimatedPrice} txnId={successInfo.txnId} paymentMethod={successInfo.paymentMethod} onGoToDashboard={() => navigate('/customer')} />}
      </main>
    </div>
  );
}
