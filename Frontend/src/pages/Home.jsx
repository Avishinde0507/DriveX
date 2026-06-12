import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { vehicleAPI, reviewAPI } from '../services/api';
import { formatPrice, getVehicleImageUrl } from '../utils/helpers';

function VehiclePreviewCard({ v }) {
  const fuelIcon = v.fuel === 'Electric' ? 'fa-charging-station' : 'fa-gas-pump';
  const tagClass = v.type === '2W' ? 'eco' : (v.priceDaily >= 3000 ? 'premium' : '');
  return (
    <div className="vehicle-card glass-card">
      <div className="vehicle-img" style={{ background: v.priceDaily >= 3000 ? 'linear-gradient(135deg, var(--accent-danger), #0a0a0a)' : `linear-gradient(135deg, ${v.color || 'var(--accent)'}, #0a0a0a)` }}>
        <span className={`vehicle-badge-tag ${tagClass}`}>{v.type === '2W' ? '2-Wheeler' : '4-Wheeler'}</span>
        {getVehicleImageUrl(v.image) ? (
          <img src={getVehicleImageUrl(v.image)} alt={v.name} className="vehicle-card-image" />
        ) : (
          <div className="vehicle-icon" style={{ color: 'rgba(255, 255, 255, 0.06)', textShadow: v.priceDaily >= 3000 ? '0 0 20px rgba(205,0,0,0.4)' : '0 0 15px var(--accent-glow)' }}>
            <i className={`fas ${v.image || 'fa-car'}`}></i>
          </div>
        )}
      </div>
      <div className="vehicle-info">
        <div className="vehicle-header">
          <h3>{v.name}</h3>
          <span className="vehicle-type-tag">{v.brand}</span>
        </div>
        <div className="vehicle-specs">
          <span><i className={`fas ${fuelIcon}`}></i> {v.fuel}</span>
          <span><i className="fas fa-cog"></i> {v.transmission}</span>
          <span><i className="fas fa-user-friends"></i> {v.seats} Seats</span>
        </div>
        <div className="pricing-tiers">
          <div className="pricing-tier"><div className="tier-label">Daily</div><div className="tier-price">{formatPrice(v.priceDaily)}</div></div>
          <div className="pricing-tier"><div className="tier-label">Weekly</div><div className="tier-price">{formatPrice(v.priceWeekly)}</div></div>
          <div className="pricing-tier"><div className="tier-label">Monthly</div><div className="tier-price">{formatPrice(v.priceMonthly)}</div></div>
        </div>
        <div className="vehicle-footer mt-2">
          <div className="price">{formatPrice(v.priceDaily)} <small>/ day</small></div>
        </div>
      </div>
    </div>
  );
}


const FEATURED_VEHICLES = [
  { id: 'f1', name: 'Royal Enfield Classic 350', brand: 'ROYAL ENFIELD', type: '2W', fuel: 'Petrol', transmission: 'Manual', seats: 2, priceDaily: 900, priceWeekly: 5000, priceMonthly: 17000, image: 'fa-motorcycle', color: '#3b3b5e' },
  { id: 'f2', name: 'Maruti Swift', brand: 'MARUTI SUZUKI', type: '4W', fuel: 'Petrol', transmission: 'Manual', seats: 5, priceDaily: 1800, priceWeekly: 10000, priceMonthly: 35000, image: 'fa-car', color: '#6e3a3a' },
  { id: 'f3', name: 'Ola S1 Pro', brand: 'OLA ELECTRIC', type: '2W', fuel: 'Electric', transmission: 'Automatic', seats: 2, priceDaily: 500, priceWeekly: 2800, priceMonthly: 9000, image: 'fa-motorcycle', color: '#004d40' },
  { id: 'f4', name: 'Tata Nexon EV', brand: 'TATA MOTORS', type: '4W', fuel: 'Electric', transmission: 'Automatic', seats: 5, priceDaily: 2500, priceWeekly: 14000, priceMonthly: 48000, image: 'fa-car', color: '#003d33' },
  { id: 'f5', name: 'Mahindra Thar', brand: 'MAHINDRA', type: '4W', fuel: 'Diesel', transmission: 'Manual', seats: 4, priceDaily: 3500, priceWeekly: 19000, priceMonthly: 65000, image: 'fa-truck-monster', color: '#d63031' },
  { id: 'f6', name: 'Yamaha R15 V4', brand: 'YAMAHA', type: '2W', fuel: 'Petrol', transmission: 'Manual', seats: 2, priceDaily: 1200, priceWeekly: 7000, priceMonthly: 25000, image: 'fa-motorcycle', color: '#2980b9' },
];

