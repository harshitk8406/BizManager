import { useEffect } from 'react';

const SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Alt', 'D'],  label: 'Dashboard' },
      { keys: ['Alt', 'I'],  label: 'Item Master' },
      { keys: ['Alt', 'S'],  label: 'Suppliers' },
      { keys: ['Alt', 'C'],  label: 'Customers' },
      { keys: ['Alt', 'P'],  label: 'Purchases' },
      { keys: ['Alt', 'V'],  label: 'Sales (Vouchers)' },
      { keys: ['Alt', 'R'],  label: 'Stock Report' },
      { keys: ['Alt', 'G'],  label: 'GST Returns' },
      { keys: ['Alt', 'N'],  label: 'New Record (on list pages)' },
    ],
  },
  {
    title: 'Forms',
    shortcuts: [
      { keys: ['Ctrl', 'Enter'],  label: 'Save / Submit form' },
      { keys: ['Escape'],         label: 'Cancel / Go back' },
      { keys: ['Tab'],            label: 'Next field' },
      { keys: ['Shift', 'Tab'],   label: 'Previous field' },
    ],
  },
  {
    title: 'Lists & Tables',
    shortcuts: [
      { keys: ['↑', '↓'],   label: 'Move between rows' },
      { keys: ['Enter'],    label: 'Open selected row' },
      { keys: ['Home'],     label: 'Jump to first row' },
      { keys: ['End'],      label: 'Jump to last row' },
      { keys: ['/'],        label: 'Focus search / filter input' },
    ],
  },
  {
    title: 'Dropdowns & Autocomplete',
    shortcuts: [
      { keys: ['↑', '↓'],   label: 'Navigate suggestions' },
      { keys: ['Enter'],    label: 'Select suggestion' },
      { keys: ['Escape'],   label: 'Close dropdown' },
    ],
  },
  {
    title: 'Modals',
    shortcuts: [
      { keys: ['Escape'],         label: 'Close modal' },
      { keys: ['Tab'],            label: 'Cycle through buttons' },
      { keys: ['Enter'],          label: 'Confirm (when button focused)' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['?'],        label: 'Show this keyboard shortcut guide' },
    ],
  },
];

function Kbd({ children }) {
  return (
    <kbd style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 5,
      background: '#f3f4f6',
      border: '1px solid #d1d5db',
      borderBottom: '2px solid #9ca3af',
      fontFamily: 'monospace',
      fontSize: 11,
      fontWeight: 700,
      color: '#111827',
      minWidth: 22,
      textAlign: 'center',
      lineHeight: 1.6,
    }}>
      {children}
    </kbd>
  );
}

export default function KeyboardHelp({ open, onClose }) {
  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 20000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720,
        maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Keyboard Shortcuts</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              This app is fully keyboard-navigable. Press <Kbd>?</Kbd> anytime to open this guide.
            </div>
          </div>
          <button
            onClick={onClose}
            autoFocus
            style={{
              background: '#f3f4f6', border: '1px solid #e5e7eb',
              borderRadius: 8, padding: '6px 14px',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#374151',
            }}
          >
            Close <Kbd>Esc</Kbd>
          </button>
        </div>

        {/* Sections */}
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {SECTIONS.map(section => (
            <div key={section.title}>
              <div style={{
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: 1.2, color: '#16a34a', marginBottom: 10,
              }}>
                {section.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {section.shortcuts.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 8,
                    background: '#f9fafb', border: '1px solid #f3f4f6',
                  }}>
                    <span style={{ fontSize: 12.5, color: '#374151' }}>{s.label}</span>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                      {s.keys.map((k, ki) => (
                        <span key={ki} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {ki > 0 && <span style={{ fontSize: 10, color: '#9ca3af' }}>+</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          padding: '12px 24px 20px', textAlign: 'center',
          fontSize: 11.5, color: '#9ca3af',
        }}>
          Tip: All navigation shortcuts use <Kbd>Alt</Kbd> + a letter. Forms save with <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd>.
        </div>
      </div>
    </div>
  );
}
