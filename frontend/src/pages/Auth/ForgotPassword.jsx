import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgotPassword, verifyResetOtp, resetPassword } from '../../api/auth';

const ForgotPassword = () => {
  const navigate = useNavigate();

  // Wizard Step: 1 = Request OTP, 2 = Verify OTP, 3 = Reset Password, 4 = Success
  const [step, setStep] = useState(1);

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI status states
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Start countdown for OTP resend
  const startCooldown = () => {
    setResendCooldown(45);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // STEP 1: Send OTP to registered email
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!identifier.trim()) {
      setError('Please enter your username or registered firm email.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(identifier.trim());
      setMaskedEmail(res.maskedEmail || 'your registered email');
      setSuccessMsg(res.message);
      setStep(2);
      startCooldown();
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please check your username/email.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await forgotPassword(identifier.trim());
      setSuccessMsg(`A fresh verification code was sent to ${res.maskedEmail || maskedEmail}`);
      startCooldown();
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify the 6-digit OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyResetOtp(identifier.trim(), cleanOtp);
      setSuccessMsg('Verification code confirmed! Now enter your new password.');
      setStep(3);
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Submit New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter carefully.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(
        identifier.trim(),
        otp.trim(),
        newPassword,
        confirmPassword
      );
      setSuccessMsg(res.message);
      setStep(4);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-container">
      <style>{`
        .forgot-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-primary);
          padding: 40px 20px;
          font-family: 'Inter', sans-serif;
          box-sizing: border-box;
        }

        .forgot-card {
          width: 100%;
          max-width: 460px;
          background-color: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 40px;
          box-shadow: var(--shadow-lg);
          box-sizing: border-box;
          animation: forgotFade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes forgotFade {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .forgot-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .forgot-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(2, 132, 199, 0.1);
          color: var(--accent-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin: 0 auto 16px auto;
        }

        .forgot-title {
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 6px 0;
        }

        .forgot-subtitle {
          color: var(--text-muted);
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }

        /* Step Progress indicators */
        .step-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 24px;
        }

        .step-dot {
          width: 28px;
          height: 4px;
          border-radius: 2px;
          background: var(--border);
          transition: all 0.3s ease;
        }

        .step-dot.active {
          background: var(--accent-primary);
          width: 40px;
        }

        .step-dot.done {
          background: var(--accent-secondary, #16a34a);
        }

        .input-group {
          position: relative;
          margin-bottom: 20px;
        }

        .input-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .input-field {
          width: 100%;
          padding: 13px 16px;
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 15px;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .input-field:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px var(--accent-primary-glow);
        }

        .otp-input {
          font-family: monospace;
          font-size: 24px;
          letter-spacing: 12px;
          text-align: center;
          font-weight: 700;
          color: var(--text-primary);
        }

        .err-banner {
          background: var(--danger-dim, #fee2e2);
          border: 1px solid rgba(220, 38, 38, 0.2);
          color: var(--danger, #dc2626);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          margin-bottom: 20px;
          line-height: 1.4;
        }

        .info-banner {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          margin-bottom: 20px;
          line-height: 1.4;
        }

        .submit-btn {
          width: 100%;
          background-color: var(--accent-primary);
          color: #ffffff;
          border: none;
          padding: 14px;
          border-radius: var(--radius-md);
          font-size: 15px;
          font-weight: 650;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 10px;
        }

        .submit-btn:hover:not(:disabled) {
          background-color: var(--accent-secondary);
          transform: translateY(-1px);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .toggle-pw-btn {
          position: absolute;
          right: 12px;
          top: 38px;
          background: none;
          border: none;
          font-size: 12px;
          color: var(--text-muted);
          cursor: pointer;
          font-weight: 600;
        }

        .forgot-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 14px;
          color: var(--text-muted);
        }

        .forgot-footer a {
          color: var(--accent-primary);
          text-decoration: none;
          font-weight: 600;
        }

        .forgot-footer a:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="forgot-card">
        {/* Step Indicator Dots */}
        {step < 4 && (
          <div className="step-dots">
            <div className={`step-dot ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`} />
            <div className={`step-dot ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`} />
            <div className={`step-dot ${step === 3 ? 'active' : ''}`} />
          </div>
        )}

        {/* STEP 1: Identify Account */}
        {step === 1 && (
          <>
            <div className="forgot-header">
              <div className="forgot-icon">🔑</div>
              <h1 className="forgot-title">Forgot Password</h1>
              <p className="forgot-subtitle">
                Enter your username or registered firm email address. We'll send a 6-digit OTP to authorize the reset.
              </p>
            </div>

            {error && <div className="err-banner">{error}</div>}

            <form onSubmit={handleRequestOtp}>
              <div className="input-group">
                <label>Username or Registered Email</label>
                <input
                  className="input-field"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. admin or owner@firm.com"
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Sending OTP Code...' : 'Send Verification OTP'}
              </button>
            </form>

            <div className="forgot-footer">
              Remembered your password? <Link to="/login">Sign In</Link>
            </div>
          </>
        )}

        {/* STEP 2: Enter 6-digit OTP */}
        {step === 2 && (
          <>
            <div className="forgot-header">
              <div className="forgot-icon" style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}>✉️</div>
              <h1 className="forgot-title">Enter Verification Code</h1>
              <p className="forgot-subtitle">
                We sent a 6-digit OTP to <strong style={{ color: 'var(--text-primary)' }}>{maskedEmail}</strong>.
              </p>
            </div>

            {successMsg && <div className="info-banner">{successMsg}</div>}
            {error && <div className="err-banner">{error}</div>}

            <form onSubmit={handleVerifyOtp}>
              <div className="input-group">
                <label style={{ textAlign: 'center' }}>6-Digit OTP Code</label>
                <input
                  className="input-field otp-input"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  maxLength={6}
                  required
                  autoFocus
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', display: 'block', marginTop: '6px' }}>
                  Code is valid for 10 minutes
                </span>
              </div>

              <button type="submit" className="submit-btn" disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '13px' }}>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); setSuccessMsg(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                  &larr; Change account
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--accent-primary)',
                    cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    padding: 0
                  }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* STEP 3: Set New Password & Confirm */}
        {step === 3 && (
          <>
            <div className="forgot-header">
              <div className="forgot-icon">🔒</div>
              <h1 className="forgot-title">Create New Password</h1>
              <p className="forgot-subtitle">
                Set and confirm your new secure password for <strong>{identifier}</strong>.
              </p>
            </div>

            {successMsg && <div className="info-banner">{successMsg}</div>}
            {error && <div className="err-banner">{error}</div>}

            <form onSubmit={handleResetPassword}>
              <div className="input-group">
                <label>New Password</label>
                <input
                  className="input-field"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoFocus
                />
                <button
                  type="button"
                  className="toggle-pw-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="input-group">
                <label>Confirm New Password</label>
                <input
                  className="input-field"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  minLength={6}
                />
                {confirmPassword && (
                  <span style={{
                    fontSize: '12px',
                    color: newPassword === confirmPassword ? '#16a34a' : '#dc2626',
                    marginTop: '4px',
                    display: 'block',
                    fontWeight: 600
                  }}>
                    {newPassword === confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={loading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
              >
                {loading ? 'Updating Password...' : 'Save New Password & Continue'}
              </button>
            </form>
          </>
        )}

        {/* STEP 4: Password Successfully Reset */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: 800,
              margin: '0 auto 20px auto'
            }}>
              ✓
            </div>
            <h1 className="forgot-title" style={{ color: '#16a34a' }}>Password Reset!</h1>
            <p className="forgot-subtitle" style={{ marginBottom: '24px' }}>
              Your account password has been updated successfully. You can now sign in with your new credentials.
            </p>

            <button
              type="button"
              className="submit-btn"
              onClick={() => navigate('/login')}
              style={{ background: '#16a34a' }}
            >
              Sign In to Your Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