const FALLBACK_TESTIMONIALS = [
  {
    id: 't1',
    userId: { name: 'Aarav Sharma', email: 'aarav@example.com', profileImage: '' },
    vehicleId: { name: 'Royal Enfield Classic 350', brand: 'ROYAL ENFIELD' },
    rating: 5,
    feedback: 'Absolutely loved the Royal Enfield! It was clean, ran perfectly, and the pickup process was seamless. Highly recommend DriveX!',
    createdAt: '2026-05-15T12:00:00Z'
  },
  {
    id: 't2',
    userId: { name: 'Priya Patel', email: 'priya@example.com', profileImage: '' },
    vehicleId: { name: 'Tata Nexon EV', brand: 'TATA MOTORS' },
    rating: 5,
    feedback: 'Renting the Nexon EV was the best decision. Zero emissions, super quiet ride, and very affordable weekly rates. Exceptional service.',
    createdAt: '2026-05-20T14:30:00Z'
  },
  {
    id: 't3',
    userId: { name: 'Rohan Verma', email: 'rohan@example.com', profileImage: '' },
    vehicleId: { name: 'Mahindra Thar', brand: 'MAHINDRA' },
    rating: 4,
    feedback: 'Had an amazing weekend trip with the Thar. Power-packed performance and the vehicle was in pristine condition. Will rent again!',
    createdAt: '2026-05-28T09:15:00Z'
  }
];

