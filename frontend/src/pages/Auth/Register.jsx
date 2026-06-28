import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

const STATE_CODES = {
  "Rajasthan": "08",
  "Delhi": "07",
  "Maharashtra": "27",
  "Gujarat": "24",
  "Uttar Pradesh": "09",
  "Haryana": "06",
  "Punjab": "03",
  "Madhya Pradesh": "23",
  "Karnataka": "29",
  "Tamil Nadu": "33",
  "West Bengal": "19",
  "Andhra Pradesh": "37",
  "Telangana": "36",
  "Bihar": "10",
  "Chhattisgarh": "22",
  "Jharkhand": "20",
  "Odisha": "21",
  "Kerala": "32",
  "Assam": "18",
  "Uttarakhand": "05",
  "Himachal Pradesh": "02",
  "Jammu and Kashmir": "01",
  "Goa": "30",
  "Chandigarh": "04",
  "Puducherry": "34",
  "Tripura": "16",
  "Meghalaya": "17",
  "Manipur": "14",
  "Nagaland": "13",
  "Mizoram": "15",
  "Arunachal Pradesh": "12",
  "Sikkim": "11",
  "Dadra and Nagar Haveli": "26",
  "Daman and Diu": "25",
  "Lakshadweep": "31",
  "Andaman and Nicobar Islands": "35",
  "Ladakh": "38",
  "Other Territory": "97"
};

