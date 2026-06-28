import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout/Layout';
import Toast, { useToast } from '../../components/UI/Toast';

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

export default function Profile() {
  const { user, activeFirm, updateUserProfile, updateActiveFirm, logout } = useAuth();
  const { toast, show } = useToast();
  const navigate = useNavigate();

  // User Profile States
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Firm Profile States
  const [firmName, setFirmName] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('');
  const [stateCode, setStateCode] = useState('');

  const [savingUser, setSavingUser] = useState(false);
  const [savingFirm, setSavingFirm] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
    }
    if (activeFirm) {
      setFirmName(activeFirm.name || '');
      setAddress(activeFirm.address || '');
      setPincode(activeFirm.pincode || '');
      setGstin(activeFirm.gstin || '');
      setPhone(activeFirm.phone || '');
      setEmail(activeFirm.email || '');
      setState(activeFirm.state || 'Rajasthan');
      setStateCode(activeFirm.stateCode || '08');
    }
  }, [user, activeFirm]);

  const handleStateChange = (selectedState) => {
    setState(selectedState);
    setStateCode(STATE_CODES[selectedState] || '');
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      show('Name and Username are required.', 'error');
      return;
    }
    
    setSavingUser(true);
    try {
      await updateUserProfile({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        password: password ? password : undefined
      });
      setPassword('');
      show('Account profile updated successfully.', 'success');
    } catch (err) {
      show(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleSaveFirm = async (e) => {
    e.preventDefault();
    if (!firmName.trim() || !address.trim()) {
      show('Firm Name and Address are required.', 'error');
      return;
    }

    if (gstin && gstin.trim() !== '') {
      const gstinVal = gstin.trim().toUpperCase();
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(gstinVal)) {
        show('Please enter a valid 15-digit GSTIN.', 'error');
        return;
      }
      if (gstinVal.substring(0, 2) !== stateCode) {
        show(`GSTIN prefix must match state code (${stateCode}).`, 'error');
        return;
      }
    }

    if (phone && phone.trim() !== '') {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone.trim())) {
        show('Phone number must be strictly 10 digits.', 'error');
        return;
      }
    }

    setSavingFirm(true);
    try {
      await updateActiveFirm({
        name: firmName.trim(),
        address: address.trim(),
        pincode: pincode.trim(),
        gstin: gstin.trim().toUpperCase(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        state,
        stateCode
      });
      show('Business profile updated successfully.', 'success');
    } catch (err) {
      show(err.message || 'Failed to update business profile.', 'error');
    } finally {
      setSavingFirm(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout>
      <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Profile &amp; Settings</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Update your personal profile and active business parameters</p>
          </div>
          <button 
            onClick={handleLogout}
            className="btn btn-danger"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: '600' }}
          >
            Logout
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          
          {/* User Account Card */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div className="card-header">
              <div className="card-title">User Credentials</div>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleSaveUser}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Full Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">New Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="Leave blank to keep current" 
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingUser}>
                  {savingUser ? 'Saving...' : 'Update Account'}
                </button>
              </form>
            </div>
          </div>

          {/* Business Profile Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Business Profile</div>
            </div>
            <div style={{ padding: '20px' }}>
              <form onSubmit={handleSaveFirm}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Firm Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={firmName} 
                    onChange={(e) => setFirmName(e.target.value)} 
                    required 
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1.5 }}>
                    <label className="form-label">State</label>
                    <select 
                      className="form-control" 
                      value={state}
                      onChange={(e) => handleStateChange(e.target.value)}
                    >
                      {Object.keys(STATE_CODES).sort().map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">State Code</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={stateCode} 
                      disabled 
                      style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }} 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">GSTIN Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={gstin} 
                    onChange={(e) => setGstin(e.target.value.toUpperCase())} 
                    placeholder="15-digit GSTIN" 
                    maxLength={15}
                    style={{ textTransform: 'uppercase' }} 
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ flex: 1.2 }}>
                    <label className="form-label">Phone Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      placeholder="10-digit mobile" 
                      maxLength={10} 
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Pincode</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={pincode} 
                      onChange={(e) => setPincode(e.target.value)} 
                      placeholder="6-digit ZIP" 
                      maxLength={6} 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="business@example.com" 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">Business Address</label>
                  <textarea 
                    className="form-control" 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    required 
                    rows={2} 
                    style={{ resize: 'none' }} 
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingFirm}>
                  {savingFirm ? 'Saving...' : 'Update Business'}
                </button>
              </form>
            </div>
          </div>


        </div>
      </div>
      <Toast toast={toast} />
    </Layout>
  );
}
