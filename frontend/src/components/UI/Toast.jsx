import { useState, useEffect } from 'react';
import { useState as useS } from 'react';

export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, []);

  const colors = {
    success: { bg: 'var(--success-dim)', border: 'rgba(22,163,74,0.25)', color: 'var(--success)' },
    error:   { bg: 'var(--danger-dim)',  border: 'rgba(220,38,38,0.25)',  color: 'var(--danger)' },
    warning: { bg: 'var(--warning-dim)', border: 'rgba(217,119,6,0.25)',  color: 'var(--warning)' },
  };

  const c = colors[type] || colors.success;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        padding: '12px 18px',
        borderRadius: 'var(--radius-md)',
        fontSize: '14px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: 'var(--shadow-lg)',
        animation: 'slideUp 0.25s ease',
        maxWidth: '360px',
        cursor: 'pointer',
      }}
      onClick={onDismiss}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }}></span>
      <span>{message}</span>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useS(null);
  const show = (message, type = 'success') => setToast({ message, type, id: Date.now() });
  const hide = () => setToast(null);
  return { toast, show, hide };
}
