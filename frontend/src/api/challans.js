import api from './axios';

export const getChallans         = (params) => api.get('/challans', { params }).then(r => r.data);
export const getChallanById      = (id)      => api.get(`/challans/${id}`).then(r => r.data);
export const createChallan       = (data)    => api.post('/challans', data).then(r => r.data);
export const updateChallan       = (id, data)=> api.put(`/challans/${id}`, data).then(r => r.data);
export const deleteChallan       = (id)      => api.delete(`/challans/${id}`).then(r => r.data);
export const getNextChallanNumber= (date)    => api.get('/challans/next-number', { params: { date } }).then(r => r.data);
export const convertChallanToInvoice = (id, data) => api.post(`/challans/${id}/convert`, data).then(r => r.data);
