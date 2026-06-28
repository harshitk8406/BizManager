import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import KeyboardHelp from '../UI/KeyboardHelp';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';

export default function Layout({ title, children }) {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  /* ── Global navigation shortcuts (Alt + key) ─────────────── */
  useKeyboardShortcut('alt+d', () => navigate('/'));
  useKeyboardShortcut('alt+i', () => navigate('/items'));
  useKeyboardShortcut('alt+s', () => navigate('/suppliers'));
  useKeyboardShortcut('alt+c', () => navigate('/customers'));
  useKeyboardShortcut('alt+p', () => navigate('/purchases'));
  useKeyboardShortcut('alt+v', () => navigate('/sales'));
  useKeyboardShortcut('alt+r', () => navigate('/reports/stock'));
  useKeyboardShortcut('alt+t', () => navigate('/reports/stock-detail'));
  useKeyboardShortcut('alt+g', () => navigate('/reports/gst'));

  /* ── Alt+N → click the first .btn-primary on the page ──────── */
  useKeyboardShortcut('alt+n', () => {
    const btn = document.querySelector('.page-header-actions .btn-primary, .page-header .btn-primary');
    btn?.click();
    btn?.focus();
  });

  /* ── / → focus the first search input on the page ──────────── */
  useKeyboardShortcut('slash', () => {
    const input = document.querySelector(
      'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], input[placeholder*="Filter"], .autocomplete-wrapper input'
    );
    input?.focus();
    input?.select();
  });

  /* ── ? → show keyboard help ─────────────────────────────────── */
  useKeyboardShortcut('shift+/', () => setHelpOpen(true));
  // Also handle the '?' character directly
  useKeyboardShortcut('?', () => setHelpOpen(true));

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-right">
            <div className="topbar-date">{today}</div>
            <button
              className="kbd-help-btn"
              onClick={() => setHelpOpen(true)}
              title="Keyboard shortcuts (?)"
              aria-label="Show keyboard shortcuts"
            >
              <span className="kbd-badge">?</span>
              <span className="kbd-help-label">Shortcuts</span>
            </button>
          </div>
        </header>
        <main className="page-content">
          {children}
        </main>
      </div>
      <KeyboardHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
