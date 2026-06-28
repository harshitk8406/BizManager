import api from './axios';

export const getPayments = (params) => api.get('/payments', { params }).then(r => r.data);
export const getPaymentSummary = () => api.get('/payments/summary').then(r => r.data);
export const getPartyBalances = () => api.get('/payments/balances').then(r => r.data);
export const createPayment = (data) => api.post('/payments', data).then(r => r.data);
export const updatePayment = (id, data) => api.put(`/payments/${id}`, data).then(r => r.data);
export const deletePayment = (id) => api.delete(`/payments/${id}`).then(r => r.data);
