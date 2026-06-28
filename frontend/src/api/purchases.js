import api from './axios';

export const getPurchases = (params) => api.get('/purchases', { params }).then(r => r.data);
export const getPurchaseById = (id) => api.get(`/purchases/${id}`).then(r => r.data);
export const createPurchase = (data) => api.post('/purchases', data).then(r => r.data);
export const updatePurchase = (id, data) => api.put(`/purchases/${id}`, data).then(r => r.data);
export const deletePurchase = (id) => api.delete(`/purchases/${id}`).then(r => r.data);
export const getNextPurchaseInvoiceNumber = (date) => api.get('/purchases/next-invoice-number', { params: { date } }).then(r => r.data);