function TestimonialsSection({ testimonials }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!testimonials || testimonials.length === 0) return null;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="section testimonials-section" id="testimonials" style={{ background: 'rgba(10, 10, 10, 0.15)', position: 'relative', overflow: 'hidden' }}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Testimonials</span>
          <h2>What Our <span className="gradient-text">Riders Say</span></h2>
          <p>Real experiences from verified DriveX customers.</p>
        </div>

        <div className="testimonials-carousel" style={{ position: 'relative', maxWidth: '850px', margin: '0 auto', padding: '0 48px' }}>
          <button
            onClick={handlePrev}
            className="carousel-btn prev"
            style={{
              position: 'absolute',
              left: '0',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
              color: 'var(--accent)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fas fa-chevron-left"></i>
          </button>

          <div className="testimonial-slide-wrapper" style={{ overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                transition: 'transform 0.4s ease-in-out',
                transform: `translateX(-${activeIndex * 100}%)`
              }}
            >
              {testimonials.map((t) => (
                <div
                  key={t.id || t._id}
                  style={{
                    minWidth: '100%',
                    boxSizing: 'border-box',
                    padding: '8px'
                  }}
                >
                  <div className="glass-card testimonial-card" style={{
                    padding: '30px',
                    borderRadius: '12px',
                    position: 'relative',
                    textAlign: 'center',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--bg-card)'
                  }}>
                    <i className="fas fa-quote-left" style={{
                      position: 'absolute',
                      top: '20px',
                      left: '24px',
                      fontSize: '2.5rem',
                      opacity: 0.05,
                      color: 'var(--accent)'
                    }}></i>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: 'linear-gradient(135deg, var(--accent), #f0580c)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1.4rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        border: '2px solid var(--glass-border)'
                      }}>
                        {t.userId?.profileImage ? (
                          <img src={t.userId.profileImage} alt={t.userId.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          t.userId?.name ? t.userId.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'
                        )}
                      </div>
                    </div>

                    <h4 style={{ fontSize: '1.1rem', marginBottom: '4px', color: 'var(--text-primary)' }}>{t.userId?.name || 'Happy Rider'}</h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Rented: {t.vehicleId?.brand} {t.vehicleId?.name}
                    </div>

                    <div style={{ color: 'var(--warning)', marginBottom: '16px', letterSpacing: '2px', fontSize: '0.85rem' }}>
                      {'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}
                    </div>

                    <p style={{
                      fontSize: '0.95rem',
                      lineHeight: '1.5',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      maxWidth: '580px',
                      margin: '0 auto 16px auto'
                    }}>
                      "{t.feedback}"
                    </p>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(t.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleNext}
            className="carousel-btn next"
            style={{
              position: 'absolute',
              right: '0',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
              color: 'var(--accent)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              style={{
                width: activeIndex === index ? '18px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: activeIndex === index ? 'var(--accent)' : 'var(--glass-border)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { currentUser, theme, toggleTheme } = useApp();
  const [vehicles, setVehicles] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const list = await vehicleAPI.getAvailable() || [];
        // Combine API list with featured vehicles, avoiding name duplicates
        let displayList = [...list];

        // Always ensure we show at least 6 to fulfill the "add 2 more" request
        if (displayList.length < 6) {
          const needed = 6 - displayList.length;
          const additional = FEATURED_VEHICLES.filter(fv =>
            !displayList.some(v => v.name.toLowerCase() === fv.name.toLowerCase())
          ).slice(0, needed);
          displayList = [...displayList, ...additional];
        }

        setVehicles(displayList.slice(0, 6));
      } catch {
        setVehicles(FEATURED_VEHICLES);
      }
    }
    load();

    async function loadTestimonials() {
      try {
        const res = await reviewAPI.getTestimonials();
        if (res.success && res.testimonials && res.testimonials.length > 0) {
          setTestimonials(res.testimonials);
        } else {
          setTestimonials(FALLBACK_TESTIMONIALS);
        }
      } catch (err) {
        console.error('Failed to load testimonials', err);
        setTestimonials(FALLBACK_TESTIMONIALS);
      }
    }
    loadTestimonials();
    const onScroll = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);

    // Scroll Reveal Observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  const dashMap = { customer: '/customer', owner: '/owner', admin: '/admin' };
  const dashLink = currentUser ? (dashMap[currentUser.role] || '/customer') : '/login';

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileNavOpen(false);
  };

  return (
    <>
      {/* NAVBAR */}
      <nav className={`navbar ${navScrolled ? 'scrolled' : ''}`} id="navbar">
        <div className="container nav-container">
          <Link to="/" className="logo"><img src="/DriveX-logo.png" alt="DriveX Logo" style={{ height: '70px', objectFit: 'contain' }} /></Link>
          <ul className={`nav-links ${mobileNavOpen ? 'open' : ''}`}>
            <li><a href="#hero" onClick={(e) => { e.preventDefault(); scrollTo('hero'); }}>Home</a></li>
            <li><a href="#about" onClick={(e) => { e.preventDefault(); scrollTo('about'); }}>About</a></li>
            <li><a href="#fleet" onClick={(e) => { e.preventDefault(); scrollTo('fleet'); }}>Vehicles</a></li>
            <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a></li>
            <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
            <li><a href="#testimonials" onClick={(e) => { e.preventDefault(); scrollTo('testimonials'); }}>Testimonials</a></li>
            <li><a href="#contact" onClick={(e) => { e.preventDefault(); scrollTo('contact'); }}>Contact</a></li>
          </ul>

          <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
                fontSize: '1.1rem'
              }}
            >
              <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>

            <Link to={dashLink} className="btn btn-primary btn-sm">
              <i className={`fas ${currentUser ? 'fa-tachometer-alt' : 'fa-sign-in-alt'}`}></i>
              <span className="d-none d-sm-inline">{currentUser ? 'Dashboard' : 'Login'}</span>
            </Link>

            <button className={`nav-toggle ${mobileNavOpen ? 'active' : ''}`} onClick={() => setMobileNavOpen(!mobileNavOpen)}>
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero" id="hero">
        <div className="hero-bg-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
        <div className="container hero-content">
          <div className="hero-text">
            <span className="hero-badge animate-visible">🏍️ 2-Wheelers &amp; 🚗 4-Wheelers</span>
            <h1 className="animate-visible">Rent Your <span className="gradient-text">Perfect Ride</span> Anytime</h1>
            <p className="animate-visible">From scooters to SUVs — browse our vehicles, pick your dates, and drive away. Daily, weekly, or monthly rentals at the best prices.</p>
            <div className="hero-cta animate-visible">
              <Link to={dashLink} className="btn btn-primary btn-lg">Get Started <i className="fas fa-arrow-right"></i></Link>
              <a href="#how-it-works" className="btn btn-outline btn-lg" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a>
            </div>
            <div className="hero-stats-row animate-visible">
              <div className="hero-stat"><strong>500+</strong><span>Vehicles</span></div>
              <div className="hero-stat"><strong>50+</strong><span>Locations</span></div>
              <div className="hero-stat"><strong>25K+</strong><span>Happy Riders</span></div>
            </div>
          </div>
          <div className="hero-visual animate-visible">
            <div className="hero-card glass-card">
              <h3><i className="fas fa-search-location"></i> Quick Search</h3>
              <div className="form-group">
                <label>Location</label>
                <div className="input-icon"><i className="fas fa-map-marker-alt"></i><input type="text" placeholder="City name" defaultValue="Mumbai" /></div>
              </div>
              <div className="form-group">
                <label>Vehicle Type</label>
                <div className="input-icon"><i className="fas fa-motorcycle"></i>
                  <select><option value="">All Types</option><option value="2W">2-Wheeler</option><option value="4W">4-Wheeler</option></select>
                </div>
              </div>
              <div className="form-group">
                <label>Rental Plan</label>
                <div className="input-icon"><i className="fas fa-clock"></i>
                  <select><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
                </div>
              </div>
              <Link to="/login" className="btn btn-primary btn-block"><i className="fas fa-search"></i> Browse Vehicles</Link>
            </div>
          </div>
        </div>
      </header>

      {/* ABOUT SECTION */}
      <section className="section about-section reveal-on-scroll" id="about">
        <div className="container">
          <div className="about-grid">
            <div className="about-content">
              <span className="section-badge">Who We Are</span>
              <h2>Empowering <span className="gradient-text">Agencies</span>,  Make Passengers <span className="gradient-text">Happy</span></h2>
              <p className="lead">DriveX is an innovative system aimed at transforming vehicle rental processes and Vehicle management operations with a new generation VRMS system.</p>

              <div className="about-features">
                <div className="about-feature">
                  <div className="af-icon"><i className="fas fa-car-side"></i></div>
                  <div className="af-text">
                    <h4>Wide Range of Vehicles</h4>
                    <p>Starting from green electric scooters suitable for city commuting, to comfortable SUVs that will make your vacation pleasant for your entire family – DriveX provides numerous options of 2W and 4W vehicles..</p>
                  </div>
                </div>
                <div className="about-feature">
                  <div className="af-icon"><i className="fas fa-handshake"></i></div>
                  <div className="af-text">
                    <h4>Empowering Local Agencies</h4>
                    <p>We provide rental agencies with professional digital tools to manage their inventory, track bookings, and grow their reach without the overhead of building their own tech.</p>
                  </div>
                </div>
              </div>

              <div className="about-stats mt-4">
                <div className="as-item"><strong>100%</strong><span>Digital Flow</span></div>
                <div className="as-item"><strong>Verified</strong><span>Partners</span></div>
                <div className="as-item"><strong>24/7</strong><span>Support</span></div>
              </div>
            </div>
            <div className="about-visual">
              <div className="about-image-container glass-card">
                <div className="floating-info card-1"><i className="fas fa-check-circle"></i> Best Rates</div>
                <div className="floating-info card-2"><i className="fas fa-shield-alt"></i> Fully Insured</div>
                <div className="agency-visual">
                  <i className="fas fa-building building-icon"></i>
                  <i className="fas fa-user-circle user-icon"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FLEET PREVIEW */}
      <section className="section fleet-section reveal-on-scroll" id="fleet">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Our Vehicles</span>
            <h2>Popular <span className="gradient-text">Vehicles</span></h2>
            <p>A preview of our most popular two-wheelers and four-wheelers.</p>
          </div>
          <div className="fleet-grid">
            {vehicles.map(v => <VehiclePreviewCard key={v.id} v={v} />)}
          </div>
          <div className="text-center mt-4">
            <Link to="/login" className="btn btn-outline btn-lg">View All Vehicles <i className="fas fa-arrow-right"></i></Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section reveal-on-scroll" id="how-it-works">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Simple Process</span>
            <h2>How It <span className="gradient-text">Works</span></h2>
            <p>Get on the road in just three easy steps.</p>
          </div>
          <div className="steps-grid">
            <div className="step-card glass-card">
              <div className="step-number">01</div>
              <div className="step-icon"><i className="fas fa-user-plus"></i></div>
              <h3>Register &amp; Login</h3>
              <p>Create your free account. Choose your role — Customer, Rental Agency, or Admin.</p>
            </div>
            <div className="step-connector"><i className="fas fa-chevron-right"></i></div>
            <div className="step-card glass-card">
              <div className="step-number">02</div>
              <div className="step-icon"><i className="fas fa-search"></i></div>
              <h3>Search &amp; Filter</h3>
              <p>Browse vehicles by type (2W/4W), fuel, price range, and location. Pick your rental plan.</p>
            </div>
            <div className="step-connector"><i className="fas fa-chevron-right"></i></div>
            <div className="step-card glass-card">
              <div className="step-number">03</div>
              <div className="step-icon"><i className="fas fa-calendar-check"></i></div>
              <h3>Book &amp; Drive</h3>
              <p>Select your dates, confirm the booking, and pick up the vehicle. Enjoy your ride!</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section features-section reveal-on-scroll" id="features">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Why DriveX</span>
            <h2>Features That <span className="gradient-text">Set Us Apart</span></h2>
            <p>A complete rental management solution for customers and agencies.</p>
          </div>
          <div className="features-grid">
            {[
              { icon: 'fa-motorcycle', title: '2W & 4W Rentals', desc: 'Rent scooters, bikes, sedans, SUVs, and more — all in one platform.' },
              { icon: 'fa-calendar-alt', title: 'Flexible Plans', desc: 'Daily, weekly, or monthly — choose a rental plan that fits your needs.' },
              { icon: 'fa-tachometer-alt', title: 'Real-Time Availability', desc: 'Live vehicle availability tracking with zero booking conflicts.' },
              { icon: 'fa-shield-alt', title: 'Secure Auth & RBAC', desc: 'Role-based access control — separate dashboards for customers, owners, and admins.' },
              { icon: 'fa-chart-bar', title: 'Agency Dashboard', desc: 'Vehicle management, booking approvals, maintenance scheduling — all in one place.' },
              { icon: 'fa-chart-pie', title: 'Admin Analytics', desc: 'KPIs, utilization rates, booking trends, and system-wide monitoring.' },
            ].map((f, i) => (
              <div key={i} className="feature-card glass-card">
                <div className="feature-icon"><i className={`fas ${f.icon}`}></i></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <TestimonialsSection testimonials={testimonials} />

      {/* CTA */}
      <section className="section cta-section">
        <div className="container">
          <div className="cta-card glass-card">
            <div className="cta-content">
              <h2>Ready to Hit the Road?</h2>
              <p>Join as a customer to book vehicles, or as a rental agency to manage your vehicles digitally.</p>
              <div className="cta-buttons">
                <Link to="/login" className="btn btn-primary btn-lg">Get Started <i className="fas fa-arrow-right"></i></Link>
                <a href="#how-it-works" className="btn btn-outline btn-lg" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>Learn More</a>
              </div>
            </div>
            <div className="cta-visual"><i className="fas fa-car-side"></i></div>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section className="section contact-section reveal-on-scroll" id="contact">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Get In Touch</span>
            <h2>Contact <span className="gradient-text">Us</span></h2>
            <p>Have questions? We're here to help you get on the road.</p>
          </div>
          <div className="contact-grid">
            <div className="contact-info-card glass-card">
              <h3>Contact Information</h3>
              <p>Reach out to us through any of these channels.</p>
              <div className="info-item">
                <div className="info-icon"><i className="fas fa-map-marker-alt"></i></div>
                <div className="info-text">
                  <strong>Location</strong>
                  <span>123 MG Road, Mumbai 400001</span>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon"><i className="fas fa-phone-alt"></i></div>
                <div className="info-text">
                  <strong>Phone</strong>
                  <span>+91 12345 67890</span>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon"><i className="fas fa-envelope"></i></div>
                <div className="info-text">
                  <strong>Email</strong>
                  <span>hello@drivex.in</span>
                </div>
              </div>
            </div>
            <div className="contact-form-card glass-card">
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" placeholder="John Doe" required />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" placeholder="john@example.com" required />
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <textarea placeholder="How can we help you?" style={{ minHeight: '120px' }}></textarea>
                </div>
                <button type="submit" className="btn btn-primary btn-block btn-lg">Send Message <i className="fas fa-paper-plane"></i></button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link to="/" className="logo"><img src="/DriveX-logo.png" alt="DriveX Logo" style={{ height: '70px', objectFit: 'contain' }} /></Link>
              <p>Vehicle Rental Management System — rent 2-wheelers and 4-wheelers with ease.</p>
              <div className="social-links">
                <a href="#social"><i className="fab fa-facebook-f"></i></a>
                <a href="#social"><i className="fab fa-twitter"></i></a>
                <a href="#social"><i className="fab fa-instagram"></i></a>
                <a href="#social"><i className="fab fa-linkedin-in"></i></a>
              </div>
            </div>
            <div className="footer-col"><h4>Quick Links</h4><ul>
              <li><a href="#hero" onClick={(e) => { e.preventDefault(); scrollTo('hero'); }}>Home</a></li>
              <li><a href="#about" onClick={(e) => { e.preventDefault(); scrollTo('about'); }}>About DriveX</a></li>
              <li><a href="#fleet" onClick={(e) => { e.preventDefault(); scrollTo('fleet'); }}>Our Vehicles</a></li>
              <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a></li>
              <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
              <li><a href="#testimonials" onClick={(e) => { e.preventDefault(); scrollTo('testimonials'); }}>Testimonials</a></li>
              <li><a href="#contact" onClick={(e) => { e.preventDefault(); scrollTo('contact'); }}>Contact Us</a></li>
              <li><Link to="/login">Login</Link></li>
            </ul></div>
            <div className="footer-col"><h4>Vehicle Types</h4><ul>
              <li><a href="#fleet" onClick={(e) => { e.preventDefault(); scrollTo('fleet'); }}>Scooters</a></li>
              <li><a href="#fleet" onClick={(e) => { e.preventDefault(); scrollTo('fleet'); }}>Motorcycles</a></li>
              <li><a href="#fleet" onClick={(e) => { e.preventDefault(); scrollTo('fleet'); }}>Sedans</a></li>
              <li><a href="#fleet" onClick={(e) => { e.preventDefault(); scrollTo('fleet'); }}>SUVs</a></li>
              <li><a href="#fleet" onClick={(e) => { e.preventDefault(); scrollTo('fleet'); }}>Electric Vehicles</a></li>
            </ul></div>
            <div className="footer-col"><h4>Contact</h4><ul className="contact-list">
              <li><i className="fas fa-map-marker-alt"></i> 123 MG Road, Mumbai 400001</li>
              <li><i className="fas fa-phone-alt"></i> +91 12345 67890</li>
              <li><i className="fas fa-envelope"></i> hello@drivex.in</li>
            </ul></div>
          </div>
          <div className="footer-bottom"><p>&copy; 2026 DriveX VRMS. All rights reserved.</p></div>
        </div>
      </footer>
    </>
  );
}
