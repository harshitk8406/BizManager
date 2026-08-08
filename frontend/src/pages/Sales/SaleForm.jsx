import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import AutocompleteInput from '../../components/UI/AutocompleteInput';
import Modal from '../../components/UI/Modal';
import Toast, { useToast } from '../../components/UI/Toast';
import { getCustomers, createCustomer } from '../../api/customers';
import { getItems, createItem } from '../../api/items';
import { createSale, getSaleById, updateSale, getNextSaleInvoiceNumber } from '../../api/sales';
import { checkAnomaly } from '../../api/ai';
import { calculateLineItem } from '../../utils/gst';
import { formatCurrency, todayString, toInputDate } from '../../utils/format';
import { printGSTInvoice } from '../../utils/printInvoice';
import { useFormShortcuts } from '../../hooks/useKeyboardShortcut';
import { useAuth } from '../../context/AuthContext';

let _lineKeyCounter = 0;
const makeKey = () => `line-${++_lineKeyCounter}`;

const EMPTY_ITEM = () => ({
  _key: makeKey(),
  item: '', itemCode: '', itemName: '', hsnCode: '',
  packingSize: '', quantity: 1, rate: 0, gstPercentage: 5,
  itemQuery: '',
});

const EMPTY_CUSTOMER_FORM = {
  customerCode: '', gstNumber: '', customerName: '', customerAddress: '', customerPhone: '',
};

const EMPTY_ITEM_FORM = {
  itemCode: '', itemName: '', packingSize: '', hsnCode: '',
  openingQuantity: 0, purchasePrice: 0, salesPrice: 0, gstPercentage: 5,
};

const GST_SLABS = [0, 5, 12, 18, 28];

