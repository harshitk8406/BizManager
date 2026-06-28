import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import Toast, { useToast } from '../../components/UI/Toast';
import Modal from '../../components/UI/Modal';
import AutocompleteInput from '../../components/UI/AutocompleteInput';
import { getPurchases, deletePurchase } from '../../api/purchases';
import { getSuppliers } from '../../api/suppliers';
import { formatCurrency, formatDate } from '../../utils/format';
import { printPurchaseReceipt } from '../../utils/printInvoice';
import { exportToCSV, exportToXLSX } from '../../utils/export';
import { useTableKeyNav } from '../../hooks/useTableKeyNav';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useAuth } from '../../context/AuthContext';

export default function PurchaseList() {
  const navigate = useNavigate();
  const { activeFirm } = useAuth();

  // Filter state
  const [supplierQuery, setSupplierQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null); // holds full supplier obj when selected

  // Data state
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal state
  const [viewModal, setViewModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  const { toast, show, hide } = useToast();

  // Table keyboard navigation
  const { getTableProps, getRowProps } = useTableKeyNav(purchases, (p) => setViewModal(p));

  // '/' → focus the supplier search input
  useKeyboardShortcut('slash', () => {
    document.getElementById('purchase-supplier-filter')?.focus();
  });
  // Escape → clear filter if one is active (outside inputs)
  useKeyboardShortcut('escape', () => { if (selectedSupplier) clearSupplierFilter(); });

  /* ── Fetch helpers ─────────────────────────────────────────── */
  const fetchSupplierSuggestions = async (q) => {
    const r = await getSuppliers({ search: q });
    return r.data.map(s => ({ ...s, label: s.supplierName, sub: s.gstNumber }));
  };

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 15 };
    if (selectedSupplier) params.supplierGST = selectedSupplier.gstNumber;
    getPurchases(params)
      .then(r => {
        setPurchases(r.data);
        setTotalPages(r.pages || 1);
        setTotal(r.total || 0);
      })
      .catch(e => show(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, selectedSupplier]);

  useEffect(() => { load(); }, [load]);

  /* ── Supplier selection ────────────────────────────────────── */
  const handleSelectSupplier = (s) => {
    setSelectedSupplier(s);
    setSupplierQuery(s.supplierName);
    setPage(1);
  };

  const clearSupplierFilter = () => {
    setSelectedSupplier(null);
    setSupplierQuery('');
    setPage(1);
  };

  /* ── Delete ────────────────────────────────────────────────── */
  const handleDelete = async () => {
    try {
      await deletePurchase(deleteModal._id);
      show('Purchase deleted — stock recalculated');
      setDeleteModal(null);
      setViewModal(null);
      load();
    } catch (e) { show(e.message, 'error'); }
  };

  const handleExportCSV = () => {
    const headers = ["#", "Purchase Code", "Invoice No.", "Date", "Supplier", "GST No.", "Type", "Taxable (Rs.)", "Total Tax (Rs.)", "Grand Total (Rs.)"];
    const rows = purchases.map((p, idx) => [
      (page - 1) * 15 + idx + 1,
      p.purchaseCode,
      p.invoiceNumber,
      formatDate(p.date),
      p.supplierName,
      p.supplierGST,
      p.isInterState ? 'Inter-State' : 'Intra-State',
      p.subtotal,
      p.totalTax,
      p.totalAmount
    ]);
    exportToCSV(rows, headers, 'Purchase_Invoices_Report');
  };

  const handleExportExcel = () => {
    const headers = ["#", "Purchase Code", "Invoice No.", "Date", "Supplier", "GST No.", "Type", "Taxable (Rs.)", "Total Tax (Rs.)", "Grand Total (Rs.)"];
    const rows = purchases.map((p, idx) => [
      (page - 1) * 15 + idx + 1,
      p.purchaseCode,
      p.invoiceNumber,
      formatDate(p.date),
      p.supplierName,
      p.supplierGST,
      p.isInterState ? 'Inter-State' : 'Intra-State',
      p.subtotal,
      p.totalTax,
      p.totalAmount
    ]);
    exportToXLSX(rows, headers, 'Purchase_Invoices_Report');
  };

  return (
    <Layout title="Purchases">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Purchases</h2>
          <p className="page-subtitle">
            {selectedSupplier
              ? `Showing ${total} invoice${total !== 1 ? 's' : ''} for ${selectedSupplier.supplierName}`
              : `All purchase invoices — ${total} total`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} disabled={purchases.length === 0}>Export CSV</button>
          <button className="btn btn-secondary" onClick={handleExportExcel} disabled={purchases.length === 0}>Export Excel</button>
          <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>
            + New Purchase
          </button>
        </div>
      </div>

      {/* ── Supplier search bar ──────────────────────────────── */}
      <div className="card mb-16" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, maxWidth: 480 }}>
            <label className="form-label" style={{ marginBottom: 6 }}>
              Filter by Supplier — search by name or GST number
            </label>
            <AutocompleteInput
              id="purchase-supplier-filter"
              value={supplierQuery}
              onChange={v => { setSupplierQuery(v); if (!v) clearSupplierFilter(); }}
              onSelect={handleSelectSupplier}
              fetchSuggestions={fetchSupplierSuggestions}
              placeholder="Type supplier name or GST number..."
              displayKey="label"
              subKey="sub"
            />
          </div>
          {selectedSupplier && (
            <div style={{ marginTop: 22 }}>
              <button className="btn btn-secondary" onClick={clearSupplierFilter}>
                Clear Filter
              </button>
            </div>
          )}
        </div>

        {selectedSupplier && (
          <div className="info-box" style={{ marginTop: 12 }}>
            <div className="info-box-item"><div className="info-box-label">GST Number</div><div className="info-box-value">{selectedSupplier.gstNumber}</div></div>
            <div className="info-box-item"><div className="info-box-label">Name</div><div className="info-box-value">{selectedSupplier.supplierName}</div></div>
            {selectedSupplier.supplierPhone && <div className="info-box-item"><div className="info-box-label">Phone</div><div className="info-box-value">{selectedSupplier.supplierPhone}</div></div>}
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
                <th>Purchase Code</th>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>GST No.</th>
                <th>Type</th>
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
              {!loading && purchases.length === 0 && (
                <tr><td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-icon">PU</div>
                    <div className="empty-title">
                      {selectedSupplier ? `No purchases found for ${selectedSupplier.supplierName}` : 'No purchases recorded yet'}
                    </div>
                    <div className="empty-subtitle">
                      {selectedSupplier ? 'Try selecting a different supplier' : 'Click "+ New Purchase" to record your first purchase'}
                    </div>
                  </div>
                </td></tr>
              )}
              {!loading && purchases.map((p, idx) => (
                <tr key={p._id} {...getRowProps(idx)}>
                  <td className="text-muted" style={{ fontSize: 12 }}>{(page - 1) * 15 + idx + 1}</td>
                  <td><span className="badge badge-purple">{p.purchaseCode}</span></td>
                  <td className="fw-600">{p.invoiceNumber}</td>
                  <td>{formatDate(p.date)}</td>
                  <td className="fw-600">{p.supplierName}</td>
                  <td className="text-muted" style={{ fontSize: 11 }}>{p.supplierGST}</td>
                  <td><span className={`badge ${p.isInterState ? 'badge-purple' : 'badge-teal'}`}>{p.isInterState ? 'Inter-State' : 'Intra-State'}</span></td>
                  <td className="text-right">{formatCurrency(p.subtotal)}</td>
                  <td className="text-right text-warning">{formatCurrency(p.totalTax)}</td>
                  <td className="text-right fw-700 text-accent">{formatCurrency(p.totalAmount)}</td>
                  <td className="text-center">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setViewModal(p)}
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
        title={`Purchase — ${viewModal?.invoiceNumber}`}
        size="lg"
        footer={
          <>
            <button className="btn btn-danger" onClick={() => setDeleteModal(viewModal)}>Delete</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={() => printPurchaseReceipt(viewModal, activeFirm)}>Print Receipt</button>
            <button className="btn btn-secondary" onClick={() => { setViewModal(null); navigate(`/purchases/edit/${viewModal._id}`); }}>Edit</button>
            <button className="btn btn-secondary" onClick={() => setViewModal(null)}>Close</button>
          </>
        }
      >
        {viewModal && (
          <>
            {/* Invoice meta */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20, padding: '14px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div><div className="text-muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>Supplier</div><div className="fw-700" style={{ fontSize: 15 }}>{viewModal.supplierName}</div><div className="text-muted" style={{ fontSize: 12 }}>{viewModal.supplierGST}</div></div>
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
                      <td className="text-right fw-700 text-accent">{formatCurrency(item.amount)}</td>
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
        title="Delete Purchase"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <div className="alert alert-danger">
          Delete purchase <strong>{deleteModal?.invoiceNumber}</strong>?<br />
          Stock will be recalculated for all affected items. This cannot be undone.
        </div>
      </Modal>
    </Layout>
  );
}
