import React, { useState, useEffect } from 'react';
import { verifyBusinessEmail } from '../../api/emailVerification';

export default function EmailVerifier({
  value = '',
  onChange,
  onVerifiedChange,
  isVerified = false,
  firmId = null,
  label = 'Business Email Address',
  required = false,
  placeholder = 'business@example.com',
  inputClassName = 'form-control'
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // If initial value changes from external (e.g. loading activeFirm), reset result
  useEffect(() => {
    if (!value) {
      setResult(null);
    }
  }, [value]);

  const handleVerify = async (emailToTest) => {
    const targetEmail = (emailToTest || value || '').trim();
    if (!targetEmail) {
      setResult({
        valid: false,
        status: 'invalid',
        reason: 'Please enter an email address first.'
      });
      if (onVerifiedChange) onVerifiedChange(false, null);
      return;
    }

    setChecking(true);
    setResult(null);

    try {
      const response = await verifyBusinessEmail(targetEmail, firmId);
      const data = response.data;
      setResult(data);

      if (data.valid) {
        if (onVerifiedChange) onVerifiedChange(true, data);
      } else {
        if (onVerifiedChange) onVerifiedChange(false, data);
      }
    } catch (err) {
      setResult({
        valid: false,
        status: 'error',
        reason: err.message || 'Verification service temporarily unavailable. Please check your connection.'
      });
      if (onVerifiedChange) onVerifiedChange(false, null);
    } finally {
      setChecking(false);
    }
  };

  const handleApplySuggestion = (suggested) => {
    if (onChange) onChange(suggested);
    handleVerify(suggested);
  };

  const isCurrentEmailVerified = isVerified && !result && value.trim();

  return (
    <div className="email-verifier-wrapper" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <label className="form-label" style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>
          {label} {required && <span style={{ color: 'var(--danger, #dc2626)' }}>*</span>}
        </label>
        {isCurrentEmailVerified && (
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#16a34a',
            background: '#dcfce7',
            padding: '2px 8px',
            borderRadius: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            ✓ Verified Active
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="email"
          className={inputClassName}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (result) setResult(null);
            if (onVerifiedChange) onVerifiedChange(false, null);
          }}
          onBlur={() => {
            // Optional: Auto-verify on blur if non-empty and not yet verified
            if (value && value.includes('@') && !result && !isCurrentEmailVerified) {
              handleVerify(value);
            }
          }}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={() => handleVerify(value)}
          disabled={checking || !value.trim()}
          style={{
            padding: '8px 14px',
            background: checking ? 'var(--bg-secondary, #e5e7eb)' : 'var(--accent-primary, #0284c7)',
            color: checking ? 'var(--text-muted, #6b7280)' : '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-md, 6px)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: checking || !value.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
          title="Verify if this email domain and mailbox genuinely exist"
        >
          {checking ? (
            <>
              <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
              Verifying...
            </>
          ) : result?.valid || isCurrentEmailVerified ? (
            'Re-verify'
          ) : (
            'Verify Email'
          )}
        </button>
      </div>

      {/* Verification Feedback Banner */}
      {result && (
        <div style={{
          marginTop: '10px',
          padding: '12px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          background: result.valid
            ? (result.status === 'typo' ? '#fefce8' : '#f0fdf4')
            : (result.status === 'disposable' ? '#fff1f2' : '#fef2f2'),
          border: `1px solid ${
            result.valid
              ? (result.status === 'typo' ? '#fef08a' : '#bbf7d0')
              : (result.status === 'disposable' ? '#fecdd3' : '#fecaca')
          }`,
          color: result.valid
            ? (result.status === 'typo' ? '#854d0e' : '#166534')
            : (result.status === 'disposable' ? '#9f1239' : '#991b1b'),
          lineHeight: 1.5,
          animation: 'fadeIn 0.2s ease-in'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '15px', marginTop: '1px' }}>
                {result.valid ? (result.status === 'typo' ? '⚠️' : '✅') : '❌'}
              </span>
              <div>
                <strong>
                  {result.valid
                    ? (result.status === 'typo' ? 'Domain Active (Typo Warning)' : 'Email Exists & Active')
                    : (result.status === 'disposable' ? 'Disposable Email Blocked' : 'Email Does Not Exist')}
                </strong>
                <div style={{ marginTop: '2px', fontSize: '12.5px', opacity: 0.9 }}>
                  {result.reason}
                </div>

                {/* Suggestion action if typo */}
                {result.suggestion && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleApplySuggestion(result.suggestion)}
                      style={{
                        background: '#eab308',
                        color: '#000000',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 10px',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Apply Suggestion: {result.suggestion}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle technical details */}
            {result.checks?.domain?.hasMx && (
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '11px',
                  opacity: 0.8,
                  padding: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                {showDetails ? 'Hide Details' : 'View MX Proof'}
              </button>
            )}
          </div>

          {/* Technical Diagnostics Drawer */}
          {showDetails && result.checks && (
            <div style={{
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(0,0,0,0.1)',
              fontSize: '11.5px',
              fontFamily: 'monospace'
            }}>
              <div><strong>Domain:</strong> {result.checks.domain.domain}</div>
              <div><strong>Format:</strong> RFC 5322 Compliant</div>
              <div><strong>Disposable:</strong> {result.checks.disposable.isDisposable ? 'Yes (Rejected)' : 'No'}</div>
              <div><strong>Primary MX Server:</strong> {result.checks.domain.primaryMx || 'None'}</div>
              {result.checks.domain.mxRecords?.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <strong>Configured Mail Exchangers ({result.checks.domain.mxRecords.length}):</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {result.checks.domain.mxRecords.slice(0, 3).map((mx, idx) => (
                      <li key={idx}>{mx.exchange} (Priority: {mx.priority})</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.checks.smtp?.message && (
                <div style={{ marginTop: '4px' }}>
                  <strong>SMTP Status:</strong> {result.checks.smtp.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
