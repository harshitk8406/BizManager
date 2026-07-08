import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import Toast, { useToast } from '../../components/UI/Toast';
import { getChallans, deleteChallan } from '../../api/challans';
import { formatCurrency, formatDate } from '../../utils/format';
import { printDeliveryChallan } from '../../utils/printChallan';
import { useAuth } from '../../context/AuthContext';

/* ── Status config ──────────────────────────────────────────── */
const STATUS_META = {
  draft:      { label: 'Draft',      color: '#64748b', bg: 'rgba(100,116,139,0.12)', dot: '#94a3b8', icon: '○' },
  dispatched: { label: 'Dispatched', color: '#d97706', bg: 'rgba(217,119,6,0.10)',   dot: '#f59e0b', icon: '◉' },
  converted:  { label: 'Converted',  color: '#16a34a', bg: 'rgba(22,163,74,0.10)',   dot: '#22c55e', icon: '✓' },
  cancelled:  { label: 'Cancelled',  color: '#dc2626', bg: 'rgba(220,38,38,0.10)',   dot: '#f87171', icon: '✕' },
};

const STATUS_ICONS = {
  draft:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  dispatched: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>,
  converted:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  cancelled:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
      color: m.color, background: m.bg, whiteSpace: 'nowrap',
      border: `1px solid ${m.color}22`,
    }}>
      <span style={{ color: m.dot, display: 'flex' }}>{STATUS_ICONS[status]}</span>
      {m.label}
    </span>
  );
}

/* ── Skeleton loader row ─────────────────────────────────────── */
function SkeletonRow() {
  const pulse = {
    display: 'inline-block', background: 'var(--border)',
    borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite',
  };
  return (
    <tr>
      {[140, 80, 160, 50, 90, 80, 120].map((w, i) => (
        <td key={i}><span style={{ ...pulse, width: w, height: 14 }} /></td>
      ))}
    </tr>
  );
}