/* ─── Tiny "Invoice Ready" confirmation dialog ──────────────── */
function InvoiceReadyModal({ sale, onClose, activeFirm }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)',
      zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        <div style={{ background: '#052e16', padding: '22px 28px 18px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>✓</span>
          </div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Sale Saved Successfully</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 }}>
            Invoice <strong style={{ color: '#4ade80' }}>{sale.invoiceNumber}</strong> has been recorded.
          </div>
        </div>
        <div style={{ padding: '20px 28px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Customer</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{sale.customerName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>Items</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{sale.items?.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #bbf7d0', marginTop: 8, paddingTop: 8 }}>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Grand Total</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{formatCurrency(sale.totalAmount)}</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
            Click <strong>Print GST Invoice</strong> to open the tax invoice in a new window.
          </p>
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            <button
              onClick={() => { printGSTInvoice(sale, activeFirm); }}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%' }}
            >
              Print GST Invoice
            </button>
            <button
              onClick={onClose}
              style={{ background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 0', fontWeight: 600, fontSize: 14, cursor: 'pointer', width: '100%' }}
            >
              Skip &amp; Go to Sales List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Quick-Add Customer Modal ──────────────────────────────── */
function QuickAddCustomerModal({ open, onClose, onAdded }) {
  const [form, setForm] = useState(EMPTY_CUSTOMER_FORM);
  const [saving, setSaving] = useState(false);
  const { toast, show, hide } = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.gstNumber || !form.customerName) {
      show('GST Number and Name are required', 'error'); return;
    }
    const gstVal = form.gstNumber.trim().toUpperCase();
    const isCash = gstVal === 'CASH';
    const gstRegex = /^[A-Z0-9]{15}$/;
    if (!isCash && !gstRegex.test(gstVal)) {
      show('GST Number must be 15 alphanumeric characters (or "CASH" for retail)', 'error'); return;
    }
    if (form.customerPhone && form.customerPhone.trim()) {
      if (!/^[0-9]{10}$/.test(form.customerPhone.trim())) {
        show('Phone must be a 10-digit number', 'error'); return;
      }
    }
    setSaving(true);
    try {
      const payload = { ...form, gstNumber: gstVal, customerPhone: form.customerPhone?.trim() || '' };
      const r = await createCustomer(payload);
      show('Customer added!');
      setTimeout(() => {
        onAdded(r.data);
        onClose();
        setForm(EMPTY_CUSTOMER_FORM);
      }, 600);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}
      <Modal
        open={open}
        onClose={onClose}
        title="Quick Add Customer"
        footer={
          <>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : 'Add Customer'}
            </button>
          </>
        }
      >
        <div className="form-grid form-grid-2">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">GST Number / Type <span className="required">*</span></label>
            <input className="form-control" value={form.gstNumber}
              onChange={e => set('gstNumber', e.target.value.toUpperCase())}
              placeholder="GST number or CASH for retail"
              style={{ textTransform: 'uppercase' }} />
            <span className="form-hint">Enter CASH for retail / unregistered customers</span>
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Customer Name <span className="required">*</span></label>
            <input className="form-control" value={form.customerName}
              onChange={e => set('customerName', e.target.value)} placeholder="Customer full name" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Address</label>
            <textarea className="form-control" rows={2} value={form.customerAddress}
              onChange={e => set('customerAddress', e.target.value)} placeholder="Full address" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-control" value={form.customerPhone}
              onChange={e => set('customerPhone', e.target.value)} placeholder="10-digit number" />
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ─── Quick-Add Item Modal ──────────────────────────────────── */
function QuickAddItemModal({ open, onClose, onAdded, prefillName }) {
  const [form, setForm] = useState({ ...EMPTY_ITEM_FORM });
  const [saving, setSaving] = useState(false);
  const { toast, show, hide } = useToast();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open && prefillName) setForm(f => ({ ...f, itemName: prefillName }));
    if (!open) setForm({ ...EMPTY_ITEM_FORM });
  }, [open, prefillName]);

  const handleSave = async () => {
    if (!form.itemName || !form.packingSize || !form.hsnCode) {
      show('Item Name, Packing Size and HSN Code are required', 'error'); return;
    }
    setSaving(true);
    try {
      const r = await createItem(form);
      show('Item added!');
      setTimeout(() => { onAdded(r.data); onClose(); }, 600);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}
      <Modal
        open={open}
        onClose={onClose}
        title="Quick Add Item"
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner" /> Saving...</> : 'Add Item'}
            </button>
          </>
        }
      >
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label">Item Name <span className="required">*</span></label>
            <input className="form-control" value={form.itemName}
              onChange={e => set('itemName', e.target.value)} placeholder="e.g. Brake Pad" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Packing Size <span className="required">*</span></label>
            <input className="form-control" value={form.packingSize}
              onChange={e => set('packingSize', e.target.value)} placeholder="e.g. 1 Pc, 10ml" />
          </div>
          <div className="form-group">
            <label className="form-label">HSN Code <span className="required">*</span></label>
            <input className="form-control" value={form.hsnCode}
              onChange={e => set('hsnCode', e.target.value)} placeholder="e.g. 87089900" />
          </div>
          <div className="form-group">
            <label className="form-label">GST %</label>
            <select className="form-control" value={form.gstPercentage}
              onChange={e => set('gstPercentage', Number(e.target.value))}>
              {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Purchase Price (Rs.)</label>
            <input type="number" className="form-control" value={form.purchasePrice}
              onChange={e => set('purchasePrice', Number(e.target.value))} min={0} step="0.01" />
          </div>
          <div className="form-group">
            <label className="form-label">Sales Price (Rs.)</label>
            <input type="number" className="form-control" value={form.salesPrice}
              onChange={e => set('salesPrice', Number(e.target.value))} min={0} step="0.01" />
          </div>
          <div className="form-group">
            <label className="form-label">Opening Qty</label>
            <input type="number" className="form-control" value={form.openingQuantity}
              onChange={e => set('openingQuantity', Number(e.target.value))} min={0} />
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ─── Sale Form ─────────────────────────────────────────────── */
export default function SaleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { activeFirm } = useAuth();

  const [customerQuery, setCustomerQuery] = useState('');
  const [customer, setCustomer] = useState(null);
  const [saleCode, setSaleCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(todayString());
  const [isInterState, setIsInterState] = useState(false);
  const [lines, setLines] = useState([EMPTY_ITEM()]);
  const [saving, setSaving] = useState(false);
  const [savedSale, setSavedSale] = useState(null);
  const [roundOff, setRoundOff] = useState(true);

  // Quick-add modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalPrefill, setItemModalPrefill] = useState('');
  const [activeItemIdx, setActiveItemIdx] = useState(null);

  const { toast, show, hide } = useToast();

  useEffect(() => {
    if (isEdit) {
      getSaleById(id).then(r => {
        const s = r.data;
        setSaleCode(s.saleCode || '');
        setCustomerQuery(s.customerName);
        setCustomer({
          _id: s.customer?._id || s.customer,
          customerName: s.customerName,
          gstNumber: s.customerGST,
          customerAddress: s.customerAddress,
          customerPhone: s.customerPhone,
        });
        setInvoiceNumber(s.invoiceNumber);
        setDate(toInputDate(s.date));
        setIsInterState(s.isInterState || false);
        setLines(s.items.map(i => ({
          _key: makeKey(),
          item: i.item, itemCode: i.itemCode, itemName: i.itemName,
          hsnCode: i.hsnCode, packingSize: i.packingSize,
          quantity: i.quantity, rate: i.rate, gstPercentage: i.gstPercentage,
          itemQuery: i.itemName,
        })));
        setRoundOff(s.roundOff !== undefined ? s.roundOff : true);
      }).catch(e => show(e.message, 'error'));
    }
  }, [id]);

  useEffect(() => {
    if (!isEdit && date) {
      getNextSaleInvoiceNumber(date)
        .then(res => setInvoiceNumber(res.data))
        .catch(e => show(e.message, 'error'));
    }
  }, [date, isEdit]);

  /* ── Data fetchers ──────────────────────────────────────────── */
  const fetchCustomers = async (q) => {
    const r = await getCustomers({ search: q });
    return r.data.map(c => ({ ...c, label: c.customerName, sub: c.gstNumber }));
  };

  const fetchItems = async (q) => {
    const r = await getItems({ search: q });
    return r.data.map(i => ({ ...i, label: i.itemName, sub: `${i.itemCode} · ${i.packingSize}` }));
  };

  /* ── Customer selection ─────────────────────────────────────── */
  const handleSelectCustomer = (c) => { setCustomer(c); setCustomerQuery(c.customerName); };

  const handleCustomerAdded = (c) => {
    const mapped = { ...c, label: c.customerName, sub: c.gstNumber };
    handleSelectCustomer(mapped);
  };

  /* ── Item row selection ─────────────────────────────────────── */
  const handleSelectItem = (idx, item) => {
    setLines(prev => {
      const newLines = [...prev];
      newLines[idx] = {
        ...newLines[idx],
        item: item._id, itemCode: item.itemCode, itemName: item.itemName,
        hsnCode: item.hsnCode, packingSize: item.packingSize,
        rate: item.salesPrice || 0, gstPercentage: item.gstPercentage || 18,
        itemQuery: item.itemName,
      };
      return newLines;
    });
  };

  const handleItemAdded = (item) => {
    if (activeItemIdx !== null) handleSelectItem(activeItemIdx, item);
    setActiveItemIdx(null);
  };

  const openItemModal = (idx) => {
    setActiveItemIdx(idx);
    setItemModalPrefill(lines[idx]?.itemQuery || '');
    setItemModalOpen(true);
  };

  /* ── Line management ────────────────────────────────────────── */
  const updateLine = (idx, key, value) => {
    setLines(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], [key]: value };
      return n;
    });
  };
  const addLine = () => {
    setLines(prev => [...prev, EMPTY_ITEM()]);
  };
  const removeLine = (idx) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  /* ── Tab key handler for table rows ────────────────────────── */
  const handleRowTab = useCallback((e, idx, isLastField) => {
    if (e.key === 'Tab' && !e.shiftKey && isLastField && idx === lines.length - 1) {
      e.preventDefault();
      addLine();
      setTimeout(() => document.getElementById(`sitem-${idx + 1}`)?.focus(), 50);
    }
  }, [lines.length]);

  /* ── Totals ─────────────────────────────────────────────────── */
  const getTotals = () => {
    let subtotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    lines.forEach(l => {
      if (!l.item) return;
      const g = calculateLineItem(l.quantity, l.rate, l.gstPercentage, isInterState);
      subtotal += g.taxableAmount;
      totalCgst += g.cgst;
      totalSgst += g.sgst;
      totalIgst += g.igst;
    });
    const totalTax = totalCgst + totalSgst + totalIgst;
    const grandTotal = subtotal + totalTax;
    const roundOffAmt = roundOff ? Math.round(grandTotal) - grandTotal : 0;
    return { subtotal, totalCgst, totalSgst, totalIgst, totalTax, grandTotal, roundOffAmt };
  };

  const totals = getTotals();

  /* ── Save ───────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!customer)      { show('Please select a customer', 'error'); return; }
    if (!invoiceNumber) { show('Please enter invoice number', 'error'); return; }
    if (!date)          { show('Please select a date', 'error'); return; }
    const validLines = lines.filter(l => l.item);
    if (validLines.length === 0) { show('Please add at least one item', 'error'); return; }

    setSaving(true);
    const payload = {
      customer: customer._id,
      invoiceNumber,
      date,
      isInterState,
      roundOff,
      items: validLines.map(l => ({
        item: l.item, itemCode: l.itemCode, itemName: l.itemName,
        hsnCode: l.hsnCode, packingSize: l.packingSize,
        quantity: Number(l.quantity), rate: Number(l.rate),
        gstPercentage: Number(l.gstPercentage),
      })),
    };

    try {
      if (isEdit) {
        await updateSale(id, payload);
        show('Sale updated');
        setTimeout(() => navigate('/sales'), 800);
      } else {
        const r = await createSale(payload);
        const sale = r.data;
        sale.customerName    = sale.customerName    || customer.customerName;
        sale.customerGST     = sale.customerGST     || customer.gstNumber;
        sale.customerAddress = sale.customerAddress || customer.customerAddress;
        sale.customerPhone   = sale.customerPhone   || customer.customerPhone;
        setSavedSale(sale);
        // Non-blocking anomaly check after save
        checkAnomaly({
          type: 'sale',
          items: payload.items,
          customerName: customer?.customerName || '',
          totalAmount: validLines.reduce((s, l) => s + Number(l.quantity) * Number(l.rate), 0)
        }).then(res => {
          if (res?.data?.anomaly && res?.data?.warning) {
            show(`⚠️ AI Notice: ${res.data.warning}`, 'warning');
          }
        }).catch(() => {}); // silent fail
      }
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  useFormShortcuts({ onSave: handleSave, onCancel: () => navigate('/sales') });

  return (
    <Layout title={isEdit ? 'Edit Sale' : 'New Sale'}>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      {/* Invoice Ready dialog */}
      {savedSale && (
        <InvoiceReadyModal
          sale={savedSale}
          activeFirm={activeFirm}
          onClose={() => { setSavedSale(null); navigate('/sales'); }}
        />
      )}

      {/* Quick-add modals */}
      <QuickAddCustomerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onAdded={handleCustomerAdded}
      />
      <QuickAddItemModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        onAdded={handleItemAdded}
        prefillName={itemModalPrefill}
      />

      {/* ── Page header ─────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">{isEdit ? 'Edit Sale' : 'New Sale Entry'}</h2>
          <p className="page-subtitle">Record sales invoice to customer</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/sales')}>Back</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} title="Save (Ctrl+Enter)">
            {saving
              ? <><span className="spinner"></span> Saving...</>
              : isEdit
                ? <span>Update Sale <kbd style={{fontSize:10,opacity:0.7,marginLeft:6,background:'rgba(255,255,255,0.2)',padding:'1px 5px',borderRadius:3}}>Ctrl+↵</kbd></span>
                : <span>Save &amp; Print <kbd style={{fontSize:10,opacity:0.7,marginLeft:6,background:'rgba(255,255,255,0.2)',padding:'1px 5px',borderRadius:3}}>Ctrl+↵</kbd></span>}
          </button>
        </div>
      </div>

      {/* ── Invoice Details ──────────────────────────────────── */}
      <div className="card mb-16">
        <div className="card-header"><div className="card-title">Invoice Details</div></div>
        <div className="form-grid form-grid-3">
          <div className="form-group" style={{ gridColumn: '1 / span 2' }}>
            <label className="form-label">Customer <span className="required">*</span></label>
            <div className="autocomplete-with-add">
              <AutocompleteInput
                id="customer-search"
                value={customerQuery}
                onChange={setCustomerQuery}
                onSelect={handleSelectCustomer}
                fetchSuggestions={fetchCustomers}
                placeholder="Search customer by name or GST..."
                displayKey="label"
                subKey="sub"
                autoFocus={!isEdit}
                onAddNew={() => setCustomerModalOpen(true)}
                addNewLabel="+ New Customer"
              />
              <button
                type="button"
                className="quick-add-btn"
                onClick={() => setCustomerModalOpen(true)}
                style={{ alignSelf: 'flex-start' }}
              >
                + New Customer
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Invoice Number <span className="required">*</span></label>
            <input
              className="form-control"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="e.g. SALE-2024-001"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date <span className="required">*</span></label>
            <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Transaction Type</label>
            <select className="form-control" value={isInterState ? 'inter' : 'intra'}
              onChange={e => setIsInterState(e.target.value === 'inter')}>
              <option value="intra">Intra-State (CGST + SGST)</option>
              <option value="inter">Inter-State (IGST)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Sale Code</label>
            <input className="form-control" value={saleCode} placeholder="Auto-generated" disabled />
          </div>
        </div>

        {customer && (
          <div className="info-box">
            <div className="info-box-item">
              <div className="info-box-label">GST / Type</div>
              <div className="info-box-value">{customer.gstNumber}</div>
            </div>
            <div className="info-box-item">
              <div className="info-box-label">Name</div>
              <div className="info-box-value">{customer.customerName}</div>
            </div>
            {customer.customerAddress && (
              <div className="info-box-item">
                <div className="info-box-label">Address</div>
                <div className="info-box-value">{customer.customerAddress}</div>
              </div>
            )}
            {customer.customerPhone && (
              <div className="info-box-item">
                <div className="info-box-label">Phone</div>
                <div className="info-box-value">{customer.customerPhone}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sale Items ───────────────────────────────────────── */}
      <div className="card mb-16">
        <div className="card-header">
          <div className="card-title">Sale Items</div>
          <button className="btn btn-secondary btn-sm" onClick={addLine}>+ Add Row</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="invoice-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 220 }}>Item Name</th>
                <th style={{ width: 90 }}>HSN Code</th>
                <th style={{ width: 110 }}>Packing Size</th>
                <th style={{ width: 100, minWidth: 100 }}>Qty</th>
                <th style={{ width: 110 }}>Rate (Rs.)</th>
                <th style={{ width: 80 }}>GST %</th>
                <th style={{ width: 110 }}>Taxable</th>
                <th style={{ width: 90 }}>Tax</th>
                <th style={{ width: 120 }}>Total (Rs.)</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const g = line.item
                  ? calculateLineItem(line.quantity, line.rate, line.gstPercentage, isInterState)
                  : null;
                return (
                  <tr key={line._key}>
                    <td>
                      <div className="autocomplete-with-add">
                        <AutocompleteInput
                          id={`sitem-${idx}`}
                          value={line.itemQuery}
                          onChange={v => updateLine(idx, 'itemQuery', v)}
                          onSelect={(item) => handleSelectItem(idx, item)}
                          fetchSuggestions={fetchItems}
                          placeholder="Search item..."
                          displayKey="label"
                          subKey="sub"
                          onAddNew={() => openItemModal(idx)}
                          addNewLabel="+ New Item"
                        />
                        <button
                          type="button"
                          className="quick-add-btn"
                          onClick={() => openItemModal(idx)}
                        >
                          + New Item
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        className="form-control hsn-readonly"
                        value={line.hsnCode}
                        readOnly
                        tabIndex={-1}
                        placeholder="From item"
                        title="HSN Code is set from Item Master"
                      />
                    </td>
                    <td>
                      <input
                        className="form-control"
                        value={line.packingSize}
                        onChange={e => updateLine(idx, 'packingSize', e.target.value)}
                        placeholder="e.g. 1 Pc"
                        title="Packing size (editable)"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={line.quantity}
                        onChange={e => updateLine(idx, 'quantity', e.target.value)}
                        min={0.001}
                        step="0.001"
                        style={{ minWidth: 72 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={line.rate}
                        onChange={e => updateLine(idx, 'rate', e.target.value)}
                        min={0}
                        step="0.01"
                      />
                    </td>
                    <td>
                      <select
                        className="form-control"
                        value={line.gstPercentage}
                        onChange={e => updateLine(idx, 'gstPercentage', Number(e.target.value))}
                        onKeyDown={e => handleRowTab(e, idx, true)}
                      >
                        {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </td>
                    <td className="text-right fw-600">{g ? formatCurrency(g.taxableAmount) : '—'}</td>
                    <td className="text-right">{g ? formatCurrency(g.totalTax) : '—'}</td>
                    <td className="text-right fw-600 text-success">{g ? formatCurrency(g.grandTotal) : '—'}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        tabIndex={-1}
                      >×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Totals ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="totals-section" style={{ minWidth: 320, width: '100%', maxWidth: 380 }}>
          <label className="roundoff-toggle">
            <input
              type="checkbox"
              checked={roundOff}
              onChange={e => setRoundOff(e.target.checked)}
            />
            Auto Round-off Grand Total
          </label>
          <div className="totals-row"><span>Taxable Amount</span><span className="value">{formatCurrency(totals.subtotal)}</span></div>
          {isInterState
            ? <div className="totals-row"><span>IGST</span><span className="value">{formatCurrency(totals.totalIgst)}</span></div>
            : <>
                <div className="totals-row"><span>CGST</span><span className="value">{formatCurrency(totals.totalCgst)}</span></div>
                <div className="totals-row"><span>SGST</span><span className="value">{formatCurrency(totals.totalSgst)}</span></div>
              </>}
          <div className="totals-row"><span>Total Tax</span><span className="value">{formatCurrency(totals.totalTax)}</span></div>
          {roundOff && totals.roundOffAmt !== 0 && (
            <div className="totals-row roundoff">
              <span>Round Off</span>
              <span className="value">
                {totals.roundOffAmt > 0 ? '+' : ''}{formatCurrency(totals.roundOffAmt)}
              </span>
            </div>
          )}
          <div className="totals-row total">
            <span>Grand Total</span>
            <span className="value">
              {formatCurrency(roundOff ? Math.round(totals.grandTotal) : totals.grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
