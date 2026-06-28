import api from './axios';

export const getStockSummary  = ()       => api.get('/reports/stock-summary').then(r => r.data);
export const getStockDetail   = (params) => api.get('/reports/stock-detail',  { params }).then(r => r.data);
export const getSalesDetail   = (params) => api.get('/reports/sales-detail',  { params }).then(r => r.data);
export const getGSTR1         = (params) => api.get('/reports/gstr1',         { params }).then(r => r.data);
export const getGSTR3B        = (params) => api.get('/reports/gstr3b',        { params }).then(r => r.data);
export const getDashboardStats = ()      => api.get('/reports/dashboard').then(r => r.data);
