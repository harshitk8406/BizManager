import api from './axios';

// 1. AI Chatbot
export const chatWithAI = (message, history = []) =>
  api.post('/ai/chat', { message, history }).then(r => r.data);

// 2. HSN Code & GST Suggester
export const suggestHSN = (itemName, packingSize = '') =>
  api.post('/ai/hsn-suggest', { itemName, packingSize }).then(r => r.data);

// 3. Anomaly Detection
export const checkAnomaly = (payload) =>
  api.post('/ai/anomaly-check', payload).then(r => r.data);

// 4. Report/Dashboard AI Summary
export const getAIReportSummary = (stats) =>
  api.post('/ai/report-summary', { stats }).then(r => r.data);

// 5. Payment Reminder Generator
export const generatePaymentReminder = (customerName, balance, phone = '', customerId = '') =>
  api.post('/ai/payment-reminder', { customerName, balance, phone, customerId }).then(r => r.data);
