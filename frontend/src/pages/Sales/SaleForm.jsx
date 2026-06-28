import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import AutocompleteInput from '../../components/UI/AutocompleteInput';
import Toast, { useToast } from '../../components/UI/Toast';
import { getCustomers } from '../../api/customers';
import { getItems } from '../../api/items';
import { createSale, getSaleById, updateSale, getNextSaleInvoiceNumber } from '../../api/sales';
import { calculateLineItem } from '../../utils/gst';
import { formatCurrency, todayString, toInputDate } from '../../utils/format';
import { printGSTInvoice } from '../../utils/printInvoice';
import { useFormShortcuts } from '../../hooks/useKeyboardShortcut';
import { useAuth } from '../../context/AuthContext';

const EMPTY_ITEM = {
  item: '', itemCode: '', itemName: '', hsnCode: '',
  packingSize: '', quantity: 1, rate: 0, gstPercentage: 18,
};

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
        {/* Green top bar */}
        <div style={{ background: '#052e16', padding: '22px 28px 18px' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>✓</span>
          </div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Sale Saved Successfully</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 }}>
            Invoice <strong style={{ color: '#4ade80' }}>{sale.invoiceNumber}</strong> has been recorded.
          </div>
        </div>

        {/* Body */}
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
            It will open in the standard GST format with HSN summary.
          </p>

          <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
            <button
              onClick={() => { printGSTInvoice(sale, activeFirm); }}
              style={{
                background: '#16a34a', color: '#fff', border: 'none',
                borderRadius: 10, padding: '12px 0', fontWeight: 700,
                fontSize: 15, cursor: 'pointer', width: '100%',
              }}
            >
              Print GST Invoice
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#f9fafb', color: '#374151',
                border: '1px solid #e5e7eb', borderRadius: 10,
                padding: '10px 0', fontWeight: 600, fontSize: 14,
                cursor: 'pointer', width: '100%',
              }}
            >
              Skip &amp; Go to Sales List
            </button>
          </div>
        </div>
      </div>
    </div>
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
  const [lines, setLines] = useState([{ ...EMPTY_ITEM }]);
  const [itemQueries, setItemQueries] = useState(['']);
  const [saving, setSaving] = useState(false);
  const [savedSale, setSavedSale] = useState(null);   // triggers the "Invoice Ready" dialog
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
          item: i.item, itemCode: i.itemCode, itemName: i.itemName,
          hsnCode: i.hsnCode, packingSize: i.packingSize,
          quantity: i.quantity, rate: i.rate, gstPercentage: i.gstPercentage,
        })));
        setItemQueries(s.items.map(i => i.itemName));
      }).catch(e => show(e.message, 'error'));
    }
  }, [id]);

  useEffect(() => {
    if (!isEdit && date) {
      getNextSaleInvoiceNumber(date)
        .then(res => {
          setInvoiceNumber(res.data);
        })
        .catch(e => show(e.message, 'error'));
    }
  }, [date, isEdit]);

  const fetchCustomers = async (q) => {
    const r = await getCustomers({ search: q });
    return r.data.map(c => ({ ...c, label: c.customerName, sub: c.gstNumber }));
  };

  const fetchItems = async (q) => {
    const r = await getItems({ search: q });
    return r.data.map(i => ({ ...i, label: i.itemName, sub: `${i.itemCode} · ${i.packingSize}` }));
  };

  const handleSelectCustomer = (c) => { setCustomer(c); setCustomerQuery(c.customerName); };

  const handleSelectItem = (idx, item) => {
    const newLines = [...lines];
    newLines[idx] = {
      ...newLines[idx],
      item: item._id, itemCode: item.itemCode, itemName: item.itemName,
      hsnCode: item.hsnCode, packingSize: item.packingSize,
      rate: item.salesPrice || 0, gstPercentage: item.gstPercentage || 18,
    };
    setLines(newLines);
    const newQ = [...itemQueries];
    newQ[idx] = item.itemName;
    setItemQueries(newQ);
  };

  const updateLine = (idx, key, value) => {
    const n = [...lines]; n[idx] = { ...n[idx], [key]: value }; setLines(n);
  };
  const addLine = () => {
    setLines([...lines, { ...EMPTY_ITEM }]);
    setItemQueries([...itemQueries, '']);
  };
  const removeLine = (idx) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== idx));
    setItemQueries(itemQueries.filter((_, i) => i !== idx));
  };

  const getTotals = () => {
    let subtotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    lines.forEach(l => {
      if (!l.item) return;
      const g = calculateLineItem(l.quantity, l.rate, l.gstPercentage, isInterState);
      subtotal += g.taxableAmount; totalCgst += g.cgst; totalSgst += g.sgst; totalIgst += g.igst;
    });
    const totalTax = totalCgst + totalSgst + totalIgst;
    return { subtotal, totalCgst, totalSgst, totalIgst, totalTax, grandTotal: subtotal + totalTax };
  };

  const totals = getTotals();

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
        // Attach customer info (not always populated in create response)
        sale.customerName    = sale.customerName    || customer.customerName;
        sale.customerGST     = sale.customerGST     || customer.gstNumber;
        sale.customerAddress = sale.customerAddress || customer.customerAddress;
        sale.customerPhone   = sale.customerPhone   || customer.customerPhone;
        setSavedSale(sale);   // show "Invoice Ready" dialog
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
            />
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
            <select
              className="form-control"
              value={isInterState ? 'inter' : 'intra'}
              onChange={e => setIsInterState(e.target.value === 'inter')}
            >
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
          <table className="invoice-table">
            <thead>
              <tr>
                <th style={{ width: 220 }}>Item Name</th>
                <th style={{ width: 100 }}>HSN Code</th>
                <th style={{ width: 110 }}>Packing Size</th>
                <th style={{ width: 80 }}>Qty</th>
                <th style={{ width: 110 }}>Rate (Rs.)</th>
                <th style={{ width: 80 }}>GST %</th>
                <th style={{ width: 110 }}>Taxable</th>
                <th style={{ width: 90 }}>Tax</th>
                <th style={{ width: 120 }}>Total (Rs.)</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const g = line.item
                  ? calculateLineItem(line.quantity, line.rate, line.gstPercentage, isInterState)
                  : null;
                return (
                  <tr key={idx}>
                    <td>
                      <AutocompleteInput
                        id={`sitem-${idx}`}
                        value={itemQueries[idx]}
                        onChange={v => { const q = [...itemQueries]; q[idx] = v; setItemQueries(q); }}
                        onSelect={(item) => handleSelectItem(idx, item)}
                        fetchSuggestions={fetchItems}
                        placeholder="Search item..."
                        displayKey="label"
                        subKey="sub"
                      />
                    </td>
                    <td>
                      <input className="form-control" value={line.hsnCode}
                        onChange={e => updateLine(idx, 'hsnCode', e.target.value)} placeholder="HSN" />
                    </td>
                    <td>
                      <input className="form-control" value={line.packingSize}
                        onChange={e => updateLine(idx, 'packingSize', e.target.value)} placeholder="Size" />
                    </td>
                    <td>
                      <input type="number" className="form-control" value={line.quantity}
                        onChange={e => updateLine(idx, 'quantity', e.target.value)} min={0.001} step="0.001" />
                    </td>
                    <td>
                      <input type="number" className="form-control" value={line.rate}
                        onChange={e => updateLine(idx, 'rate', e.target.value)} min={0} step="0.01" />
                    </td>
                    <td>
                      <select className="form-control" value={line.gstPercentage}
                        onChange={e => updateLine(idx, 'gstPercentage', Number(e.target.value))}>
                        {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
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
                      >×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Running Totals ───────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="totals-section" style={{ minWidth: 320 }}>
          <div className="totals-row"><span>Taxable Amount</span><span className="value">{formatCurrency(totals.subtotal)}</span></div>
          {isInterState
            ? <div className="totals-row"><span>IGST</span><span className="value">{formatCurrency(totals.totalIgst)}</span></div>
            : <>
                <div className="totals-row"><span>CGST</span><span className="value">{formatCurrency(totals.totalCgst)}</span></div>
                <div className="totals-row"><span>SGST</span><span className="value">{formatCurrency(totals.totalSgst)}</span></div>
              </>
          }
          <div className="totals-row"><span>Total Tax</span><span className="value">{formatCurrency(totals.totalTax)}</span></div>
          <div className="totals-row total"><span>Grand Total</span><span className="value">{formatCurrency(totals.grandTotal)}</span></div>
        </div>
      </div>
    </Layout>
  );
}
