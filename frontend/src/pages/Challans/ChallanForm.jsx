import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import AutocompleteInput from '../../components/UI/AutocompleteInput';
import Modal from '../../components/UI/Modal';
import Toast, { useToast } from '../../components/UI/Toast';
import { getCustomers, createCustomer } from '../../api/customers';
import { getItems, createItem } from '../../api/items';
import {
  createChallan, getChallanById, updateChallan,
  getNextChallanNumber, convertChallanToInvoice,
} from '../../api/challans';
import { getNextSaleInvoiceNumber } from '../../api/sales';
import { formatCurrency, todayString, toInputDate } from '../../utils/format';
import { printDeliveryChallan } from '../../utils/printChallan';
import { printGSTInvoice } from '../../utils/printInvoice';
import { useAuth } from '../../context/AuthContext';

const EMPTY_ITEM = {
  item: '', itemCode: '', itemName: '', hsnCode: '',
  packingSize: '', quantity: 1, rate: 0, gstPercentage: 5,
};

const EMPTY_CUSTOMER_FORM = {
  customerCode: '', gstNumber: '', customerName: '', customerAddress: '', customerPhone: '',
};

const EMPTY_ITEM_FORM = {
  itemCode: '', itemName: '', packingSize: '', hsnCode: '',
  openingQuantity: 0, purchasePrice: 0, salesPrice: 0, gstPercentage: 5,
};

