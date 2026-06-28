import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout/Layout';
import Toast, { useToast } from '../../components/UI/Toast';
import { getGSTR1, getGSTR3B } from '../../api/reports';
import { formatCurrency, formatDate } from '../../utils/format';
import { Chart, registerables } from 'chart.js';
import { useAuth } from '../../context/AuthContext';

Chart.register(...registerables);

/* ─── Helper row components ─────────────────────────────────── */
function TaxRow({ label, taxable, cgst, sgst, igst, tax, isHeader = false }) {
  const s = isHeader
    ? { background: 'var(--bg-tertiary)', fontWeight: 700, fontSize: 13 }
    : { fontWeight: 500, fontSize: 13 };
  return (
    <tr style={s}>
      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>{label}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid var(--border-light)' }}>{formatCurrency(taxable)}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid var(--border-light)' }}>{formatCurrency(cgst)}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid var(--border-light)' }}>{formatCurrency(sgst)}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid var(--border-light)' }}>{formatCurrency(igst)}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-light)' }}>{formatCurrency(tax)}</td>
    </tr>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ 
      background: 'linear-gradient(90deg, #f8fafc 0%, #ffffff 100%)', 
      borderLeft: '4px solid var(--accent-primary)',
      padding: '12px 18px', 
      borderRadius: '4px var(--radius-md) var(--radius-md) 4px', 
      marginBottom: 16, 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      borderTop: '1px solid var(--border-light)',
      borderRight: '1px solid var(--border-light)',
      borderBottom: '1px solid var(--border-light)',
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function TableHead({ cols }) {
  return (
    <thead>
      <tr style={{ background: 'var(--bg-tertiary)' }}>
        {cols.map((c, i) => (
          <th key={i} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', textAlign: c.right ? 'right' : 'left', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>{c.label}</th>
        ))}
      </tr>
    </thead>
  );
}

