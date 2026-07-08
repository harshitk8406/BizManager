import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import KeyboardHelp from '../UI/KeyboardHelp';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useAuth } from '../../context/AuthContext';

export default function Layout({ title, children }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

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
  useKeyboardShortcut('?', () => setHelpOpen(true));

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="app-layout">
      {/* Mobile sidebar overlay backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        <header className="topbar">
          {/* Hamburger for mobile */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(s => !s)}
            aria-label="Toggle navigation"
          >
            <span /><span /><span />
          </button>

          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-right">
            <div className="topbar-date">{today}</div>
            <button
              className="theme-toggle-btn"
              onClick={() => setIsDark(d => !d)}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
              )}
            </button>
            <button
              className="kbd-help-btn"
              onClick={() => setHelpOpen(true)}
              title="Keyboard shortcuts (?)"
              aria-label="Show keyboard shortcuts"
            >
              <span className="kbd-badge">?</span>
              <span className="kbd-help-label">Shortcuts</span>
            </button>
            <button
              className="logout-btn"
              onClick={logout}
              title="Logout"
              aria-label="Logout"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              <span className="logout-btn-label">Logout</span>
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