const Register = () => {
  const navigate = useNavigate();
  const { register, user } = useAuth();

  const [step, setStep] = useState(1);

  // Step 1: User Credentials
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: Business / Firm Details
  const [firmName, setFirmName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('Rajasthan');
  const [stateCode, setStateCode] = useState('08');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleStateChange = (selectedState) => {
    setState(selectedState);
    setStateCode(STATE_CODES[selectedState] || '');
    
    if (selectedState && STATE_CODES[selectedState]) {
      const prefix = STATE_CODES[selectedState];
      if (!gstin || gstin.length <= 2) {
        setGstin(prefix);
      }
    }
  };

  const handleNextStep = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Full Name is required.');
      return;
    }
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.get(`/auth/check-username?username=${encodeURIComponent(username.trim())}`);
      if (!res.data.available) {
        setError('Username is already taken');
        return;
      }
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to verify username availability.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!firmName.trim()) {
      setError('Firm Name is required.');
      return;
    }
    if (!address.trim()) {
      setError('Business Address is required.');
      return;
    }

    if (gstin && gstin.trim() !== '') {
      const gstinVal = gstin.trim().toUpperCase();
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(gstinVal)) {
        setError('Please enter a valid 15-digit GSTIN.');
        return;
      }
      if (gstinVal.substring(0, 2) !== stateCode) {
        setError(`GSTIN must match the selected state code prefix (${stateCode}).`);
        return;
      }
    }

    if (phone && phone.trim() !== '') {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone.trim())) {
        setError('Phone number must be strictly 10 digits.');
        return;
      }
    }

    setLoading(true);
    try {
      const registrationData = {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password,
        firmName: firmName.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
        gstin: gstin.trim().toUpperCase(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        state,
        stateCode
      };

      await register(registrationData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reg-container">
      <style>{`
        .reg-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-primary);
          padding: 40px 20px;
          font-family: 'Inter', sans-serif;
          box-sizing: border-box;
        }

        .reg-card {
          width: 100%;
          max-width: 520px;
          background-color: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 40px;
          box-shadow: var(--shadow-lg);
          box-sizing: border-box;
          animation: regFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes regFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .reg-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .reg-title {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 6px 0;
        }

        .reg-subtitle {
          color: var(--text-muted);
          font-size: 14px;
          margin: 0;
        }

        /* Progress Steps */
        .step-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          position: relative;
        }

        .step-bar-line {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--border);
          z-index: 1;
          transform: translateY(-50%);
        }

        .step-bar-progress {
          position: absolute;
          top: 50%;
          left: 0;
          height: 2px;
          background: var(--accent-primary);
          z-index: 1;
          transform: translateY(-50%);
          transition: width 0.3s ease;
        }

        .step-node {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--bg-primary);
          border: 2px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          color: var(--text-muted);
          z-index: 2;
          transition: all 0.3s ease;
        }

        .step-node.active {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: #ffffff;
          box-shadow: 0 0 12px var(--accent-primary-glow);
        }

        .step-node.completed {
          background: var(--accent-secondary);
          border-color: var(--accent-secondary);
          color: #ffffff;
          box-shadow: 0 0 12px var(--accent-primary-glow);
        }

        /* Form Controls */
        .input-group {
          position: relative;
          margin-bottom: 20px;
        }

        .input-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .input-wrapper {
          position: relative;
        }

        .input-field {
          width: 100%;
          padding: 13px 16px;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 15px;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .input-field:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px var(--accent-primary-glow);
        }

        .input-field::placeholder {
          color: var(--text-muted);
          opacity: 0.6;
        }

        .input-select {
          width: 100%;
          padding: 13px 36px 13px 16px;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 15px;
          transition: all 0.2s ease;
          box-sizing: border-box;
          appearance: none;
          cursor: pointer;
        }

        .input-select:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px var(--accent-primary-glow);
        }

        .select-arrow {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
          font-size: 12px;
        }

        .input-textarea {
          width: 100%;
          padding: 13px 16px;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 15px;
          transition: all 0.2s ease;
          box-sizing: border-box;
          font-family: inherit;
          resize: none;
        }

        .input-textarea:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px var(--accent-primary-glow);
        }

        /* Error Banner */
        .err-banner {
          background: var(--danger-dim);
          border: 1px solid rgba(220, 38, 38, 0.2);
          color: var(--danger);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 14px;
          margin-bottom: 24px;
          text-align: center;
        }

        /* Buttons styling */
        .btn-row {
          display: flex;
          gap: 12px;
          margin-top: 28px;
        }

        .submit-btn {
          flex: 1;
          background-color: var(--accent-primary);
          color: #ffffff;
          border: none;
          padding: 14px;
          border-radius: var(--radius-md);
          font-size: 16px;
          font-weight: 650;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .submit-btn:hover:not(:disabled) {
          background-color: var(--accent-secondary);
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .back-btn {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border);
          padding: 14px 24px;
          border-radius: var(--radius-md);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .back-btn:hover {
          background: var(--bg-primary);
        }

        .reg-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 14px;
          color: var(--text-muted);
        }

        .reg-footer a {
          color: var(--accent-primary);
          text-decoration: none;
          font-weight: 600;
        }

        .reg-footer a:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="reg-card">
        <div className="reg-header">
          <h1 className="reg-title">BizLedger Setup</h1>
          <p className="reg-subtitle">
            {step === 1 ? 'Step 1: Create your admin account' : 'Step 2: Initialize your business profile'}
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="step-bar">
          <div className="step-bar-line" />
          <div className="step-bar-progress" style={{ width: step === 1 ? '0%' : '100%' }} />
          <div className={`step-node ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>1</div>
          <div className={`step-node ${step === 2 ? 'active' : ''}`}>2</div>
        </div>

        {error && <div className="err-banner">{error}</div>}

        {/* STEP 1: Account Credentials */}
        {step === 1 && (
          <form onSubmit={handleNextStep}>
            <div className="input-group">
              <label>Full Name</label>
              <div className="input-wrapper">
                <input
                  className="input-field"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="input-group">
              <label>Username</label>
              <div className="input-wrapper">
                <input
                  className="input-field"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <input
                  className="input-field"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                Must be at least 6 characters
              </span>
            </div>

            <button type="submit" className="submit-btn" style={{ width: '100%', marginTop: '12px' }}>
              Continue to Business Setup
            </button>
          </form>
        )}

        {/* STEP 2: Business details */}
        {step === 2 && (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Firm Name *</label>
              <div className="input-wrapper">
                <input
                  className="input-field"
                  type="text"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="My Business"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="input-group" style={{ flex: 1.5 }}>
                <label>State *</label>
                <div className="input-wrapper">
                  <select
                    className="input-select"
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                  >
                    {Object.keys(STATE_CODES).sort().map(s => (
                      <option key={s} value={s} style={{ color: 'var(--text-primary)' }}>{s}</option>
                    ))}
                  </select>
                  <span className="select-arrow">▼</span>
                </div>
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>State Code</label>
                <div className="input-wrapper">
                  <input
                    className="input-field"
                    type="text"
                    value={stateCode}
                    disabled
                    style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}
                  />
                </div>
              </div>
            </div>

            <div className="input-group">
              <label>GSTIN Number</label>
              <div className="input-wrapper">
                <input
                  className="input-field"
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="15-digit GSTIN (optional)"
                  maxLength={15}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="input-group" style={{ flex: 1.2 }}>
                <label>Phone Number</label>
                <div className="input-wrapper">
                  <input
                    className="input-field"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    maxLength={10}
                  />
                </div>
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Pincode</label>
                <div className="input-wrapper">
                  <input
                    className="input-field"
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="6-digit ZIP"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <div className="input-wrapper">
                <input
                  className="input-field"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="business@example.com"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Business Address *</label>
              <div className="input-wrapper">
                <textarea
                  className="input-textarea"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full business address details..."
                  required
                  rows={2}
                  style={{ height: '70px', paddingTop: '10px' }}
                />
              </div>
            </div>

            <div className="btn-row">
              <button type="button" className="back-btn" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Setting up...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        )}

        <div className="reg-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
