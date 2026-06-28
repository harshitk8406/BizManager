import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/Layout/Layout';
import AutocompleteInput from '../../components/UI/AutocompleteInput';
import Toast, { useToast } from '../../components/UI/Toast';
import { getSuppliers } from '../../api/suppliers';
import { getItems } from '../../api/items';
import { createPurchase, getPurchaseById, updatePurchase, getNextPurchaseInvoiceNumber } from '../../api/purchases';
import { calculateLineItem } from '../../utils/gst';
import { formatCurrency, todayString, toInputDate } from '../../utils/format';
import { useFormShortcuts } from '../../hooks/useKeyboardShortcut';

const EMPTY_ITEM = { item: '', itemCode: '', itemName: '', hsnCode: '', packingSize: '', quantity: 1, rate: 0, gstPercentage: 18 };

export default function PurchaseForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplier, setSupplier] = useState(null);
  const [purchaseCode, setPurchaseCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(todayString());
  const [isInterState, setIsInterState] = useState(false);
  const [lines, setLines] = useState([{ ...EMPTY_ITEM }]);
  const [itemQueries, setItemQueries] = useState(['']);
  const [saving, setSaving] = useState(false);
  const { toast, show, hide } = useToast();

  useEffect(() => {
    if (isEdit) {
      getPurchaseById(id).then(r => {
        const p = r.data;
        setPurchaseCode(p.purchaseCode || '');
        setSupplierQuery(p.supplierName);
        setSupplier({ _id: p.supplier?._id || p.supplier, supplierName: p.supplierName, gstNumber: p.supplierGST, supplierAddress: p.supplierAddress, supplierPhone: p.supplierPhone });
        setInvoiceNumber(p.invoiceNumber);
        setDate(toInputDate(p.date));
        setIsInterState(p.isInterState || false);
        setLines(p.items.map(i => ({ item: i.item, itemCode: i.itemCode, itemName: i.itemName, hsnCode: i.hsnCode, packingSize: i.packingSize, quantity: i.quantity, rate: i.rate, gstPercentage: i.gstPercentage })));
        setItemQueries(p.items.map(i => i.itemName));
      }).catch(e => show(e.message, 'error'));
    }
  }, [id]);

  useEffect(() => {
    if (!isEdit && date) {
      getNextPurchaseInvoiceNumber(date)
        .then(res => {
          setInvoiceNumber(res.data);
        })
        .catch(e => show(e.message, 'error'));
    }
  }, [date, isEdit]);

  const fetchSuppliers = async (q) => {
    const r = await getSuppliers({ search: q });
    return r.data.map(s => ({ ...s, label: s.supplierName, sub: s.gstNumber }));
  };

  const fetchItems = async (q) => {
    const r = await getItems({ search: q });
    return r.data.map(i => ({ ...i, label: i.itemName, sub: `${i.itemCode} · ${i.packingSize}` }));
  };

  const handleSelectSupplier = (s) => { setSupplier(s); setSupplierQuery(s.supplierName); };

  const handleSelectItem = (idx, item) => {
    const newLines = [...lines];
    newLines[idx] = { ...newLines[idx], item: item._id, itemCode: item.itemCode, itemName: item.itemName, hsnCode: item.hsnCode, packingSize: item.packingSize, rate: item.purchasePrice || 0, gstPercentage: item.gstPercentage || 18 };
    setLines(newLines);
    const newQ = [...itemQueries];
    newQ[idx] = item.itemName;
    setItemQueries(newQ);
  };

  const updateLine = (idx, key, value) => { const n = [...lines]; n[idx] = { ...n[idx], [key]: value }; setLines(n); };
  const addLine = () => { setLines([...lines, { ...EMPTY_ITEM }]); setItemQueries([...itemQueries, '']); };
  const removeLine = (idx) => { if (lines.length === 1) return; setLines(lines.filter((_, i) => i !== idx)); setItemQueries(itemQueries.filter((_, i) => i !== idx)); };

  const getTotals = () => {
    let subtotal = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    lines.forEach(l => { if (!l.item) return; const g = calculateLineItem(l.quantity, l.rate, l.gstPercentage, isInterState); subtotal += g.taxableAmount; totalCgst += g.cgst; totalSgst += g.sgst; totalIgst += g.igst; });
    const totalTax = totalCgst + totalSgst + totalIgst;
    return { subtotal, totalCgst, totalSgst, totalIgst, totalTax, grandTotal: subtotal + totalTax };
  };

  const totals = getTotals();

  const handleSave = async () => {
    if (!supplier) { show('Please select a supplier', 'error'); return; }
    if (!invoiceNumber) { show('Please enter invoice number', 'error'); return; }
    if (!date) { show('Please select a date', 'error'); return; }
    const validLines = lines.filter(l => l.item);
    if (validLines.length === 0) { show('Please add at least one item', 'error'); return; }
    setSaving(true);
    const payload = {
      supplier: supplier._id, invoiceNumber, date, isInterState,
      items: validLines.map(l => ({ item: l.item, itemCode: l.itemCode, itemName: l.itemName, hsnCode: l.hsnCode, packingSize: l.packingSize, quantity: Number(l.quantity), rate: Number(l.rate), gstPercentage: Number(l.gstPercentage) })),
    };
    try {
      if (isEdit) { await updatePurchase(id, payload); show('Purchase updated'); }
      else { await createPurchase(payload); show('Purchase saved'); }
      setTimeout(() => navigate('/purchases'), 1000);
    } catch (e) { show(e.message, 'error'); }
    finally { setSaving(false); }
  };

  useFormShortcuts({ onSave: handleSave, onCancel: () => navigate('/purchases') });

  return (
    <Layout title={isEdit ? 'Edit Purchase' : 'New Purchase'}>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">{isEdit ? 'Edit Purchase' : 'New Purchase Entry'}</h2>
          <p className="page-subtitle">Record purchase invoice from supplier</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/purchases')}>Back</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} title="Save (Ctrl+Enter)">
            {saving
              ? <><span className="spinner"></span> Saving...</>
              : isEdit
                ? <span>Update <kbd style={{fontSize:10,opacity:0.7,marginLeft:6,background:'rgba(255,255,255,0.2)',padding:'1px 5px',borderRadius:3}}>Ctrl+↵</kbd></span>
                : <span>Save Purchase <kbd style={{fontSize:10,opacity:0.7,marginLeft:6,background:'rgba(255,255,255,0.2)',padding:'1px 5px',borderRadius:3}}>Ctrl+↵</kbd></span>}
          </button>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-header"><div className="card-title">Invoice Details</div></div>
        <div className="form-grid form-grid-3">
          <div className="form-group" style={{ gridColumn: '1 / span 2' }}>
            <label className="form-label">Supplier <span className="required">*</span></label>
            <AutocompleteInput id="supplier-search" value={supplierQuery} onChange={setSupplierQuery} onSelect={handleSelectSupplier} fetchSuggestions={fetchSuppliers} placeholder="Search supplier by name or GST..." displayKey="label" subKey="sub" autoFocus={!isEdit} />
          </div>
          <div className="form-group">
            <label className="form-label">Invoice Number <span className="required">*</span></label>
            <input className="form-control" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2024-001" />
          </div>
          <div className="form-group">
            <label className="form-label">Date <span className="required">*</span></label>
            <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Transaction Type</label>
            <select className="form-control" value={isInterState ? 'inter' : 'intra'} onChange={e => setIsInterState(e.target.value === 'inter')}>
              <option value="intra">Intra-State (CGST + SGST)</option>
              <option value="inter">Inter-State (IGST)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Purchase Code</label>
            <input className="form-control" value={purchaseCode} placeholder="Auto-generated" disabled />
          </div>
        </div>

        {supplier && (
          <div className="info-box">
            <div className="info-box-item"><div className="info-box-label">GST Number</div><div className="info-box-value">{supplier.gstNumber}</div></div>
            <div className="info-box-item"><div className="info-box-label">Name</div><div className="info-box-value">{supplier.supplierName}</div></div>
            {supplier.supplierAddress && <div className="info-box-item"><div className="info-box-label">Address</div><div className="info-box-value">{supplier.supplierAddress}</div></div>}
            {supplier.supplierPhone && <div className="info-box-item"><div className="info-box-label">Phone</div><div className="info-box-value">{supplier.supplierPhone}</div></div>}
          </div>
        )}
      </div>

      <div className="card mb-16">
        <div className="card-header"><div className="card-title">Purchase Items</div><button className="btn btn-secondary btn-sm" onClick={addLine}>+ Add Row</button></div>
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
                <th style={{ width: 110 }}>Taxable Amt</th>
                <th style={{ width: 90 }}>Tax</th>
                <th style={{ width: 120 }}>Total (Rs.)</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const g = line.item ? calculateLineItem(line.quantity, line.rate, line.gstPercentage, isInterState) : null;
                return (
                  <tr key={idx}>
                    <td><AutocompleteInput id={`item-${idx}`} value={itemQueries[idx]} onChange={v => { const q = [...itemQueries]; q[idx] = v; setItemQueries(q); }} onSelect={(item) => handleSelectItem(idx, item)} fetchSuggestions={fetchItems} placeholder="Search item..." displayKey="label" subKey="sub" /></td>
                    <td><input className="form-control" value={line.hsnCode} onChange={e => updateLine(idx, 'hsnCode', e.target.value)} placeholder="HSN" /></td>
                    <td><input className="form-control" value={line.packingSize} onChange={e => updateLine(idx, 'packingSize', e.target.value)} placeholder="Size" /></td>
                    <td><input type="number" className="form-control" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} min={0.001} step="0.001" /></td>
                    <td><input type="number" className="form-control" value={line.rate} onChange={e => updateLine(idx, 'rate', e.target.value)} min={0} step="0.01" /></td>
                    <td><select className="form-control" value={line.gstPercentage} onChange={e => updateLine(idx, 'gstPercentage', Number(e.target.value))} onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey && idx === lines.length - 1) { e.preventDefault(); addLine(); setTimeout(() => document.getElementById(`item-${idx + 1}`)?.focus(), 50); } }}>{[0,5,12,18,28].map(g => <option key={g} value={g}>{g}%</option>)}</select></td>
                    <td className="text-right fw-600">{g ? formatCurrency(g.taxableAmount) : '—'}</td>
                    <td className="text-right">{g ? <span title={isInterState ? `IGST: ${formatCurrency(g.igst)}` : `CGST: ${formatCurrency(g.cgst)} | SGST: ${formatCurrency(g.sgst)}`}>{formatCurrency(g.totalTax)}</span> : '—'}</td>
                    <td className="text-right fw-600 text-accent">{g ? formatCurrency(g.grandTotal) : '—'}</td>
                    <td><button className="btn btn-danger btn-sm btn-icon" onClick={() => removeLine(idx)} disabled={lines.length === 1}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="totals-section" style={{ minWidth: 320 }}>
          <div className="totals-row"><span>Taxable Amount</span><span className="value">{formatCurrency(totals.subtotal)}</span></div>
          {isInterState
            ? <div className="totals-row"><span>IGST</span><span className="value">{formatCurrency(totals.totalIgst)}</span></div>
            : <><div className="totals-row"><span>CGST</span><span className="value">{formatCurrency(totals.totalCgst)}</span></div>
              <div className="totals-row"><span>SGST</span><span className="value">{formatCurrency(totals.totalSgst)}</span></div></>}
          <div className="totals-row"><span>Total Tax</span><span className="value">{formatCurrency(totals.totalTax)}</span></div>
          <div className="totals-row total"><span>Grand Total</span><span className="value">{formatCurrency(totals.grandTotal)}</span></div>
        </div>
      </div>
    </Layout>
  );
}
