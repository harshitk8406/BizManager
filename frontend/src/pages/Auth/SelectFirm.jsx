import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './Auth.css';

const SelectFirm = () => {
  const { user, firms, fetchFirms, selectFirm, activeFirmId } = useAuth();
  const navigate = useNavigate();
  const [showNewFirm, setShowNewFirm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // New firm form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [error, setError] = useState('');


  useEffect(() => {
    if (firms.length === 0) {
      setShowNewFirm(true);
    }
  }, [firms]);

  const handleSelect = (firmId) => {
    selectFirm(firmId);
    navigate('/dashboard');
  };

  const handleCreateFirm = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/firms', { name, address, gstin });
      await fetchFirms();
      selectFirm(res.data.data._id);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to create firm');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel" style={{ maxWidth: '600px' }}>
        <h1 className="auth-title">Welcome, {user?.name}</h1>
        <p className="auth-subtitle">Select a firm to continue or create a new one</p>

        {firms.length > 0 && !showNewFirm && (
          <div className="firm-list">
            {firms.map((firm) => (
              <div 
                key={firm._id} 
                className={`firm-card ${activeFirmId === firm._id ? 'active' : ''}`}
                onClick={() => handleSelect(firm._id)}
              >
                <div className="firm-details">
                  <h3>{firm.name}</h3>
                  {firm.gstin && <p>GST: {firm.gstin}</p>}
                </div>
                <button className="select-btn">Continue</button>
              </div>
            ))}
            
            <button className="auth-btn outline" onClick={() => setShowNewFirm(true)} style={{ marginTop: '20px' }}>
              + Create New Firm
            </button>
          </div>
        )}

        {showNewFirm && (
          <form onSubmit={handleCreateFirm} className="auth-form new-firm-form">
            {error && <div className="auth-error">{error}</div>}
            
            <div className="form-group">
              <label>Firm Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="My Business Name"
                required 
                autoFocus
              />
            </div>
            
            <div className="form-group">
              <label>Address</label>
              <input 
                type="text" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                placeholder="123 Business Street, City"
                required 
              />
            </div>
            
            <div className="form-group">
              <label>GSTIN (Optional)</label>
              <input 
                type="text" 
                value={gstin} 
                onChange={(e) => setGstin(e.target.value)} 
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            
            <div className="form-actions" style={{ display: 'flex', gap: '10px' }}>
              {firms.length > 0 && (
                <button type="button" className="auth-btn outline" onClick={() => setShowNewFirm(false)}>
                  Cancel
                </button>
              )}
              <button type="submit" className="auth-btn" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Creating...' : 'Create Firm'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SelectFirm;