/* ─── GSTR-1 Tab ────────────────────────────────────────────── */
function GSTR1Tab({ activeFirm, onDownloaded }) {
  const [periodType, setPeriodType] = useState('monthly');
  const [quarter, setQuarter] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const { toast, show, hide } = useToast();

  const pieCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);
  const pieChartInstance = useRef(null);
  const barChartInstance = useRef(null);

  const handleGenerate = () => {
    setLoading(true);
    let fromStr, toStr;
    if (periodType === 'monthly') {
      const mStr = String(month).padStart(2, '0');
      fromStr = `${year}-${mStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      toStr = `${year}-${mStr}-${lastDay}`;
    } else {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;
      const startMStr = String(startMonth).padStart(2, '0');
      const endMStr = String(endMonth).padStart(2, '0');
      fromStr = `${year}-${startMStr}-01`;
      const lastDay = new Date(year, endMonth, 0).getDate();
      toStr = `${year}-${endMStr}-${lastDay}`;
    }
    getGSTR1({ from: fromStr, to: toStr })
      .then(r => setData(r.data))
      .catch(e => show(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  const handleDownloadJSON = () => {
    if (!data) return;
    const mStr = String(month).padStart(2, '0');
    const fp = `${mStr}${year}`;

    const formatDateForGST = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const calculateEffectiveGSTRate = (inv) => {
      if (!inv.taxableAmount) return 18;
      return Math.round((inv.totalTax / inv.taxableAmount) * 100);
    };

    const gstr1Payload = {
      gstin: activeFirm?.gstin || "08ANEPK2132Q2ZR",
      fp: fp,
      gt: 0.0,
      cur_gt: 0.0,
      b2b: data.b2b.map(cust => ({
        ctin: cust.gstNumber,
        inv: cust.invoices.map(inv => ({
          inum: inv.invoiceNumber,
          idt: formatDateForGST(inv.date),
          val: parseFloat(inv.totalAmount.toFixed(2)),
          pos: cust.gstNumber.substring(0, 2),
          rchrg: "N",
          inv_typ: "R",
          itms: [
            {
              num: 1,
              itm_det: {
                rt: calculateEffectiveGSTRate(inv),
                txval: parseFloat(inv.taxableAmount.toFixed(2)),
                iamt: parseFloat((inv.igst || 0).toFixed(2)),
                camt: parseFloat((inv.cgst || 0).toFixed(2)),
                samt: parseFloat((inv.sgst || 0).toFixed(2))
              }
            }
          ]
        }))
      })),
      b2cs: data.b2c.invoices.length > 0 ? [{
        rt: 18.0,
        sply_ty: "INTRA",
        pos: (activeFirm?.gstin || "08ANEPK2132Q2ZR").substring(0, 2),
        txval: parseFloat(data.b2c.totalTaxable.toFixed(2)),
        camt: parseFloat(data.b2c.totalCgst.toFixed(2)),
        samt: parseFloat(data.b2c.totalSgst.toFixed(2)),
        iamt: parseFloat(data.b2c.totalIgst.toFixed(2))
      }] : [],
      hsn: {
        data: data.hsnSummary.map((h, index) => ({
          num: index + 1,
          hsn_sc: h.hsnCode,
          desc: h.description,
          uqc: "OTH",
          qty: parseFloat(h.totalQuantity.toFixed(2)),
          val: parseFloat(h.totalAmount.toFixed(2)),
          txval: parseFloat(h.totalTaxable.toFixed(2)),
          iamt: parseFloat(h.totalIgst.toFixed(2)),
          camt: parseFloat(h.totalCgst.toFixed(2)),
          samt: parseFloat(h.totalSgst.toFixed(2))
        }))
      }
    };

    const blob = new Blob([JSON.stringify(gstr1Payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `${activeFirm?.gstin || '08ANEPK2132Q2ZR'}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onDownloaded(filename, 'gstr1');
  };

  const handleExportCSV = () => {
    if (!data) return;
    let csvContent = '\uFEFF'; // UTF-8 BOM
    
    // 1. B2B Section
    csvContent += '--- SECTION 1: B2B Invoices (Registered Customers) ---\n';
    csvContent += 'GSTIN of Recipient,Customer Name,# Invoices,Taxable Value,IGST,CGST,SGST,Total Tax,Invoice Value\n';
    data.b2b.forEach(b => {
      csvContent += `"${b.gstNumber}","${b.customerName}",${b.invoices.length},${b.totalTaxable},${b.totalIgst},${b.totalCgst},${b.totalSgst},${b.totalTax},${b.grandTotal}\n`;
    });
    csvContent += '\n';

    // 2. B2C Section
    csvContent += '--- SECTION 2: B2C Invoices (Unregistered / Retail Customers) ---\n';
    csvContent += 'Invoice No.,Date,Customer,Taxable,CGST,SGST,IGST,Total Tax,Total\n';
    data.b2c.invoices.forEach(inv => {
      csvContent += `"${inv.invoiceNumber}","${formatDate(inv.date)}","${inv.customerName}",${inv.taxableAmount},${data.b2c.totalCgst / (data.b2c.count || 1)},${data.b2c.totalSgst / (data.b2c.count || 1)},${data.b2c.totalIgst / (data.b2c.count || 1)},${inv.totalTax},${inv.totalAmount}\n`;
    });
    // B2C total
    if (data.b2c.count > 0) {
      csvContent += `B2C Total (${data.b2c.count} invoices),,,${data.b2c.totalTaxable},${data.b2c.totalCgst},${data.b2c.totalSgst},${data.b2c.totalIgst},${data.b2c.totalTax},${data.b2c.grandTotal}\n`;
    }
    csvContent += '\n';

    // 3. HSN Section
    csvContent += '--- SECTION 3: HSN-wise Summary ---\n';
    csvContent += 'HSN Code,Description,GST %,Total Qty,Taxable Value,CGST,SGST,IGST,Total Tax,Total Value\n';
    data.hsnSummary.forEach(h => {
      csvContent += `"${h.hsnCode}","${h.description}","${h.gstPercentage}%",${h.totalQuantity},${h.totalTaxable},${h.totalCgst},${h.totalSgst},${h.totalIgst},${h.totalTax},${h.totalAmount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_Report_${month}_${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (!data) return;
    
    let html = '<html><head><meta charset="utf-8"><style>table { border-collapse: collapse; font-family: Segoe UI, sans-serif; font-size: 10pt; } th { background-color: #052e16; color: white; padding: 6px 10px; } td { padding: 6px 10px; border: 1px solid #e5e7eb; }</style></head><body>';
    
    // B2B Table
    html += '<h3>Section 1: B2B Invoices (Registered Customers)</h3>';
    html += '<table><thead><tr><th>GSTIN of Recipient</th><th>Customer Name</th><th># Invoices</th><th>Taxable Value</th><th>IGST</th><th>CGST</th><th>SGST</th><th>Total Tax</th><th>Invoice Value</th></tr></thead><tbody>';
    data.b2b.forEach(b => {
      html += `<tr><td>${b.gstNumber}</td><td>${b.customerName}</td><td align="right">${b.invoices.length}</td><td align="right">${b.totalTaxable.toFixed(2)}</td><td align="right">${b.totalIgst.toFixed(2)}</td><td align="right">${b.totalCgst.toFixed(2)}</td><td align="right">${b.totalSgst.toFixed(2)}</td><td align="right">${b.totalTax.toFixed(2)}</td><td align="right">${b.grandTotal.toFixed(2)}</td></tr>`;
    });
    html += '</tbody></table><br/>';

    // B2C Table
    html += '<h3>Section 2: B2C Invoices (Retail Customers)</h3>';
    html += '<table><thead><tr><th>Invoice No.</th><th>Date</th><th>Customer</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total Tax</th><th>Total</th></tr></thead><tbody>';
    data.b2c.invoices.forEach(inv => {
      html += `<tr><td>${inv.invoiceNumber}</td><td>${formatDate(inv.date)}</td><td>${inv.customerName}</td><td align="right">${inv.taxableAmount.toFixed(2)}</td><td align="right">${(data.b2c.totalCgst / (data.b2c.count || 1)).toFixed(2)}</td><td align="right">${(data.b2c.totalSgst / (data.b2c.count || 1)).toFixed(2)}</td><td align="right">${(data.b2c.totalIgst / (data.b2c.count || 1)).toFixed(2)}</td><td align="right">${inv.totalTax.toFixed(2)}</td><td align="right">${inv.totalAmount.toFixed(2)}</td></tr>`;
    });
    if (data.b2c.count > 0) {
      html += `<tr style="font-weight:bold; background:#f3f4f6;"><td>B2C Total</td><td></td><td>${data.b2c.count} invoices</td><td align="right">${data.b2c.totalTaxable.toFixed(2)}</td><td align="right">${data.b2c.totalCgst.toFixed(2)}</td><td align="right">${data.b2c.totalSgst.toFixed(2)}</td><td align="right">${data.b2c.totalIgst.toFixed(2)}</td><td align="right">${data.b2c.totalTax.toFixed(2)}</td><td align="right">${data.b2c.grandTotal.toFixed(2)}</td></tr>`;
    }
    html += '</tbody></table><br/>';

    // HSN Table
    html += '<h3>Section 3: HSN-wise Summary</h3>';
    html += '<table><thead><tr><th>HSN Code</th><th>Description</th><th>GST %</th><th>Total Qty</th><th>Taxable Value</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total Tax</th><th>Total Value</th></tr></thead><tbody>';
    data.hsnSummary.forEach(h => {
      html += `<tr><td>${h.hsnCode}</td><td>${h.description}</td><td>${h.gstPercentage}%</td><td align="right">${h.totalQuantity}</td><td align="right">${h.totalTaxable.toFixed(2)}</td><td align="right">${h.totalCgst.toFixed(2)}</td><td align="right">${h.totalSgst.toFixed(2)}</td><td align="right">${h.totalIgst.toFixed(2)}</td><td align="right">${h.totalTax.toFixed(2)}</td><td align="right">${h.totalAmount.toFixed(2)}</td></tr>`;
    });
    html += '</tbody></table></body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_Report_${month}_${year}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (loading || !data || !showCharts) return;

    if (pieChartInstance.current) pieChartInstance.current.destroy();
    if (barChartInstance.current) barChartInstance.current.destroy();

    const b2bTaxable = data.b2b.reduce((s, x) => s + x.totalTaxable, 0);
    const b2cTaxable = data.b2c.totalTaxable;

    pieChartInstance.current = new Chart(pieCanvasRef.current.getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['B2B (Registered)', 'B2C (Retail)'],
        datasets: [{
          data: [b2bTaxable, b2cTaxable],
          backgroundColor: ['#2563eb', '#d97706'], // Blue vs Orange
          borderWidth: 1.5,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#374151',
              boxWidth: 12,
              font: { family: 'Inter', size: 11, weight: 500 }
            }
          },
          tooltip: {
            backgroundColor: '#111827',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 12 },
            callbacks: {
              label: (context) => ` Rs. ${context.raw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            }
          }
        }
      }
    });

    const rateTotals = {};
    data.hsnSummary.forEach(h => {
      const rateStr = `${h.gstPercentage}% GST`;
      rateTotals[rateStr] = (rateTotals[rateStr] || 0) + (h.totalTaxable || 0);
    });
    const barLabels = Object.keys(rateTotals).sort((a, b) => parseFloat(a) - parseFloat(b));
    const barData = barLabels.map(r => rateTotals[r]);

    barChartInstance.current = new Chart(barCanvasRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: [{
          label: 'Taxable Turnover',
          data: barData,
          backgroundColor: 'rgba(22, 163, 74, 0.8)', // Green
          borderColor: '#16a34a',
          borderWidth: 1.5,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 12 },
            callbacks: {
              label: (context) => ` Rs. ${context.raw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#6b7280',
              font: { family: 'Inter', size: 10 }
            }
          },
          y: {
            grid: { color: '#f3f4f6' },
            ticks: {
              color: '#6b7280',
              font: { family: 'Inter', size: 10 }
            }
          }
        }
      }
    });

    return () => {
      if (pieChartInstance.current) pieChartInstance.current.destroy();
      if (barChartInstance.current) barChartInstance.current.destroy();
    };
  }, [data, loading, showCharts]);

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      {/* Filter Card */}
      <div className="card mb-24" style={{ 
        padding: '28px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border)', 
        boxShadow: 'var(--shadow-sm)',
        background: 'var(--bg-secondary)',
        transition: 'var(--transition)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 className="card-title" style={{ marginBottom: 6, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(22, 163, 74, 0.1)', color: 'var(--accent-primary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </span>
                GSTR-1 — Outward Supplies Return
              </h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                Statement of outward supplies (sales) made during the tax period. Includes B2B, B2C and HSN-wise summary.
              </p>
            </div>
            
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '0.6px', 
              padding: '6px 12px', 
              borderRadius: '20px', 
              background: 'rgba(22, 163, 74, 0.1)', 
              color: 'var(--accent-primary)',
              border: '1px solid rgba(22, 163, 74, 0.15)'
            }}>
              Form GSTR-1
            </span>
          </div>

          {/* Clean Filter Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Period Type</label>
              <select className="form-control" value={periodType} onChange={e => setPeriodType(e.target.value)} style={{ height: '42px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '8px 12px', fontWeight: 500, fontSize: '14px', width: '100%', background: '#fff', cursor: 'pointer', transition: 'var(--transition)' }}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            {periodType === 'monthly' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Month</label>
                <select className="form-control" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ height: '42px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '8px 12px', fontWeight: 500, fontSize: '14px', width: '100%', background: '#fff', cursor: 'pointer', transition: 'var(--transition)' }}>
                  <option value={1}>January</option><option value={2}>February</option><option value={3}>March</option>
                  <option value={4}>April</option><option value={5}>May</option><option value={6}>June</option>
                  <option value={7}>July</option><option value={8}>August</option><option value={9}>September</option>
                  <option value={10}>October</option><option value={11}>November</option><option value={12}>December</option>
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Quarter</label>
                <select className="form-control" value={quarter} onChange={e => setQuarter(Number(e.target.value))} style={{ height: '42px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '8px 12px', fontWeight: 500, fontSize: '14px', width: '100%', background: '#fff', cursor: 'pointer', transition: 'var(--transition)' }}>
                  <option value={1}>Q1 (Jan - Mar)</option>
                  <option value={2}>Q2 (Apr - Jun)</option>
                  <option value={3}>Q3 (Jul - Sep)</option>
                  <option value={4}>Q4 (Oct - Dec)</option>
                </select>
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Year</label>
              <select className="form-control" value={year} onChange={e => setYear(Number(e.target.value))} style={{ height: '42px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '8px 12px', fontWeight: 500, fontSize: '14px', width: '100%', background: '#fff', cursor: 'pointer', transition: 'var(--transition)' }}>
                {[...Array(10)].map((_, i) => {
                  const y = new Date().getFullYear() - 5 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            
            {/* Generate Button */}
            <button 
              className="btn btn-primary" 
              onClick={handleGenerate} 
              disabled={loading}
              style={{ 
                height: '42px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px', 
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.15)',
                transition: 'var(--transition)',
                cursor: 'pointer'
              }}
            >
              {loading ? <><span className="spinner"></span> Generating...</> : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                  Generate GSTR-1
                </>
              )}
            </button>
          </div>

          {/* Dedicated Actions Toolbar */}
          {data && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              gap: '20px', 
              paddingTop: '24px', 
              borderTop: '1px solid var(--border-light)' 
            }}>
              {/* Left Side Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', fontWeight: 500, transition: 'var(--transition)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print
                </button>
                <button className="btn btn-secondary" onClick={() => setShowCharts(!showCharts)} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', fontWeight: 500, transition: 'var(--transition)' }}>
                  {showCharts ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      Hide Visuals
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Show Visuals
                    </>
                  )}
                </button>
                <span style={{ width: '1px', height: '24px', background: 'var(--border)', alignSelf: 'center', margin: '0 4px' }} />
                <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', fontWeight: 500, transition: 'var(--transition)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  CSV
                </button>
                <button className="btn btn-secondary" onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', fontWeight: 500, transition: 'var(--transition)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Excel
                </button>
              </div>

              {/* Right Side: Key Filing Call-to-Action */}
              <button 
                className="btn btn-primary" 
                onClick={handleDownloadJSON}
                style={{ 
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: 'var(--radius-md)',
                  transition: 'var(--transition)',
                  cursor: 'pointer'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download GST Filing JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {data && (
        <>
          {/* Summary boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {[
              { label: 'Total Invoices', value: data.totals.totalSales, sub: 'Outward transactions', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.05)', icon: 'SL' },
              { label: 'Taxable Turnover', value: formatCurrency(data.totals.totalTaxable), sub: 'Net taxable amount', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.05)', icon: 'TX' },
              { label: 'Total GST Collected', value: formatCurrency(data.totals.totalTax), sub: 'Output CGST+SGST+IGST', color: '#d97706', bg: 'rgba(217, 119, 6, 0.05)', icon: 'GT' },
              { label: 'Grand Total', value: formatCurrency(data.totals.grandTotal), sub: 'Gross sales value', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.05)', icon: 'GR' }
            ].map((stat, idx) => (
              <div key={idx} style={{
                background: '#fff',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: 'var(--shadow-sm)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'var(--transition)'
              }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: stat.color }} />
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: stat.bg,
                  color: stat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  flexShrink: 0
                }}>{stat.icon}</div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {stat.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showCharts && !loading && data && (
            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 className="card-title" style={{ marginBottom: 15, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Sales Breakdown (B2B vs B2C)</h3>
                <div style={{ position: 'relative', height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <canvas ref={pieCanvasRef}></canvas>
                </div>
              </div>
              <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 className="card-title" style={{ marginBottom: 15, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>GST Rate-wise Taxable Turnover</h3>
                <div style={{ position: 'relative', height: 250 }}>
                  <canvas ref={barCanvasRef}></canvas>
                </div>
              </div>
            </div>
          )}

          {/* B2B */}
          <div className="card mb-16" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid var(--border)' }}>
              <SectionHeader title="4A — B2B Invoices (Registered Customers)" subtitle="Sales to GST-registered businesses" />
            </div>
            <div className="table-wrapper">
              <table className="data-table" style={{ background: 'var(--bg-secondary)', width: '100%', borderCollapse: 'collapse' }}>
                <TableHead cols={[
                  { label: 'GSTIN of Recipient' }, { label: 'Customer Name' },
                  { label: '# Invoices', right: true }, { label: 'Taxable Value', right: true },
                  { label: 'IGST', right: true }, { label: 'CGST', right: true },
                  { label: 'SGST', right: true }, { label: 'Total Tax', right: true },
                  { label: 'Invoice Value', right: true },
                ]} />
                <tbody>
                  {data.b2b.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No B2B transactions in this period</td></tr>
                  )}
                  {data.b2b.map((b, i) => (
                    <tr key={i} style={{ transition: 'var(--transition)' }}>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-blue" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.gstNumber}</span></td>
                      <td className="fw-600" style={{ padding: '12px 14px' }}>{b.customerName}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif' }}>{b.invoices.length}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(b.totalTaxable)}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(b.totalIgst)}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(b.totalCgst)}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(b.totalSgst)}</td>
                      <td className="text-right text-warning fw-600" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(b.totalTax)}</td>
                      <td className="text-right text-accent fw-700" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(b.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* B2C */}
          <div className="card mb-16" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid var(--border)' }}>
              <SectionHeader title="5 — B2C Invoices (Retail / Unregistered Customers)" subtitle="Sales to cash / unregistered customers" />
            </div>
            <div className="table-wrapper">
              <table className="data-table" style={{ background: 'var(--bg-secondary)', width: '100%', borderCollapse: 'collapse' }}>
                <TableHead cols={[
                  { label: 'Invoice No.' }, { label: 'Date' }, { label: 'Customer' },
                  { label: 'Taxable', right: true }, { label: 'CGST', right: true },
                  { label: 'SGST', right: true }, { label: 'IGST', right: true },
                  { label: 'Total Tax', right: true }, { label: 'Total', right: true },
                ]} />
                <tbody>
                  {data.b2c.invoices.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No B2C transactions in this period</td></tr>
                  )}
                  {data.b2c.invoices.map((inv, i) => (
                    <tr key={i} style={{ transition: 'var(--transition)' }}>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-warning" style={{ fontWeight: 600 }}>{inv.invoiceNumber}</span></td>
                      <td style={{ padding: '12px 14px' }}>{formatDate(inv.date)}</td>
                      <td style={{ padding: '12px 14px' }}>{inv.customerName}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(inv.taxableAmount)}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(data.b2c.totalCgst / (data.b2c.count || 1))}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(data.b2c.totalSgst / (data.b2c.count || 1))}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(data.b2c.totalIgst / (data.b2c.count || 1))}</td>
                      <td className="text-right text-warning fw-600" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(inv.totalTax)}</td>
                      <td className="text-right text-accent fw-700" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(inv.totalAmount)}</td>
                    </tr>
                  ))}
                  {data.b2c.count > 0 && (
                    <tr style={{ background: 'var(--bg-tertiary)', borderTop: '2px solid var(--border-accent)' }}>
                      <td colSpan={3} className="fw-700" style={{ padding: '14px' }}>B2C Total ({data.b2c.count} invoices)</td>
                      <td className="text-right fw-700" style={{ padding: '14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(data.b2c.totalTaxable)}</td>
                      <td className="text-right fw-700" style={{ padding: '14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(data.b2c.totalCgst)}</td>
                      <td className="text-right fw-700" style={{ padding: '14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(data.b2c.totalSgst)}</td>
                      <td className="text-right fw-700" style={{ padding: '14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(data.b2c.totalIgst)}</td>
                      <td className="text-right fw-700 text-warning" style={{ padding: '14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(data.b2c.totalTax)}</td>
                      <td className="text-right fw-800 text-accent" style={{ padding: '14px', fontSize: 15, fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(data.b2c.grandTotal)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* HSN Summary */}
          <div className="card" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid var(--border)' }}>
              <SectionHeader title="12 — HSN-wise Summary" subtitle="Summary of outward supplies organised by HSN code" />
            </div>
            <div className="table-wrapper">
              <table className="data-table" style={{ background: 'var(--bg-secondary)', width: '100%', borderCollapse: 'collapse' }}>
                <TableHead cols={[
                  { label: 'HSN Code' }, { label: 'Description' }, { label: 'GST %' },
                  { label: 'Total Qty', right: true }, { label: 'Taxable Value', right: true },
                  { label: 'CGST', right: true }, { label: 'SGST', right: true },
                  { label: 'IGST', right: true }, { label: 'Total Tax', right: true },
                  { label: 'Total Value', right: true },
                ]} />
                <tbody>
                  {data.hsnSummary.map((h, i) => (
                    <tr key={i} style={{ transition: 'var(--transition)' }}>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-purple" style={{ fontWeight: 600 }}>{h.hsnCode}</span></td>
                      <td className="fw-600" style={{ padding: '12px 14px' }}>{h.description}</td>
                      <td style={{ padding: '12px 14px' }}><span className="badge badge-teal" style={{ fontWeight: 600 }}>{h.gstPercentage}%</span></td>
                      <td className="text-right fw-600" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{h.totalQuantity.toFixed(3)}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(h.totalTaxable)}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(h.totalCgst)}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(h.totalSgst)}</td>
                      <td className="text-right" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(h.totalIgst)}</td>
                      <td className="text-right text-warning fw-600" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(h.totalTax)}</td>
                      <td className="text-right text-accent fw-700" style={{ padding: '12px 14px', fontFamily: 'Inter, -apple-system, sans-serif', fontFeatureSettings: '"tnum"' }}>{formatCurrency(h.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="empty-state" style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(22, 163, 74, 0.08)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>G1</div>
          <div className="empty-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Select Period &amp; Generate GSTR-1</div>
          <div className="empty-subtitle" style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '380px', lineHeight: '1.5' }}>Choose the tax period type, month/quarter, and year above, then click the Generate button to load outward supplies.</div>
        </div>
      )}
    </>
  );
}

/* ─── GSTR-3B Tab ───────────────────────────────────────────── */
function GSTR3BTab({ activeFirm, onDownloaded }) {
  const [periodType, setPeriodType] = useState('monthly');
  const [quarter, setQuarter] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const { toast, show, hide } = useToast();

  const pieCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);
  const pieChartInstance = useRef(null);
  const barChartInstance = useRef(null);

  const handleGenerate = () => {
    setLoading(true);
    let fromStr, toStr;
    if (periodType === 'monthly') {
      const mStr = String(month).padStart(2, '0');
      fromStr = `${year}-${mStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      toStr = `${year}-${mStr}-${lastDay}`;
    } else {
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;
      const startMStr = String(startMonth).padStart(2, '0');
      const endMStr = String(endMonth).padStart(2, '0');
      fromStr = `${year}-${startMStr}-01`;
      const lastDay = new Date(year, endMonth, 0).getDate();
      toStr = `${year}-${endMStr}-${lastDay}`;
    }
    getGSTR3B({ from: fromStr, to: toStr })
      .then(r => setData(r.data))
      .catch(e => show(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  const handleDownloadJSON = () => {
    if (!data) return;
    const mStr = String(month).padStart(2, '0');
    const fp = `${mStr}${year}`;

    const gstr3bPayload = {
      gstin: activeFirm?.gstin || "08ANEPK2132Q2ZR",
      fp: fp,
      sup_details: {
        osup_det: {
          txval: parseFloat((data.outward?.total?.taxable || 0).toFixed(2)),
          iamt: parseFloat((data.outward?.total?.igst || 0).toFixed(2)),
          camt: parseFloat((data.outward?.total?.cgst || 0).toFixed(2)),
          samt: parseFloat((data.outward?.total?.sgst || 0).toFixed(2)),
          csamt: 0.0
        },
        osup_zero: { txval: 0.0, iamt: 0.0, csamt: 0.0 },
        osup_nil_exmp: { txval: 0.0 },
        isup_rev: { txval: 0.0, iamt: 0.0, camt: 0.0, samt: 0.0, csamt: 0.0 },
        osup_nongst: { txval: 0.0 }
      },
      itc_elg: {
        itc_avl: [
          { ty: "IMPG", iamt: 0.0, csamt: 0.0 },
          { ty: "IMPS", iamt: 0.0, csamt: 0.0 },
          { ty: "ISRC", iamt: 0.0, camt: 0.0, samt: 0.0, csamt: 0.0 },
          { ty: "ISD", iamt: 0.0, csamt: 0.0 },
          {
            ty: "OTH",
            iamt: parseFloat((data.itc?.total?.igst || 0).toFixed(2)),
            camt: parseFloat((data.itc?.total?.cgst || 0).toFixed(2)),
            samt: parseFloat((data.itc?.total?.sgst || 0).toFixed(2)),
            csamt: 0.0
          }
        ],
        itc_rev: [
          { ty: "RUL", iamt: 0.0, camt: 0.0, samt: 0.0, csamt: 0.0 },
          { ty: "OTH", iamt: 0.0, camt: 0.0, samt: 0.0, csamt: 0.0 }
        ],
        itc_net: {
          iamt: parseFloat((data.itc?.total?.igst || 0).toFixed(2)),
          camt: parseFloat((data.itc?.total?.cgst || 0).toFixed(2)),
          samt: parseFloat((data.itc?.total?.sgst || 0).toFixed(2)),
          csamt: 0.0
        },
        itc_inelg: [
          { ty: "RUL", iamt: 0.0, camt: 0.0, samt: 0.0, csamt: 0.0 },
          { ty: "OTH", iamt: 0.0, camt: 0.0, samt: 0.0, csamt: 0.0 }
        ]
      }
    };

    const blob = new Blob([JSON.stringify(gstr3bPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `${activeFirm?.gstin || '08ANEPK2132Q2ZR'}.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onDownloaded(filename, 'gstr3b');
  };

  const handleExportCSV = () => {
    if (!data) return;
    let csvContent = '\uFEFF';

    // Table 3.1
    csvContent += '--- Table 3.1: Outward Taxable Supplies (Sales) ---\n';
    csvContent += 'Nature of Supplies,Taxable Value,CGST,SGST / UTGST,IGST,Total Tax\n';
    csvContent += `"(a) Intra-State Supplies",${data.outward.intraState.taxable},${data.outward.intraState.cgst},${data.outward.intraState.sgst},0,${data.outward.intraState.cgst + data.outward.intraState.sgst}\n`;
    csvContent += `"(b) Inter-State Supplies",${data.outward.interState.taxable},0,0,${data.outward.interState.igst},${data.outward.interState.igst}\n`;
    csvContent += `"Total Outward Supplies",${data.outward.total.taxable},${data.outward.total.cgst},${data.outward.total.sgst},${data.outward.total.igst},${data.outward.total.tax}\n`;
    csvContent += '\n';

    // Table 4
    csvContent += '--- Table 4: Input Tax Credit (ITC) Available (Purchases) ---\n';
    csvContent += 'Nature of Inward Supplies,Taxable Value,CGST,SGST / UTGST,IGST,Total ITC\n';
    csvContent += `"(A) Intra-State Purchases",${data.itc.intraState.taxable},${data.itc.intraState.cgst},${data.itc.intraState.sgst},0,${data.itc.intraState.cgst + data.itc.intraState.sgst}\n`;
    csvContent += `"(B) Inter-State Purchases",${data.itc.interState.taxable},0,0,${data.itc.interState.igst},${data.itc.interState.igst}\n`;
    csvContent += `"Total ITC Available",${data.itc.total.taxable},${data.itc.total.cgst},${data.itc.total.sgst},${data.itc.total.igst},${data.itc.total.tax}\n`;
    csvContent += '\n';

    // Net Tax Payable
    csvContent += '--- Net Tax Payable (Output Tax - ITC) ---\n';
    csvContent += 'CGST Payable,SGST / UTGST Payable,IGST Payable,Total Net Tax Payable\n';
    csvContent += `${data.net.cgst},${data.net.sgst},${data.net.igst},${data.net.total}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR3B_Report_${month}_${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (!data) return;
    let html = '<html><head><meta charset="utf-8"><style>table { border-collapse: collapse; font-family: Segoe UI, sans-serif; font-size: 10pt; } th { background-color: #052e16; color: white; padding: 6px 10px; } td { padding: 6px 10px; border: 1px solid #e5e7eb; }</style></head><body>';

    // Table 3.1
    html += '<h3>Table 3.1: Outward Taxable Supplies (Sales)</h3>';
    html += '<table><thead><tr><th>Nature of Supplies</th><th>Taxable Value</th><th>CGST</th><th>SGST / UTGST</th><th>IGST</th><th>Total Tax</th></tr></thead><tbody>';
    html += `<tr><td>(a) Intra-State Supplies</td><td align="right">${data.outward.intraState.taxable.toFixed(2)}</td><td align="right">${data.outward.intraState.cgst.toFixed(2)}</td><td align="right">${data.outward.intraState.sgst.toFixed(2)}</td><td align="right">0.00</td><td align="right">${(data.outward.intraState.cgst + data.outward.intraState.sgst).toFixed(2)}</td></tr>`;
    html += `<tr><td>(b) Inter-State Supplies</td><td align="right">${data.outward.interState.taxable.toFixed(2)}</td><td align="right">0.00</td><td align="right">0.00</td><td align="right">${data.outward.interState.igst.toFixed(2)}</td><td align="right">${data.outward.interState.igst.toFixed(2)}</td></tr>`;
    html += `<tr style="font-weight:bold; background:#f3f4f6;"><td>Total Outward Supplies</td><td align="right">${data.outward.total.taxable.toFixed(2)}</td><td align="right">${data.outward.total.cgst.toFixed(2)}</td><td align="right">${data.outward.total.sgst.toFixed(2)}</td><td align="right">${data.outward.total.igst.toFixed(2)}</td><td align="right">${data.outward.total.tax.toFixed(2)}</td></tr>`;
    html += '</tbody></table><br/>';

    // Table 4
    html += '<h3>Table 4: Input Tax Credit (ITC) Available (Purchases)</h3>';
    html += '<table><thead><tr><th>Nature of Inward Supplies</th><th>Taxable Value</th><th>CGST</th><th>SGST / UTGST</th><th>IGST</th><th>Total ITC</th></tr></thead><tbody>';
    html += `<tr><td>(A) Intra-State Purchases</td><td align="right">${data.itc.intraState.taxable.toFixed(2)}</td><td align="right">${data.itc.intraState.cgst.toFixed(2)}</td><td align="right">${data.itc.intraState.sgst.toFixed(2)}</td><td align="right">0.00</td><td align="right">${(data.itc.intraState.cgst + data.itc.intraState.sgst).toFixed(2)}</td></tr>`;
    html += `<tr><td>(B) Inter-State Purchases</td><td align="right">${data.itc.interState.taxable.toFixed(2)}</td><td align="right">0.00</td><td align="right">0.00</td><td align="right">${data.itc.interState.igst.toFixed(2)}</td><td align="right">${data.itc.interState.igst.toFixed(2)}</td></tr>`;
    html += `<tr style="font-weight:bold; background:#f3f4f6;"><td>Total ITC Available</td><td align="right">${data.itc.total.taxable.toFixed(2)}</td><td align="right">${data.itc.total.cgst.toFixed(2)}</td><td align="right">${data.itc.total.sgst.toFixed(2)}</td><td align="right">${data.itc.total.igst.toFixed(2)}</td><td align="right">${data.itc.total.tax.toFixed(2)}</td></tr>`;
    html += '</tbody></table><br/>';

    // Net Tax
    html += '<h3>Net Tax Payable (Output Tax - ITC)</h3>';
    html += '<table><thead><tr><th>CGST Payable</th><th>SGST / UTGST Payable</th><th>IGST Payable</th><th>Total Net Tax Payable</th></tr></thead><tbody>';
    html += `<tr><td align="right">${data.net.cgst.toFixed(2)}</td><td align="right">${data.net.sgst.toFixed(2)}</td><td align="right">${data.net.igst.toFixed(2)}</td><td align="right" style="font-weight:bold; color:#16a34a;">${data.net.total.toFixed(2)}</td></tr>`;
    html += '</tbody></table></body></html>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR3B_Report_${month}_${year}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (loading || !data || !showCharts) return;

    if (pieChartInstance.current) pieChartInstance.current.destroy();
    if (barChartInstance.current) barChartInstance.current.destroy();

    const outputTax = data.outward.total.tax;
    const inputITC = data.itc.total.tax;

    // Output Tax vs ITC (Pie Chart)
    pieChartInstance.current = new Chart(pieCanvasRef.current.getContext('2d'), {
      type: 'pie',
      data: {
        labels: ['Output Tax (Sales)', 'Input Tax Credit (ITC)'],
        datasets: [{
          data: [outputTax, inputITC],
          backgroundColor: ['#dc2626', '#16a34a'], // Red vs Green
          borderWidth: 1.5,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#374151',
              boxWidth: 12,
              font: { family: 'Inter', size: 11, weight: 500 }
            }
          },
          tooltip: {
            backgroundColor: '#111827',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 12 },
            callbacks: {
              label: (context) => ` Rs. ${context.raw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            }
          }
        }
      }
    });

    // CGST vs SGST vs IGST Component Comparison (Grouped Bar Chart)
    barChartInstance.current = new Chart(barCanvasRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['CGST', 'SGST / UTGST', 'IGST'],
        datasets: [
          {
            label: 'Output Tax (Sales)',
            data: [data.outward.total.cgst, data.outward.total.sgst, data.outward.total.igst],
            backgroundColor: 'rgba(220, 38, 38, 0.8)', // Red
            borderColor: '#dc2626',
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: 'Input Tax Credit (ITC)',
            data: [data.itc.total.cgst, data.itc.total.sgst, data.itc.total.igst],
            backgroundColor: 'rgba(22, 163, 74, 0.8)', // Green
            borderColor: '#16a34a',
            borderWidth: 1.5,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#374151',
              font: { family: 'Inter', size: 10, weight: 500 }
            }
          },
          tooltip: {
            backgroundColor: '#111827',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 12 },
            callbacks: {
              label: (context) => ` ${context.dataset.label}: Rs. ${context.raw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#6b7280',
              font: { family: 'Inter', size: 10 }
            }
          },
          y: {
            grid: { color: '#f3f4f6' },
            ticks: {
              color: '#6b7280',
              font: { family: 'Inter', size: 10 }
            }
          }
        }
      }
    });

    return () => {
      if (pieChartInstance.current) pieChartInstance.current.destroy();
      if (barChartInstance.current) barChartInstance.current.destroy();
    };
  }, [data, loading, showCharts]);

  const cellStyle = (highlight) => ({
    padding: '11px 14px',
    textAlign: 'right',
    fontWeight: highlight ? 700 : 500,
    color: highlight ? 'var(--accent-primary)' : 'var(--text-primary)',
    borderBottom: '1px solid var(--border-light)',
    fontSize: 13,
  });

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      {/* Filter Card */}
      <div className="card mb-24" style={{ 
        padding: '28px', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border)', 
        boxShadow: 'var(--shadow-sm)',
        background: 'var(--bg-secondary)',
        transition: 'var(--transition)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-light)', paddingBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 className="card-title" style={{ marginBottom: 6, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(22, 163, 74, 0.1)', color: 'var(--accent-primary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </span>
                GSTR-3B — Monthly Summary Return
              </h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                Consolidated summary of outward supplies (sales), inward supplies (purchases/ITC), and net tax payable for the selected period.
              </p>
            </div>
            
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '0.6px', 
              padding: '6px 12px', 
              borderRadius: '20px', 
              background: 'rgba(22, 163, 74, 0.1)', 
              color: 'var(--accent-primary)',
              border: '1px solid rgba(22, 163, 74, 0.15)'
            }}>
              Form GSTR-3B
            </span>
          </div>

          {/* Clean Filter Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Period Type</label>
              <select className="form-control" value={periodType} onChange={e => setPeriodType(e.target.value)} style={{ height: '42px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '8px 12px', fontWeight: 500, fontSize: '14px', width: '100%', background: '#fff', cursor: 'pointer', transition: 'var(--transition)' }}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            {periodType === 'monthly' ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Month</label>
                <select className="form-control" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ height: '42px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '8px 12px', fontWeight: 500, fontSize: '14px', width: '100%', background: '#fff', cursor: 'pointer', transition: 'var(--transition)' }}>
                  <option value={1}>January</option><option value={2}>February</option><option value={3}>March</option>
                  <option value={4}>April</option><option value={5}>May</option><option value={6}>June</option>
                  <option value={7}>July</option><option value={8}>August</option><option value={9}>September</option>
                  <option value={10}>October</option><option value={11}>November</option><option value={12}>December</option>
                </select>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Quarter</label>
                <select className="form-control" value={quarter} onChange={e => setQuarter(Number(e.target.value))} style={{ height: '42px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '8px 12px', fontWeight: 500, fontSize: '14px', width: '100%', background: '#fff', cursor: 'pointer', transition: 'var(--transition)' }}>
                  <option value={1}>Q1 (Jan - Mar)</option>
                  <option value={2}>Q2 (Apr - Jun)</option>
                  <option value={3}>Q3 (Jul - Sep)</option>
                  <option value={4}>Q4 (Oct - Dec)</option>
                </select>
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Year</label>
              <select className="form-control" value={year} onChange={e => setYear(Number(e.target.value))} style={{ height: '42px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '8px 12px', fontWeight: 500, fontSize: '14px', width: '100%', background: '#fff', cursor: 'pointer', transition: 'var(--transition)' }}>
                {[...Array(10)].map((_, i) => {
                  const y = new Date().getFullYear() - 5 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
            
            {/* Generate Button */}
            <button 
              className="btn btn-primary" 
              onClick={handleGenerate} 
              disabled={loading}
              style={{ 
                height: '42px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px', 
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.15)',
                transition: 'var(--transition)',
                cursor: 'pointer'
              }}
            >
              {loading ? <><span className="spinner"></span> Generating...</> : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                  Generate GSTR-3B
                </>
              )}
            </button>
          </div>

          {/* Dedicated Actions Toolbar */}
          {data && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              gap: '20px', 
              paddingTop: '24px', 
              borderTop: '1px solid var(--border-light)' 
            }}>
              {/* Left Side Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', fontWeight: 500, transition: 'var(--transition)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print
                </button>
                <button className="btn btn-secondary" onClick={() => setShowCharts(!showCharts)} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', fontWeight: 500, transition: 'var(--transition)' }}>
                  {showCharts ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      Hide Visuals
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      Show Visuals
                    </>
                  )}
                </button>
                <span style={{ width: '1px', height: '24px', background: 'var(--border)', alignSelf: 'center', margin: '0 4px' }} />
                <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', fontWeight: 500, transition: 'var(--transition)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  CSV
                </button>
                <button className="btn btn-secondary" onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px', padding: '0 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', fontWeight: 500, transition: 'var(--transition)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Excel
                </button>
              </div>

              {/* Right Side: Key Filing Call-to-Action */}
              <button 
                className="btn btn-primary" 
                onClick={handleDownloadJSON}
                style={{ 
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: 'var(--radius-md)',
                  transition: 'var(--transition)',
                  cursor: 'pointer'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download GST Filing JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {data && (
        <>
          {/* Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {[
              { label: 'Sales Invoices', value: data.counts.sales, sub: 'Outward invoices count', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.05)', icon: 'SL' },
              { label: 'Purchase Invoices', value: data.counts.purchases, sub: 'Inward invoices count', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.05)', icon: 'PU' },
              { label: 'Output Tax (Sales)', value: formatCurrency(data.outward.total.tax), sub: 'Total liability collected', color: '#d97706', bg: 'rgba(217, 119, 6, 0.05)', icon: 'OT' },
              { label: 'Net Tax Payable', value: formatCurrency(data.net.total), sub: 'Tax liability after ITC', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.05)', icon: 'NT' }
            ].map((stat, idx) => (
              <div key={idx} style={{
                background: '#fff',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: 'var(--shadow-sm)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'var(--transition)'
              }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: stat.color }} />
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: stat.bg,
                  color: stat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '14px',
                  flexShrink: 0
                }}>{stat.icon}</div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {stat.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showCharts && !loading && data && (
            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 className="card-title" style={{ marginBottom: 15, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Tax Liability vs ITC (Rs.)</h3>
                <div style={{ position: 'relative', height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <canvas ref={pieCanvasRef}></canvas>
                </div>
              </div>
              <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 className="card-title" style={{ marginBottom: 15, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Tax Components Breakdown (Output vs Input)</h3>
                <div style={{ position: 'relative', height: 250 }}>
                  <canvas ref={barCanvasRef}></canvas>
                </div>
              </div>
            </div>
          )}

          {/* Table 3.1 — Outward Supplies */}
          <div className="card mb-16" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid var(--border)' }}>
              <SectionHeader title="Table 3.1 — Outward Taxable Supplies (Sales)" subtitle="Details of outward supplies made during the period" />
            </div>
            <div className="table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-secondary)' }}>
                <TableHead cols={[
                  { label: 'Nature of Supplies' },
                  { label: 'Taxable Value', right: true },
                  { label: 'CGST', right: true },
                  { label: 'SGST / UTGST', right: true },
                  { label: 'IGST', right: true },
                  { label: 'Total Tax', right: true },
                ]} />
                <tbody>
                  <TaxRow label="(a) Intra-State Supplies" taxable={data.outward.intraState.taxable} cgst={data.outward.intraState.cgst} sgst={data.outward.intraState.sgst} igst={0} tax={data.outward.intraState.cgst + data.outward.intraState.sgst} />
                  <TaxRow label="(b) Inter-State Supplies" taxable={data.outward.interState.taxable} cgst={0} sgst={0} igst={data.outward.interState.igst} tax={data.outward.interState.igst} />
                  <TaxRow label="Total Outward Supplies" taxable={data.outward.total.taxable} cgst={data.outward.total.cgst} sgst={data.outward.total.sgst} igst={data.outward.total.igst} tax={data.outward.total.tax} isHeader />
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 4 — ITC */}
          <div className="card mb-16" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid var(--border)' }}>
              <SectionHeader title="Table 4 — Input Tax Credit (ITC) Available — Purchases" subtitle="ITC available from inward supplies (purchases) eligible for credit" />
            </div>
            <div className="table-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-secondary)' }}>
                <TableHead cols={[
                  { label: 'Nature of Inward Supplies' },
                  { label: 'Taxable Value', right: true },
                  { label: 'CGST', right: true },
                  { label: 'SGST / UTGST', right: true },
                  { label: 'IGST', right: true },
                  { label: 'Total ITC', right: true },
                ]} />
                <tbody>
                  <TaxRow label="(A) Intra-State Purchases" taxable={data.itc.intraState.taxable} cgst={data.itc.intraState.cgst} sgst={data.itc.intraState.sgst} igst={0} tax={data.itc.intraState.cgst + data.itc.intraState.sgst} />
                  <TaxRow label="(B) Inter-State Purchases" taxable={data.itc.interState.taxable} cgst={0} sgst={0} igst={data.itc.interState.igst} tax={data.itc.interState.igst} />
                  <TaxRow label="Total ITC Available" taxable={data.itc.total.taxable} cgst={data.itc.total.cgst} sgst={data.itc.total.sgst} igst={data.itc.total.igst} tax={data.itc.total.tax} isHeader />
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Tax Payable */}
          <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <SectionHeader title="Net Tax Payable (Output Tax - ITC)" subtitle="Tax liability after adjusting Input Tax Credit" />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: '20px' }}>
              {[
                { label: 'CGST Payable', value: data.net.cgst, color: 'var(--blue)', bg: 'rgba(37, 99, 235, 0.05)' },
                { label: 'SGST / UTGST Payable', value: data.net.sgst, color: 'var(--accent-primary)', bg: 'rgba(22, 163, 74, 0.05)' },
                { label: 'IGST Payable', value: data.net.igst, color: 'var(--purple)', bg: 'rgba(124, 58, 237, 0.05)' },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, minWidth: 180, background: item.bg, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 20px', transition: 'var(--transition)' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)', fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: item.color, marginTop: 6, fontFamily: 'Inter, -apple-system, sans-serif' }}>{formatCurrency(item.value)}</div>
                </div>
              ))}
              <div style={{ flex: 1, minWidth: 180, background: '#064e3b', borderRadius: 'var(--radius-md)', padding: '16px 20px', boxShadow: '0 4px 12px rgba(6, 78, 59, 0.2)', transition: 'var(--transition)' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: 0.6, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Total Net Tax Payable</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#34d399', marginTop: 6, fontFamily: 'Inter, -apple-system, sans-serif' }}>{formatCurrency(data.net.total)}</div>
              </div>
            </div>
            <div style={{ marginTop: 20, fontSize: '12.5px', color: 'var(--warning)', padding: '12px 16px', background: 'var(--warning-dim)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(217,119,6,0.18)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>Note: This report is for reference only. Negative values indicate excess ITC. Please verify with your CA/Tax consultant before filing.</span>
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="empty-state" style={{ minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(22, 163, 74, 0.08)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>3B</div>
          <div className="empty-title" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Select Period &amp; Generate GSTR-3B</div>
          <div className="empty-subtitle" style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '380px', lineHeight: '1.5' }}>Choose the tax period and click the Generate button to see the consolidated summary return.</div>
        </div>
      )}
    </>
  );
}

/* ─── Instructions Modal Component ───────────────────────────── */
function InstructionsModal({ isOpen, onClose, reportType, fileName }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-xl)',
        width: '90%',
        maxWidth: '650px',
        maxHeight: '90vh',
        overflowY: 'auto',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
          color: '#fff',
          borderTopLeftRadius: '19px',
          borderTopRightRadius: '19px',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.3px' }}>
              <span>📥</span> {reportType === 'gstr1' ? 'GSTR-1' : 'GSTR-3B'} Return File Downloaded!
            </h3>
            <span style={{ fontSize: '11.5px', opacity: 0.85, marginTop: '4px', display: 'inline-block', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
              Filename: {fileName}
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'var(--transition)'
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '28px', overflowY: 'auto' }}>
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginBottom: '28px',
            fontSize: '13.5px',
            lineHeight: '1.6',
            color: 'var(--text-secondary)',
          }}>
            <strong>What just happened?</strong> We packaged all your sales, purchases, and tax records into an officially structured tax file. Now, you can upload it directly to the government's portal to file your return for free.
          </div>

          <h4 style={{ margin: '0 0 20px 0', fontSize: '15px', color: 'var(--text-primary)', fontWeight: 700 }}>
            Follow these simple steps to upload and file:
          </h4>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              {
                step: 1,
                title: 'Log in to the GST Portal',
                desc: <>Go to <a href="https://www.gst.gov.in" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'underline' }}>www.gst.gov.in</a> and log in with your taxpayer username and password.</>
              },
              {
                step: 2,
                title: 'Navigate to the Returns Dashboard',
                desc: <>Go to <strong>Services &gt; Returns &gt; Returns Dashboard</strong>. Select the Financial Year, Quarter, and Month you want to file, then click <strong>Search</strong>.</>
              },
              {
                step: 3,
                title: 'Select "Prepare Offline"',
                desc: <>Under <strong>{reportType === 'gstr1' ? 'Details of outward supplies of goods or services (GSTR-1)' : 'Monthly Return (GSTR-3B)'}</strong>, click the <strong>Prepare Offline</strong> button.</>
              },
              {
                step: 4,
                title: 'Upload the Downloaded File',
                desc: <>Click <strong>Choose File</strong> and select the <code>{fileName}</code> you just downloaded. It will upload instantly.</>
              },
              {
                step: 5,
                title: 'Verify and Submit Return',
                desc: <>Wait 1-2 minutes for the system to process the file. Go back to the dashboard, open <strong>Prepare Online</strong>, verify the tables are filled automatically, and click <strong>File Return</strong> with OTP/DSC.</>
              }
            ].map((step, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '16px' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  flexShrink: 0,
                  fontSize: '13.5px',
                  boxShadow: '0 3px 8px rgba(22, 163, 74, 0.2)'
                }}>{step.step}</div>
                <div style={{ paddingTop: '3px' }}>
                  <strong style={{ display: 'block', fontSize: '14.5px', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: 600 }}>{step.title}</strong>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', display: 'block' }}>{step.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 28px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: '#f8fafc',
          borderBottomLeftRadius: '19px',
          borderBottomRightRadius: '19px',
        }}>
          <button 
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0 18px', height: '40px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: '#fff', fontWeight: 600, transition: 'var(--transition)' }}
          >
            Close Guide
          </button>
          <a 
            href="https://www.gst.gov.in"
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            style={{ 
              padding: '0 20px',
              height: '40px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
              transition: 'var(--transition)'
            }}
          >
            Go to GST Portal ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Main GST Reports Page ─────────────────────────────────── */