export default function ChallanList() {
  const navigate       = useNavigate();
  const { activeFirm } = useAuth();
  const { toast, show, hide } = useToast();

  const [challans, setChallans]   = useState([]);
  const [allCounts, setAllCounts] = useState({ draft: 0, dispatched: 0, converted: 0, cancelled: 0 });
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, challanNumber }
  const [deleting, setDeleting]   = useState(false);

  const LIMIT = 20;

  /* ── Load counts for all statuses (separate background call) ── */
  const loadCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        Object.keys(STATUS_META).map(s =>
          getChallans({ status: s, limit: 1 }).then(r => [s, r.total || 0])
        )
      );
      setAllCounts(Object.fromEntries(results));
    } catch (_) {}
  }, []);

  /* ── Load paginated challans ─────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (search)       params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (from)         params.from = from;
      if (to)           params.to = to;
      const res = await getChallans(params);
      setChallans(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, from, to]);

  useEffect(() => { load(); },       [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteChallan(deleteTarget.id);
      show('Challan deleted successfully', 'success');
      setDeleteTarget(null);
      load();
      loadCounts();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setFrom(''); setTo(''); setPage(1);
  };
  const hasFilters = search || statusFilter || from || to;
  const pages = Math.ceil(total / LIMIT);

  return (
    <Layout title="Delivery Challans">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      {/* ── Page Header ───────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            Delivery Challans
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {total > 0 ? `${total} challan${total !== 1 ? 's' : ''} total` : 'No challans yet'} · Dispatch goods and convert to GST invoice
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, paddingInline: 20, fontSize: 14, fontWeight: 700 }}
          onClick={() => navigate('/challans/new')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          New Challan
        </button>
      </div>

      {/* ── Status Summary Cards ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {Object.entries(STATUS_META).map(([key, m]) => (
          <button
            key={key}
            onClick={() => { setStatusFilter(statusFilter === key ? '' : key); setPage(1); }}
            style={{
              all: 'unset', cursor: 'pointer',
              background: 'var(--bg-secondary)',
              border: statusFilter === key ? `2px solid ${m.color}` : '1.5px solid var(--border)',
              borderRadius: 14,
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'all 0.18s ease',
              boxShadow: statusFilter === key ? `0 0 0 3px ${m.color}18` : 'none',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: m.bg, color: m.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, flexShrink: 0,
            }}>
              {STATUS_ICONS[key]}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color, lineHeight: 1.1 }}>
                {allCounts[key] || 0}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {m.label}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)', border: '1.5px solid var(--border)',
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 16,
      }}>
        {/* Search */}
        <div style={{ flex: '1 1 220px', position: 'relative', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input
            style={{
              width: '100%', height: 40, paddingLeft: 38, paddingRight: 12,
              background: 'var(--bg-primary)', border: '1.5px solid var(--border)',
              borderRadius: 10, color: 'var(--text-primary)', fontSize: 13,
              outline: 'none', boxSizing: 'border-box',
            }}
            placeholder="Search challan no. or customer…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Status dropdown */}
        <select
          className="form-control"
          style={{ height: 40, width: 150, fontSize: 13 }}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="dispatched">Dispatched</option>
          <option value="converted">Converted</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" className="form-control" style={{ height: 40, width: 144, fontSize: 13 }}
            value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
          <input type="date" className="form-control" style={{ height: 40, width: 144, fontSize: 13 }}
            value={to} onChange={e => { setTo(e.target.value); setPage(1); }} />
        </div>

        {hasFilters && (
          <button
            className="btn btn-secondary"
            style={{ height: 40, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={clearFilters}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            Clear
          </button>
        )}
      </div>

      {/* ── Table card ───────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-secondary)', border: '1.5px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {/* Table header with count */}
        <div style={{
          padding: '14px 20px', borderBottom: '1.5px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {loading ? 'Loading…' : `${challans.length} of ${total} challan${total !== 1 ? 's' : ''}`}
            {hasFilters && <span style={{ marginLeft: 8, color: 'var(--accent-primary)', fontWeight: 700 }}>(filtered)</span>}
          </span>
          {loading && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', animation: 'pulse 1.5s ease-in-out infinite' }}>
              Fetching…
            </span>
          )}
        </div>

        {!loading && challans.length === 0 ? (
          /* ── Empty state ── */
          <div style={{ padding: 72, textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, margin: '0 auto 20px',
              background: 'var(--bg-primary)', border: '2px dashed var(--border)',
              borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              {hasFilters ? 'No challans match your filters' : 'No delivery challans yet'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              {hasFilters ? 'Try clearing some filters to see more results' : 'Create your first delivery challan to start tracking goods dispatch'}
            </div>
            {hasFilters
              ? <button className="btn btn-secondary" onClick={clearFilters}>Clear Filters</button>
              : <button className="btn btn-primary" onClick={() => navigate('/challans/new')}>Create First Challan</button>
            }
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)' }}>
                  {['Challan No.', 'Date', 'Customer', 'Items', 'Amount', 'Status', 'Actions'].map((h, i) => (
                    <th key={h} style={{
                      padding: '11px 16px', fontWeight: 700, fontSize: 11,
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6,
                      textAlign: i >= 3 && i <= 5 ? 'center' : i === 6 ? 'right' : 'left',
                      whiteSpace: 'nowrap', borderBottom: '1.5px solid var(--border)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  : challans.map((c, idx) => (
                    <tr
                      key={c._id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.12s ease',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--bg-primary)04',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary)'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--bg-primary)04'}
                    >
                      {/* Challan Number */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: 13, fontFamily: 'monospace' }}>
                          {c.challanNumber}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {c.challanCode}
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatDate(c.date)}
                        </div>
                        {c.dueDate && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            Due: {formatDate(c.dueDate)}
                          </div>
                        )}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '14px 16px', maxWidth: 200 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.customerName}
                        </div>
                        {c.customerGST && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                            {c.customerGST}
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          background: 'var(--bg-primary)', border: '1.5px solid var(--border)',
                          borderRadius: 8, padding: '3px 10px', fontWeight: 700, fontSize: 13,
                          color: 'var(--text-primary)',
                        }}>
                          {(c.items || []).length}
                        </span>
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
                          {formatCurrency(c.totalAmount)}
                        </div>
                        {c.convertedInvoiceNumber && (
                          <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 2, fontFamily: 'monospace' }}>
                            → {c.convertedInvoiceNumber}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <StatusBadge status={c.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          {/* Print */}
                          <ActionBtn
                            title="Print Challan"
                            onClick={() => printDeliveryChallan(c, activeFirm)}
                            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>}
                          />

                          {/* Edit */}
                          {c.status !== 'converted' && (
                            <ActionBtn
                              title="Edit"
                              onClick={() => navigate(`/challans/edit/${c._id}`)}
                              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                            />
                          )}

                          {/* Convert to Invoice */}
                          {(c.status === 'draft' || c.status === 'dispatched') && (
                            <button
                              title="Convert to GST Invoice"
                              onClick={() => navigate(`/challans/edit/${c._id}?convert=1`)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                height: 34, padding: '0 12px',
                                background: 'rgba(22,163,74,0.1)', color: '#16a34a',
                                border: '1.5px solid rgba(22,163,74,0.25)',
                                borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                transition: 'all 0.15s ease', whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(22,163,74,0.1)'; e.currentTarget.style.color = '#16a34a'; }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                              Invoice
                            </button>
                          )}

                          {/* Delete */}
                          {c.status !== 'converted' && (
                            <ActionBtn
                              title="Delete"
                              danger
                              onClick={() => setDeleteTarget({ id: c._id, challanNumber: c.challanNumber })}
                              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px', borderTop: '1.5px solid var(--border)',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Page {page} of {pages} · {total} total
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-secondary" style={{ height: 36, paddingInline: 14, fontSize: 13 }}
                disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                ← Prev
              </button>
              {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p < 1 || p > pages) return null;
                return (
                  <button key={p}
                    onClick={() => setPage(p)}
                    style={{
                      height: 36, width: 36, borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: p === page ? 'var(--accent-primary)' : 'var(--bg-primary)',
                      color: p === page ? '#fff' : 'var(--text-secondary)',
                      border: p === page ? 'none' : '1.5px solid var(--border)',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >{p}</button>
                );
              })}
              <button className="btn btn-secondary" style={{ height: 36, paddingInline: 14, fontSize: 13 }}
                disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ─────────────────────────── */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 18, width: '100%', maxWidth: 400,
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            border: '1.5px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{ padding: '24px 28px 0' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, marginBottom: 16,
                background: 'rgba(220,38,38,0.1)', border: '1.5px solid rgba(220,38,38,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                Delete Challan?
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 24 }}>
                Are you sure you want to delete&nbsp;
                <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {deleteTarget.challanNumber}
                </strong>?
                This action cannot be undone.
              </p>
            </div>
            <div style={{ padding: '0 28px 24px', display: 'flex', gap: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, height: 42, fontSize: 14 }}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                style={{ flex: 1, height: 42, fontSize: 14, fontWeight: 700 }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ── Generic small icon action button ──────────────────────── */
function ActionBtn({ onClick, icon, title, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 8, cursor: 'pointer',
        border: danger
          ? `1.5px solid ${hov ? 'transparent' : 'rgba(220,38,38,0.2)'}`
          : `1.5px solid ${hov ? 'var(--accent-primary)' : 'var(--border)'}`,
        background: danger
          ? hov ? '#dc2626' : 'rgba(220,38,38,0.08)'
          : hov ? 'var(--accent-primary)' : 'var(--bg-primary)',
        color: danger
          ? hov ? '#fff' : '#dc2626'
          : hov ? '#fff' : 'var(--text-secondary)',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
    </button>
  );
}
