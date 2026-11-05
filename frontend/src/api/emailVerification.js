import api from './axios';

/**
 * Verify whether an email address genuinely exists via MX DNS & delivery checks
 * @param {string} email - Email address to verify
 * @param {string} [firmId] - Optional active firm ID if logged in
 */
export const verifyBusinessEmail = async (email, firmId = null) => {
  const endpoint = firmId ? '/firms/verify-email' : '/auth/verify-email';
  const res = await api.post(endpoint, { email, firmId });
  return res.data;
};