export default function GSTReports() {
  const [activeTab, setActiveTab] = useState('gstr1');
  const { activeFirm } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalReportType, setModalReportType] = useState('gstr1');
  const [modalFileName, setModalFileName] = useState('');

  const handleDownloaded = (fileName, reportType) => {
    setModalFileName(fileName);
    setModalReportType(reportType);
    setModalOpen(true);
  };

  return (
    <Layout title="GST Reports">
      {/* Segmented Tab Switcher */}
      <div style={{
        background: '#f1f5f9',
        padding: '5px',
        borderRadius: '30px',
        display: 'inline-flex',
        gap: '4px',
        marginBottom: '28px',
        border: '1px solid rgba(0, 0, 0, 0.03)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)'
      }}>
        {[
          { key: 'gstr1', label: 'GSTR-1 Outward Supplies' },
          { key: 'gstr3b', label: 'GSTR-3B Summary Return' }
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 24px',
                borderRadius: '26px',
                border: 'none',
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 600,
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {tab.key === 'gstr1' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'gstr1'  && <GSTR1Tab activeFirm={activeFirm} onDownloaded={handleDownloaded} />}
      {activeTab === 'gstr3b' && <GSTR3BTab activeFirm={activeFirm} onDownloaded={handleDownloaded} />}

      <InstructionsModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        reportType={modalReportType} 
        fileName={modalFileName} 
      />
    </Layout>
  );
}
