import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export default function Modal({ open, onClose, title, children, footer, size = '' }) {
  const modalRef  = useRef(null);
  const returnRef = useRef(null); // element that triggered the modal

  /* ── Capture trigger element so focus returns on close ──────── */
  useEffect(() => {
    if (open) {
      returnRef.current = document.activeElement;
      // Focus first focusable element inside the modal
      setTimeout(() => {
        const el = modalRef.current?.querySelector(FOCUSABLE);
        el?.focus();
      }, 50);
    } else {
      // Return focus to trigger element
      returnRef.current?.focus();
    }
  }, [open]);

  /* ── Escape to close ────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* ── Focus trap — keep Tab cycling inside the modal ────────── */
  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(modalRef.current?.querySelectorAll(FOCUSABLE) || []);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        className={`modal${size ? ` modal-${size}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2 className="modal-title" id="modal-title">{title}</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close (Escape)"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
