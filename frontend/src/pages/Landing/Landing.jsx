import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Landing.css';

const Landing = () => {
  const { user, activeFirmId } = useAuth();

  // If user is already logged in, redirect them to their dashboard or firm selection
  if (user) {
    if (activeFirmId) {
      return <Navigate to="/dashboard" />;
    } else {
      return <Navigate to="/select-firm" />;
    }
  }

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="container nav-container">
          <div className="nav-logo">
            <div className="logo-icon">B</div>
            <div className="logo-text">
              <span className="logo-name">BizManager</span>
            </div>
          </div>
          <div className="nav-actions">
            <Link to="/login" className="nav-link">Sign In</Link>
            <Link to="/register" className="nav-btn">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="container hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Smart GST Billing &amp; <span className="text-highlight">Business Management</span>
            </h1>
            <p className="hero-subtitle">
              The ultimate software for Indian businesses. Create GST-compliant invoices, track inventory, manage multiple firms, and generate instant tax reports in one beautiful dashboard.
            </p>
            <div className="hero-buttons">
              <Link to="/register" className="btn-primary-large">Start for Free</Link>
              <Link to="/login" className="btn-outline-large">Log into your account</Link>
            </div>
            <div className="hero-trust">
              <span>✓ No credit card required</span>
              <span>✓ Setup in 2 minutes</span>
              <span>✓ Fully GST Compliant</span>
            </div>
          </div>
          <div className="hero-image-wrapper">
            {/* We'll just use a CSS-styled placeholder that looks like a dashboard wireframe */}
            <div className="dashboard-mockup">
              <div className="mockup-header">
                <div className="mockup-dots"><span></span><span></span><span></span></div>
              </div>
              <div className="mockup-body">
                <div className="mockup-sidebar"></div>
                <div className="mockup-main">
                  <div className="mockup-card-row">
                    <div className="mockup-card"></div>
                    <div className="mockup-card"></div>
                    <div className="mockup-card"></div>
                  </div>
                  <div className="mockup-table"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Everything you need to run your business</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🧾</div>
              <h3>GST Invoicing</h3>
              <p>Generate professional, GST-compliant tax invoices in seconds. Automatic CGST, SGST, and IGST calculations.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📦</div>
              <h3>Inventory Tracking</h3>
              <p>Real-time stock reports. Automatically deduct stock on sales and increase on purchases.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🏢</div>
              <h3>Multi-Firm Support</h3>
              <p>Manage multiple businesses or branches under a single login with strict data isolation.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Instant Reports</h3>
              <p>Get ready-to-file GST reports, stock details, and business analytics at the click of a button.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container footer-container">
          <div className="footer-brand">
            <div className="logo-icon-small">B</div>
            <span>BizManager Suite</span>
          </div>
          <div className="footer-copyright">
            &copy; {new Date().getFullYear()} BizManager. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
