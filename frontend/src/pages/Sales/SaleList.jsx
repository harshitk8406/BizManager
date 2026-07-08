import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import Toast, { useToast } from '../../components/UI/Toast';
import Modal from '../../components/UI/Modal';
import AutocompleteInput from '../../components/UI/AutocompleteInput';
import { getSales, deleteSale } from '../../api/sales';
import { getCustomers } from '../../api/customers';
import { formatCurrency, formatDate } from '../../utils/format';
import { printGSTInvoice } from '../../utils/printInvoice';
import { exportToCSV, exportToXLSX } from '../../utils/export';
import { useTableKeyNav } from '../../hooks/useTableKeyNav';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useAuth } from '../../context/AuthContext';

export default function SaleList() {
  const navigate = useNavigate();
  const { activeFirm } = useAuth();

  // Filter state
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Data state
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal state
  const [viewModal, setViewModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  const { toast, show, hide } = useToast();

  // Table keyboard navigation — arrow keys + Enter to open
  const { getTableProps, getRowProps } = useTableKeyNav(sales, (s) => setViewModal(s));

  // '/' → focus the customer search input
  useKeyboardShortcut('slash', () => {
    document.getElementById('sale-customer-filter')?.focus();
  });
  // Escape → clear filter if active
  useKeyboardShortcut('escape', () => { if (selectedCustomer) clearCustomerFilter(); });

  /* ── Fetch helpers ─────────────────────────────────────────── */
  const fetchCustomerSuggestions = async (q) => {
    const r = await getCustomers({ search: q });
    return r.data.map(c => ({ ...c, label: c.customerName, sub: c.gstNumber }));
  };

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (selectedCustomer) params.customerGST = selectedCustomer.gstNumber;
    getSales(params)
      .then(r => {
        setSales(r.data);
        setTotalPages(r.pages || 1);
        setTotal(r.total || 0);
      })
      .catch(e => show(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, selectedCustomer]);

  useEffect(() => { load(); }, [load]);

  /* ── Customer selection ────────────────────────────────────── */
  const handleSelectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustomerQuery(c.customerName);
    setPage(1);
  };

  const clearCustomerFilter = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
    setPage(1);
  };

  /* ── Delete ────────────────────────────────────────────────── */
  const handleDelete = async () => {
    try {
      await deleteSale(deleteModal._id);
      show('Sale deleted — stock recalculated');
      setDeleteModal(null);
      setViewModal(null);
      load();
    } catch (e) { show(e.message, 'error'); }
  };

  const handleExportCSV = () => {
    const headers = ["#", "Sale Code", "Invoice No.", "Date", "Customer", "GST / Type", "Sale Type", "Taxable (Rs.)", "Total Tax (Rs.)", "Grand Total (Rs.)"];
    const rows = sales.map((s, idx) => [
      (page - 1) * 15 + idx + 1,
      s.saleCode,
      s.invoiceNumber,
      formatDate(s.date),
      s.customerName,
      s.customerGST,
      s.isInterState ? 'Inter-State' : 'Intra-State',
      s.subtotal,
      s.totalTax,
      s.totalAmount
    ]);
    exportToCSV(rows, headers, 'Sales_Invoices_Report');
  };

  const handleExportExcel = () => {
    const headers = ["#", "Sale Code", "Invoice No.", "Date", "Customer", "GST / Type", "Sale Type", "Taxable (Rs.)", "Total Tax (Rs.)", "Grand Total (Rs.)"];
    const rows = sales.map((s, idx) => [
      (page - 1) * 15 + idx + 1,
      s.saleCode,
      s.invoiceNumber,
      formatDate(s.date),
      s.customerName,
      s.customerGST,
      s.isInterState ? 'Inter-State' : 'Intra-State',
      s.subtotal,
      s.totalTax,
      s.totalAmount
    ]);
    exportToXLSX(rows, headers, 'Sales_Invoices_Report');
  };

  return (
    <Layout title="Sales">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Sales</h2>
          <p className="page-subtitle">
            {selectedCustomer
              ? `Showing ${total} invoice${total !== 1 ? 's' : ''} for ${selectedCustomer.customerName}`
              : `All sales invoices — ${total} total`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} disabled={sales.length === 0}>Export CSV</button>
          <button className="btn btn-secondary" onClick={handleExportExcel} disabled={sales.length === 0}>Export Excel</button>
          <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>
            + New Sale
          </button>
        </div>
      </div>

      {/* ── Customer search bar ──────────────────────────────── */}
      <div className="card mb-16" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, maxWidth: 480 }}>
            <label className="form-label" style={{ marginBottom: 6 }}>
              Filter by Customer — search by name or GST number
            </label>
            <AutocompleteInput
              id="sale-customer-filter"
              value={customerQuery}
              onChange={v => { setCustomerQuery(v); if (!v) clearCustomerFilter(); }}
              onSelect={handleSelectCustomer}
              fetchSuggestions={fetchCustomerSuggestions}
              placeholder="Type customer name or GST number..."
              displayKey="label"
              subKey="sub"
            />
          </div>
          {selectedCustomer && (
            <div style={{ marginTop: 22 }}>
              <button className="btn btn-secondary" onClick={clearCustomerFilter}>
                Clear Filter
              </button>
            </div>
          )}
        </div>

        {selectedCustomer && (
          <div className="info-box" style={{ marginTop: 12 }}>
            <div className="info-box-item"><div className="info-box-label">GST / Type</div><div className="info-box-value">{selectedCustomer.gstNumber}</div></div>
            <div className="info-box-item"><div className="info-box-label">Name</div><div className="info-box-value">{selectedCustomer.customerName}</div></div>
            {selectedCustomer.customerPhone && <div className="info-box-item"><div className="info-box-label">Phone</div><div className="info-box-value">{selectedCustomer.customerPhone}</div></div>}
          </div>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Sale Code</th>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>GST / Type</th>
                <th>Sale Type</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">Total Tax</th>
                <th className="text-right">Grand Total</th>
                <th className="text-center">Details</th>
              </tr>
            </thead>
            <tbody {...getTableProps()}>
              {loading && (
                <tr><td colSpan={11}>
                  <div className="loading-overlay"><div className="spinner"></div></div>
                </td></tr>
              )}
              {!loading && sales.length === 0 && (
                <tr><td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-icon">SA</div>
                    <div className="empty-title">
                      {selectedCustomer ? `No sales found for ${selectedCustomer.customerName}` : 'No sales recorded yet'}
                    </div>
                    <div className="empty-subtitle">
                      {selectedCustomer ? 'Try selecting a different customer' : 'Click "+ New Sale" to record your first sale'}
                    </div>
                  </div>
                </td></tr>
              )}
              {!loading && sales.map((s, idx) => (
                <tr key={s._id} {...getRowProps(idx)}>
                  <td className="text-muted" style={{ fontSize: 12 }}>{(page - 1) * 15 + idx + 1}</td>
                  <td><span className="badge badge-purple">{s.saleCode}</span></td>
                  <td><span className="badge badge-green">{s.invoiceNumber}</span></td>
                  <td>{formatDate(s.date)}</td>
                  <td className="fw-600">{s.customerName}</td>
                  <td>
                    {s.customerGST === 'CASH'
                      ? <span className="badge badge-warning">CASH</span>
                      : <span className="text-muted" style={{ fontSize: 11 }}>{s.customerGST}</span>}
                  </td>
                  <td><span className={`badge ${s.isInterState ? 'badge-purple' : 'badge-teal'}`}>{s.isInterState ? 'Inter-State' : 'Intra-State'}</span></td>
                  <td className="text-right">{formatCurrency(s.subtotal)}</td>
                  <td className="text-right text-warning">{formatCurrency(s.totalTax)}</td>
                  <td className="text-right fw-700 text-success">{formatCurrency(s.totalAmount)}</td>
                  <td className="text-center">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setViewModal(s)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>&#8249;</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
            <button key={p} className={`pagination-btn${page === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>&#8250;</button>
        </div>
      )}

      {/* ── View / Detail Modal ─────────────────────────────── */}
      <Modal
        open={!!viewModal}
        onClose={() => setViewModal(null)}
        title={`Sale — ${viewModal?.invoiceNumber}`}
        size="lg"
        footer={
          <>
            <button className="btn btn-danger" onClick={() => setDeleteModal(viewModal)}>Delete</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => printGSTInvoice(viewModal, activeFirm)}>Print Invoice</button>
            <button className="btn btn-secondary" onClick={() => { setViewModal(null); navigate(`/sales/edit/${viewModal._id}`); }}>Edit</button>
            <button className="btn btn-secondary" onClick={() => setViewModal(null)}>Close</button>
          </>
        }
      >
        {viewModal && (
          <>
            {/* Invoice meta */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20, padding: '14px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div>
                <div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Customer</div>
                <div className="fw-700" style={{ fontSize: 15 }}>{viewModal.customerName}</div>
                {viewModal.customerGST === 'CASH'
                  ? <span className="badge badge-warning" style={{ marginTop: 4 }}>Cash Customer</span>
                  : <div className="text-muted" style={{ fontSize: 12 }}>{viewModal.customerGST}</div>}
              </div>
              <div><div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Invoice No.</div><div className="fw-700" style={{ fontSize: 15 }}>{viewModal.invoiceNumber}</div></div>
              <div><div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Date</div><div className="fw-700" style={{ fontSize: 15 }}>{formatDate(viewModal.date)}</div></div>
              <div><div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Type</div><div className="fw-700" style={{ fontSize: 15 }}>{viewModal.isInterState ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}</div></div>
            </div>

            {/* Items */}
            <div className="table-wrapper" style={{ marginBottom: 16 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Item</th><th>HSN</th><th>Packing</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Taxable</th><th className="text-right">Tax</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  {viewModal.items?.map((item, i) => (
                    <tr key={i}>
                      <td className="fw-600">{item.itemName}</td>
                      <td>{item.hsnCode}</td>
                      <td>{item.packingSize}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{formatCurrency(item.rate)}</td>
                      <td className="text-right">{formatCurrency(item.taxableAmount)}</td>
                      <td className="text-right">{formatCurrency(item.totalTax)} <span className="text-muted" style={{fontSize:10}}>({item.gstPercentage}%)</span></td>
                      <td className="text-right fw-700 text-success">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div className="totals-section" style={{ minWidth: 280 }}>
                <div className="totals-row"><span>Taxable</span><span className="value">{formatCurrency(viewModal.subtotal)}</span></div>
                {viewModal.isInterState
                  ? <div className="totals-row"><span>IGST</span><span className="value">{formatCurrency(viewModal.totalIgst)}</span></div>
                  : <><div className="totals-row"><span>CGST</span><span className="value">{formatCurrency(viewModal.totalCgst)}</span></div>
                    <div className="totals-row"><span>SGST</span><span className="value">{formatCurrency(viewModal.totalSgst)}</span></div></>}
                {(() => {
                  const rawTotal = (viewModal.subtotal || 0) + (viewModal.totalTax || 0);
                  const roundOffAmt = viewModal.totalAmount - rawTotal;
                  if (Math.abs(roundOffAmt) < 0.001) return null;
                  return (
                    <div className="totals-row roundoff">
                      <span>Round Off</span>
                      <span className="value">{roundOffAmt > 0 ? '+' : ''}{formatCurrency(roundOffAmt)}</span>
                    </div>
                  );
                })()}
                <div className="totals-row total"><span>Grand Total</span><span className="value">{formatCurrency(viewModal.totalAmount)}</span></div>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* ── Delete Confirm Modal ─────────────────────────────── */}
      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Sale"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <div className="alert alert-danger">
          Delete sale <strong>{deleteModal?.invoiceNumber}</strong>?<br />
          Stock will be recalculated for all affected items. This cannot be undone.
        </div>
      </Modal>
    </Layout>
  );
}
