import api from './axios';

export const getItems = (params) => api.get('/items', { params }).then(r => r.data);
export const getItemByCode = (code) => api.get(`/items/${code}`).then(r => r.data);
export const createItem = (data) => api.post('/items', data).then(r => r.data);
export const updateItem = (code, data) => api.put(`/items/${code}`, data).then(r => r.data);
export const deleteItem = (code) => api.delete(`/items/${code}`).then(r => r.data);
