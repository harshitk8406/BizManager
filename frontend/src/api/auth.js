import api from './axios';

/**
 * Request password reset OTP for a firm owner
 * @param {string} identifier - Username or registered firm email
 */
export const forgotPassword = async (identifier) => {
  const res = await api.post('/auth/forgot-password', { identifier });
  return res.data;
};

/**
 * Verify 6-digit OTP code before setting new password
 * @param {string} identifier - Username or registered email
 * @param {string} otp - 6-digit verification code
 */
export const verifyResetOtp = async (identifier, otp) => {
  const res = await api.post('/auth/verify-reset-otp', { identifier, otp });
  return res.data;
};

/**
 * Set new password and confirm
 * @param {string} identifier - Username or registered email
 * @param {string} otp - 6-digit verification code
 * @param {string} newPassword - New password
 * @param {string} confirmPassword - Password confirmation
 */
export const resetPassword = async (identifier, otp, newPassword, confirmPassword) => {
  const res = await api.post('/auth/reset-password', {
    identifier,
    otp,
    newPassword,
    confirmPassword
  });
  return res.data;
};
