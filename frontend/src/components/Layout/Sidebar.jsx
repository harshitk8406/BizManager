import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { group: 'Overview', items: [
    { path: '/dashboard', label: 'Dashboard', exact: true },
  ]},
  { group: 'Masters', items: [
    { path: '/items',     label: 'Item Master' },
    { path: '/suppliers', label: 'Suppliers' },
    { path: '/customers', label: 'Customers' },
  ]},
  { group: 'Transactions', items: [
    { path: '/purchases', label: 'Purchases' },
    { path: '/sales',     label: 'Sales' },
    { path: '/payments',  label: 'Payments' },
  ]},
  { group: 'Reports', items: [
    { path: '/reports/stock',        label: 'Stock Report' },
    { path: '/reports/stock-detail', label: 'Transaction Detail' },
    { path: '/reports/gst',          label: 'GST Returns' },
  ]},
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeFirm } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">B</div>
          <div className="logo-text">
            <span className="logo-name">BizManager</span>
            <span className="logo-tagline" style={{ display: 'block', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
              {activeFirm?.name || 'Business Suite'}
            </span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((section) => (
          <div key={section.group}>
            <div className="nav-section-label">{section.group}</div>
            {section.items.map((item) => {
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-dot"></span>
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>


      <div className="sidebar-footer">
        <button 
          onClick={() => navigate('/select-firm')}
          style={{
            width: '100%',
            background: 'rgba(37, 99, 235, 0.08)',
            color: '#2563eb',
            border: 'none',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            textAlign: 'left',
            marginBottom: '8px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.15)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(37, 99, 235, 0.08)'}
        >
          Select Firm
        </button>
        <button 
          onClick={() => navigate('/profile')}
          style={{
            width: '100%',
            background: 'rgba(22, 163, 74, 0.08)',
            color: 'var(--accent-primary)',
            border: 'none',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            textAlign: 'left',
            marginBottom: '12px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(22, 163, 74, 0.15)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(22, 163, 74, 0.08)'}
        >
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: '700',
            flexShrink: 0
          }}>
            {activeFirm?.name ? activeFirm.name.charAt(0).toUpperCase() : 'P'}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeFirm?.name || 'Edit Profile'}
          </span>
        </button>
        <div className="version-badge">v1.0.0 · GST Ready</div>
      </div>
    </aside>
  );
}