/* ─── Convert-to-Invoice Modal ─────────────────────────────── */
function ConvertModal({ challan, activeFirm, onClose, onDone }) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate]     = useState(todayString());
  const [isInterState, setIsInterState]   = useState(false);
  const [roundOff, setRoundOff]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  useEffect(() => {
    getNextSaleInvoiceNumber(todayString())
      .then(r => setInvoiceNumber(r.data || ''))
      .catch(() => {});
  }, []);

  const handleConvert = async () => {
    if (!invoiceNumber.trim()) { setError('Invoice number is required'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await convertChallanToInvoice(challan._id, {
        invoiceNumber: invoiceNumber.trim(),
        date: invoiceDate,
        isInterState,
        roundOff,
      });
      onDone(result.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: '#052e16', padding: '20px 24px' }}>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Convert to GST Invoice</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            Challan <strong style={{ color: '#4ade80' }}>{challan.challanNumber}</strong> → {challan.customerName}
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: 24 }}>
          {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <div className="form-group">
            <label className="form-label">Invoice Number *</label>
            <input className="form-control" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="INV-20250705-0001" />
          </div>

          <div className="form-group">
            <label className="form-label">Invoice Date *</label>
            <input type="date" className="form-control" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={isInterState} onChange={e => setIsInterState(e.target.checked)} />
              Inter-State (IGST)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} />
              Round Off
            </label>
          </div>

          {/* Summary */}
          <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 20, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Items</span>
              <span style={{ fontWeight: 600 }}>{(challan.items || []).length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Challan Total</span>
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{formatCurrency(challan.totalAmount)}</span>
            </div>
            <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
              GST will be calculated from Item Master rates at time of conversion.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-success" style={{ flex: 1 }} onClick={handleConvert} disabled={loading}>
              {loading ? 'Converting…' : '✓ Convert to Invoice'}
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Convert Success Modal ─────────────────────────────────── */
function ConvertSuccessModal({ sale, activeFirm, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: '#052e16', padding: '22px 28px 18px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>✓</span>
          </div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Converted to Invoice!</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 }}>
            Invoice <strong style={{ color: '#4ade80' }}>{sale.invoiceNumber}</strong> created successfully.
          </div>
        </div>
        <div style={{ padding: '20px 28px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Customer</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{sale.customerName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #bbf7d0', marginTop: 8, paddingTop: 8 }}>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Total (with GST)</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{formatCurrency(sale.totalAmount)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => printGSTInvoice(sale, activeFirm)}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              Print GST Invoice
            </button>
            <button
              onClick={onClose}
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 0', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  ChallanForm                                                   */
/* ══════════════════════════════════════════════════════════════ */
export default function ChallanForm() {
  const { id }               = useParams();
  const [searchParams]       = useSearchParams();
  const isEdit               = Boolean(id);
  const autoConvert          = searchParams.get('convert') === '1';
  const navigate             = useNavigate();
  const { activeFirm }       = useAuth();
  const { toast, show, hide } = useToast();

  /* ── form state ── */
  const [challanNumber, setChallanNumber] = useState('');
  const [date, setDate]                   = useState(todayString());
  const [dueDate, setDueDate]             = useState('');
  const [status, setStatus]               = useState('draft');
  const [remarks, setRemarks]             = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [lrNumber, setLrNumber]           = useState('');
  const [supplyType, setSupplyType]       = useState('For Delivery');

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerQuery, setCustomerQuery]       = useState('');
  const [rows, setRows]                         = useState([{ ...EMPTY_ITEM }]);

  /* ── modal state ── */
  const [showAddCustomer, setShowAddCustomer]   = useState(false);
  const [customerForm, setCustomerForm]         = useState({ ...EMPTY_CUSTOMER_FORM });
  const [showAddItem, setShowAddItem]           = useState(false);
  const [itemForm, setItemForm]                 = useState({ ...EMPTY_ITEM_FORM });
  const [addingItemRowIdx, setAddingItemRowIdx] = useState(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertedSale, setConvertedSale]       = useState(null);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  /* ── load existing challan for edit ── */
  useEffect(() => {
    if (!isEdit) {
      getNextChallanNumber(todayString())
        .then(r => setChallanNumber(r.data || ''))
        .catch(() => {});
      return;
    }
    getChallanById(id)
      .then(r => {
        const c = r.data;
        setChallanNumber(c.challanNumber || '');
        setDate(toInputDate ? toInputDate(c.date) : c.date?.split('T')[0] || todayString());
        setDueDate(c.dueDate ? (toInputDate ? toInputDate(c.dueDate) : c.dueDate?.split('T')[0]) : '');
        setStatus(c.status || 'draft');
        setRemarks(c.remarks || '');
        setVehicleNumber(c.vehicleNumber || '');
        setTransporterName(c.transporterName || '');
        setLrNumber(c.lrNumber || '');
        setSupplyType(c.supplyType || 'For Delivery');
        setSelectedCustomer({ _id: c.customer, customerName: c.customerName, gstNumber: c.customerGST, customerAddress: c.customerAddress, customerPhone: c.customerPhone });
        setCustomerQuery(c.customerName || '');
        setRows((c.items || []).map(it => ({ ...EMPTY_ITEM, ...it })));
      })
      .catch(e => show(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  /* ── auto-open convert modal ── */
  useEffect(() => {
    if (autoConvert && !loading && isEdit) setShowConvertModal(true);
  }, [autoConvert, loading, isEdit]);

  /* ── customer search ── */
  const fetchCustomers = useCallback(async (q) => {
    const res = await getCustomers({ search: q, limit: 20 });
    return (res.data || []).map(c => ({
      _id: c._id, label: c.customerName,
      sub: [c.gstNumber, c.customerPhone].filter(Boolean).join(' · '),
      raw: c,
    }));
  }, []);

  const handleSelectCustomer = (opt) => {
    setSelectedCustomer(opt.raw);
    setCustomerQuery(opt.raw.customerName);
  };

  /* ── item search ── */
  const fetchItems = useCallback(async (q) => {
    const res = await getItems({ search: q, limit: 20 });
    return (res.data || []).map(i => ({
      _id: i._id, label: i.itemName,
      sub: [i.itemCode, i.hsnCode].filter(Boolean).join(' · '),
      raw: i,
    }));
  }, []);

  const handleSelectItem = (idx, opt) => {
    const it = opt.raw;
    setRows(prev => prev.map((r, i) => i !== idx ? r : {
      ...r,
      item: it._id,
      itemCode: it.itemCode || '',
      itemName: it.itemName || '',
      hsnCode: it.hsnCode || '',
      packingSize: it.packingSize || '',
      rate: it.salesPrice || it.purchasePrice || 0,
      gstPercentage: it.gstPercentage || 5,
    }));
  };

  /* ── row helpers ── */
  const updateRow = (idx, field, val) =>
    setRows(prev => prev.map((r, i) => i !== idx ? r : { ...r, [field]: val }));

  const addRow    = () => setRows(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeRow = (idx) => setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  /* ── totals ── */
  const computedRows = rows.map(r => ({
    ...r, amount: Number(r.quantity || 0) * Number(r.rate || 0),
  }));
  const totalAmount = computedRows.reduce((s, r) => s + r.amount, 0);

  /* ── save ── */
  const handleSave = async () => {
    if (!selectedCustomer) { showToast('Please select a customer', 'error'); return; }
    if (!challanNumber.trim()) { showToast('Challan number is required', 'error'); return; }
    if (rows.some(r => !r.item)) { showToast('Please select an item for each row', 'error'); return; }

    setSaving(true);
    try {
      const payload = {
        challanNumber: challanNumber.trim(),
        date,
        dueDate: dueDate || null,
        status,
        remarks,
        vehicleNumber,
        transporterName,
        lrNumber,
        supplyType,
        customer: selectedCustomer._id,
        items: computedRows,
      };
      if (isEdit) {
        await updateChallan(id, payload);
        show('Challan updated', 'success');
      } else {
        await createChallan(payload);
        show('Challan created', 'success');
        navigate('/challans');
      }
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── add customer ── */
  const handleAddCustomer = async () => {
    try {
      const res = await createCustomer(customerForm);
      const c = res.data;
      setSelectedCustomer(c);
      setCustomerQuery(c.customerName);
      setShowAddCustomer(false);
      setCustomerForm({ ...EMPTY_CUSTOMER_FORM });
      show('Customer added', 'success');
    } catch (e) { show(e.message, 'error'); }
  };

  /* ── add item ── */
  const handleAddItem = async () => {
    try {
      const res = await createItem(itemForm);
      const it = res.data;
      if (addingItemRowIdx !== null) {
        setRows(prev => prev.map((r, i) => i !== addingItemRowIdx ? r : {
          ...r, item: it._id, itemCode: it.itemCode, itemName: it.itemName,
          hsnCode: it.hsnCode, packingSize: it.packingSize,
          rate: it.salesPrice || 0, gstPercentage: it.gstPercentage || 5,
        }));
      }
      setShowAddItem(false);
      setItemForm({ ...EMPTY_ITEM_FORM });
      show('Item added', 'success');
    } catch (e) { show(e.message, 'error'); }
  };

  /* ── convert done ── */
  const handleConvertDone = (result) => {
    setShowConvertModal(false);
    setConvertedSale(result.sale);
  };

  if (loading) return (
    <Layout title="Loading…">
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading challan…</div>
    </Layout>
  );

  const isConverted = status === 'converted';

  return (
    <Layout title={isEdit ? 'Edit Challan' : 'New Challan'}>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        {/* Breadcrumb */}
        <button
          onClick={() => navigate('/challans')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
            padding: 0, marginBottom: 10,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Delivery Challans
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                {isEdit ? challanNumber || 'Edit Challan' : 'New Delivery Challan'}
              </h2>
              {isEdit && (
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                  ...(isConverted
                    ? { color: '#16a34a', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)' }
                    : status === 'dispatched'
                    ? { color: '#d97706', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.25)' }
                    : { color: '#64748b', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)' }
                  ),
                }}>
                  {isConverted ? '✓ Converted' : status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {isEdit
                ? isConverted ? `Converted to invoice ${status}` : 'Edit challan details below'
                : 'Fill in customer and item details to create a delivery challan'}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {isEdit && (
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, paddingInline: 16, fontSize: 13 }}
                onClick={() => {
                  if (selectedCustomer) {
                    const d = { challanNumber, date, dueDate, status, remarks, vehicleNumber, transporterName, lrNumber, supplyType, customerName: selectedCustomer.customerName, customerGST: selectedCustomer.gstNumber || '', customerAddress: selectedCustomer.customerAddress || '', customerPhone: selectedCustomer.customerPhone || '', items: computedRows, totalAmount };
                    printDeliveryChallan(d, activeFirm);
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Print Challan
              </button>
            )}

            {isEdit && !isConverted && (
              <button
                className="btn btn-success"
                style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, paddingInline: 16, fontSize: 13, fontWeight: 700 }}
                onClick={() => setShowConvertModal(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Convert to Invoice
              </button>
            )}

            {!isConverted && (
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 7, height: 40, paddingInline: 20, fontSize: 14, fontWeight: 700 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    {isEdit ? 'Update Challan' : 'Save Challan'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* ── Left Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Challan Details */}
          <div style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <div style={{ width: 6, height: 20, background: 'var(--accent-primary)', borderRadius: 3 }} />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Challan Details</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Challan Number *</label>
                <input className="form-control" value={challanNumber} onChange={e => setChallanNumber(e.target.value)} disabled={isConverted} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date *</label>
                <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} disabled={isConverted} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Expected Return / Invoice Date</label>
                <input type="date" className="form-control" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isConverted} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Status</label>
                <select className="form-control" value={status} onChange={e => setStatus(e.target.value)} disabled={isConverted}>
                  <option value="draft">Draft</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="cancelled">Cancelled</option>
                  {isConverted && <option value="converted">Converted</option>}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Supply Type</label>
                <select className="form-control" value={supplyType} onChange={e => setSupplyType(e.target.value)} disabled={isConverted}>
                  <option>For Delivery</option>
                  <option>For Approval / Return</option>
                  <option>Job Work</option>
                  <option>Branch Transfer</option>
                  <option>Exhibition / Fair</option>
                </select>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 20, background: '#3b82f6', borderRadius: 3 }} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Customer / Consignee</h3>
              </div>
              {!isConverted && (
                <button className="btn btn-secondary" style={{ fontSize: 12, height: 32, padding: '0 12px' }} onClick={() => setShowAddCustomer(true)}>
                  + Add New
                </button>
              )}
            </div>
            <AutocompleteInput
              value={customerQuery}
              onChange={setCustomerQuery}
              onSelect={handleSelectCustomer}
              fetchSuggestions={fetchCustomers}
              placeholder="Search customer by name or GST…"
              disabled={isConverted}
            />
            {selectedCustomer && (
              <div style={{ marginTop: 12, background: 'var(--bg-primary)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '14px 16px', fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14, color: 'var(--text-primary)' }}>{selectedCustomer.customerName}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {selectedCustomer.customerAddress && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>📍 {selectedCustomer.customerAddress}</div>}
                  {selectedCustomer.gstNumber && <div style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'monospace' }}>GSTIN: {selectedCustomer.gstNumber}</div>}
                  {selectedCustomer.customerPhone && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>📞 {selectedCustomer.customerPhone}</div>}
                </div>
              </div>
            )}
          </div>

          {/* Items */}
          <div style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 20, background: '#8b5cf6', borderRadius: 3 }} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Items</h3>
              </div>
              {!isConverted && (
                <button className="btn btn-secondary" style={{ fontSize: 12, height: 32, padding: '0 12px' }} onClick={addRow}>
                  + Add Row
                </button>
              )}
            </div>
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ fontSize: 13, minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th style={{ minWidth: 200 }}>Item</th>
                    <th style={{ width: 80 }}>HSN</th>
                    <th style={{ width: 70 }}>Pack</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Qty</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Amount (₹)</th>
                    {!isConverted && <th style={{ width: 40 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {computedRows.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                      <td>
                        <AutocompleteInput
                          value={row.itemName}
                          onChange={val => updateRow(idx, 'itemName', val)}
                          onSelect={opt => handleSelectItem(idx, opt)}
                          fetchSuggestions={fetchItems}
                          placeholder="Search item…"
                          disabled={isConverted}
                        />
                        {!row.item && !isConverted && (
                          <button
                            style={{ fontSize: 11, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginTop: 2 }}
                            onClick={() => { setAddingItemRowIdx(idx); setShowAddItem(true); }}
                          >
                            + Add new item
                          </button>
                        )}
                      </td>
                      <td>
                        <input className="form-control" style={{ fontSize: 12, height: 36 }} value={row.hsnCode} onChange={e => updateRow(idx, 'hsnCode', e.target.value)} disabled={isConverted} />
                      </td>
                      <td>
                        <input className="form-control" style={{ fontSize: 12, height: 36 }} value={row.packingSize} onChange={e => updateRow(idx, 'packingSize', e.target.value)} disabled={isConverted} />
                      </td>
                      <td>
                        <input type="number" className="form-control" style={{ textAlign: 'right', fontSize: 13, height: 36 }} value={row.quantity} min={0} onChange={e => updateRow(idx, 'quantity', e.target.value)} disabled={isConverted} />
                      </td>
                      <td>
                        <input type="number" className="form-control" style={{ textAlign: 'right', fontSize: 13, height: 36 }} value={row.rate} min={0} onChange={e => updateRow(idx, 'rate', e.target.value)} disabled={isConverted} />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                        {formatCurrency(row.amount)}
                      </td>
                      {!isConverted && (
                        <td>
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18, padding: 4 }}
                            onClick={() => removeRow(idx)}
                            title="Remove row"
                          >×</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isConverted && (
              <button className="btn btn-secondary" style={{ marginTop: 12, fontSize: 13 }} onClick={addRow}>
                + Add Another Item
              </button>
            )}
          </div>
        </div>

        {/* ── Right Column ── */}
        <div>
          {/* Total card */}
          <div className="card mb-16" style={{ padding: '20px 24px' }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Items</span>
              <span style={{ fontWeight: 600 }}>{rows.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Qty</span>
              <span style={{ fontWeight: 600 }}>{computedRows.reduce((s, r) => s + Number(r.quantity || 0), 0)}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                <span>Total Amount</span>
                <span style={{ color: 'var(--accent-primary)' }}>{formatCurrency(totalAmount)}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                No GST applied — this is a delivery challan
              </p>
            </div>
          </div>

          {/* Transport */}
          <div className="card mb-16" style={{ padding: '20px 24px' }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Transport Details</h3>
            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input className="form-control" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. MH-01-AB-1234" disabled={isConverted} />
            </div>
            <div className="form-group">
              <label className="form-label">Transporter / Carrier</label>
              <input className="form-control" value={transporterName} onChange={e => setTransporterName(e.target.value)} placeholder="Carrier name" disabled={isConverted} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">LR / GR Number</label>
              <input className="form-control" value={lrNumber} onChange={e => setLrNumber(e.target.value)} placeholder="Lorry receipt / way bill" disabled={isConverted} />
            </div>
          </div>

          {/* Remarks */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <h3 className="card-title" style={{ marginBottom: 12 }}>Remarks</h3>
            <textarea className="form-control" rows={4} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Internal notes, instructions for delivery, etc." disabled={isConverted} style={{ resize: 'vertical' }} />
          </div>
        </div>
      </div>

      {/* ── Add Customer Modal ── */}
      {showAddCustomer && (
        <Modal title="Add New Customer" onClose={() => setShowAddCustomer(false)}>
          {['customerName', 'gstNumber', 'customerAddress', 'customerPhone'].map(field => (
            <div className="form-group" key={field}>
              <label className="form-label" style={{ textTransform: 'capitalize' }}>
                {field.replace(/([A-Z])/g, ' $1').replace('customer', '').trim()}
              </label>
              <input className="form-control" value={customerForm[field]}
                onChange={e => setCustomerForm(p => ({ ...p, [field]: e.target.value }))} />
            </div>
          ))}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleAddCustomer}>
            Save Customer
          </button>
        </Modal>
      )}

      {/* ── Add Item Modal ── */}
      {showAddItem && (
        <Modal title="Add New Item" onClose={() => setShowAddItem(false)}>
          {[
            { key: 'itemName', label: 'Item Name' },
            { key: 'hsnCode', label: 'HSN Code' },
            { key: 'packingSize', label: 'Packing Size' },
            { key: 'gstPercentage', label: 'GST %', type: 'number' },
            { key: 'salesPrice', label: 'Sales Price', type: 'number' },
          ].map(({ key, label, type }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input className="form-control" type={type || 'text'} value={itemForm[key]}
                onChange={e => setItemForm(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleAddItem}>
            Save Item
          </button>
        </Modal>
      )}

      {/* ── Convert Modal ── */}
      {showConvertModal && (
        <ConvertModal
          challan={{ _id: id, challanNumber, customerName: selectedCustomer?.customerName, items: computedRows, totalAmount }}
          activeFirm={activeFirm}
          onClose={() => setShowConvertModal(false)}
          onDone={handleConvertDone}
        />
      )}

      {/* ── Converted Success ── */}
      {convertedSale && (
        <ConvertSuccessModal
          sale={convertedSale}
          activeFirm={activeFirm}
          onClose={() => { setConvertedSale(null); navigate('/challans'); }}
        />
      )}
    </Layout>
  );
}
