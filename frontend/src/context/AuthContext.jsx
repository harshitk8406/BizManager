import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [firms, setFirms] = useState([]);
  const [activeFirmId, setActiveFirmId] = useState(localStorage.getItem('activeFirmId') || null);
  const [loading, setLoading] = useState(true);

  // Derive activeFirm from firms list
  const activeFirm = firms.find((f) => f._id === activeFirmId) || null;

  useEffect(() => {
    const restoreSession = async () => {
      if (token) {
        localStorage.setItem('token', token);
        await fetchUser();
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('activeFirmId');
        setUser(null);
        setFirms([]);
        setActiveFirmId(null);
        setLoading(false);
      }
    };

    restoreSession();
  }, [token]);

  useEffect(() => {
    if (activeFirmId) {
      localStorage.setItem('activeFirmId', activeFirmId);
    } else {
      localStorage.removeItem('activeFirmId');
    }
  }, [activeFirmId]);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data);
      const userFirms = res.data.data.firms || [];
      setFirms(userFirms);
      
      if (userFirms.length > 0) {
        const lastActiveId = localStorage.getItem('activeFirmId');
        const stillExists = userFirms.find(f => f._id === lastActiveId);
        setActiveFirmId(stillExists ? lastActiveId : null);
      }
    } catch (err) {
      console.error('Failed to fetch user', err);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('activeFirmId');
      setUser(null);
      setFirms([]);
      setActiveFirmId(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchFirms = async () => {
    try {
      const res = await api.get('/firms');
      setFirms(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    setToken(res.data.token);
    setUser(res.data.data);
    setFirms(res.data.data.firms || []);
    setActiveFirmId(null);
    return res.data;
  };

  const register = async (registrationData) => {
    const res = await api.post('/auth/register', registrationData);
    setToken(res.data.token);
    setUser(res.data.data);
    const userFirms = res.data.data.firms || [];
    setFirms(userFirms);
    if (userFirms.length > 0) {
      setActiveFirmId(userFirms[0]._id);
    }
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setActiveFirmId(null);
  };

  const selectFirm = (firmId) => {
    setActiveFirmId(firmId);
  };

  const updateUserProfile = async (userData) => {
    const res = await api.put('/auth/profile', userData);
    setUser(prev => ({ ...prev, ...res.data.data }));
    return res.data;
  };

  const updateActiveFirm = async (firmData) => {
    if (!activeFirmId) throw new Error('No active firm selected');
    const res = await api.put(`/firms/${activeFirmId}`, firmData);
    const updatedFirm = res.data.data;
    setFirms(prev => prev.map(f => f._id === activeFirmId ? updatedFirm : f));
    return res.data;
  };

  return (
    <AuthContext.Provider value={{
      user, token, firms, activeFirm, activeFirmId, loading,
      login, register, logout, selectFirm, fetchFirms,
      updateUserProfile, updateActiveFirm
    }}>
      {children}
    </AuthContext.Provider>
  );
};
