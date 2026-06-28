import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout/Layout';
import Toast, { useToast } from '../../components/UI/Toast';
import { getStockDetail, getSalesDetail } from '../../api/reports';
import { formatCurrency, formatDate, formatNumber } from '../../utils/format';
import { Chart, registerables } from 'chart.js';
import { exportToCSV, exportToXLSX } from '../../utils/export';

Chart.register(...registerables);

export default function StockDetailReport() {
  const [reportType, setReportType] = useState('purchase'); // 'purchase' | 'sales'
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [searched, setSearched] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const { toast, show, hide } = useToast();

  const pieCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);
  const pieChartInstance = useRef(null);
  const barChartInstance = useRef(null);

  const handleSearch = () => {
    setLoading(true);
    setSearched(true);
    const params = {};
    if (from)     params.from     = from;
    if (to)       params.to       = to;
    if (itemCode) params.itemCode = itemCode;

    const fetcher = reportType === 'purchase' ? getStockDetail : getSalesDetail;
    fetcher(params)
      .then(r => setData(r.data))
      .catch(e => show(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (loading || data.length === 0 || !showCharts || !searched) return;

    // Destroy previous instances to avoid canvas reuse errors
    if (pieChartInstance.current) pieChartInstance.current.destroy();
    if (barChartInstance.current) barChartInstance.current.destroy();

    // 1. Prepare Daily Trend Data (Bar Graph)
    const dailyTotals = {};
    data.forEach(row => {
      const dateStr = formatDate(row.date);
      dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + (row.amount || 0);
    });
    // Sort dates chronologically
    const sortedDates = Object.keys(dailyTotals).sort((a, b) => new Date(a) - new Date(b));
    const trendLabels = sortedDates;
    const trendData = sortedDates.map(d => dailyTotals[d]);

    // 2. Prepare Breakdown Data (Pie Chart)
    let pieLabels = [];
    let pieData = [];
    const isPurchase = reportType === 'purchase';

    if (isPurchase) {
      // Group by Item Name for Purchases
      const itemTotals = {};
      data.forEach(row => {
        itemTotals[row.itemName] = (itemTotals[row.itemName] || 0) + (row.amount || 0);
      });
      const sortedItems = Object.entries(itemTotals).sort((a, b) => b[1] - a[1]);
      const top5Items = sortedItems.slice(0, 5);
      const othersAmt = sortedItems.slice(5).reduce((s, x) => s + x[1], 0);
      pieLabels = top5Items.map(x => x[0]);
      pieData = top5Items.map(x => x[1]);
      if (othersAmt > 0) {
        pieLabels.push('Others');
        pieData.push(othersAmt);
      }
    } else {
      // Group by Customer Name for Sales
      const customerTotals = {};
      data.forEach(row => {
        const name = row.customerName || 'Retail Cash';
        customerTotals[name] = (customerTotals[name] || 0) + (row.amount || 0);
      });
      const sortedCusts = Object.entries(customerTotals).sort((a, b) => b[1] - a[1]);
      const top5Custs = sortedCusts.slice(0, 5);
      const othersAmt = sortedCusts.slice(5).reduce((s, x) => s + x[1], 0);
      pieLabels = top5Custs.map(x => x[0]);
      pieData = top5Custs.map(x => x[1]);
      if (othersAmt > 0) {
        pieLabels.push('Others');
        pieData.push(othersAmt);
      }
    }

    // Initialize Bar Chart (Daily Trend)
    const barCtx = barCanvasRef.current.getContext('2d');
    barChartInstance.current = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: trendLabels,
        datasets: [{
          label: isPurchase ? 'Purchases (Rs.)' : 'Sales (Rs.)',
          data: trendData,
          backgroundColor: isPurchase ? 'rgba(37, 99, 235, 0.8)' : 'rgba(22, 163, 74, 0.8)', // blue vs green
          borderColor: isPurchase ? '#2563eb' : '#16a34a',
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
              font: { family: 'Inter', size: 9 }
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

    // Initialize Pie Chart (Breakdown)
    const pieCtx = pieCanvasRef.current.getContext('2d');
    pieChartInstance.current = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData,
          backgroundColor: [
            isPurchase ? '#2563eb' : '#16a34a', // Blue for purchase, Green for sales
            '#7c3aed', // Purple
            '#d97706', // Orange
            '#06b6d4', // Cyan
            '#ec4899', // Pink
            '#9ca3af'  // Gray
          ],
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

    return () => {
      if (pieChartInstance.current) pieChartInstance.current.destroy();
      if (barChartInstance.current) barChartInstance.current.destroy();
    };
  }, [data, loading, showCharts, reportType, searched]);

  // Reset on type change
  const handleTypeChange = (type) => {
    setReportType(type);
    setData([]);
    setSearched(false);
  };

  const totalAmount = data.reduce((s, r) => s + (r.amount    || 0), 0);
  const totalQty    = data.reduce((s, r) => s + (r.quantity  || 0), 0);
  const totalTax    = data.reduce((s, r) => s + (r.totalTax  || 0), 0);

  const handleExportCSV = () => {
    const isPurchase = reportType === 'purchase';
    const headers = isPurchase
      ? ["#", "Date", "Invoice No.", "Supplier", "Item Code", "Item Name", "HSN", "Packing", "Qty", "Rate", "Taxable", "Tax (Pur)", "Amount"]
      : ["#", "Date", "Invoice No.", "Customer", "GST / Type", "Item Code", "Item Name", "HSN", "Packing", "Qty", "Rate", "Taxable", "Tax (Sale)", "Amount"];
    
    const rows = data.map((row, idx) => {
      const base = [
        idx + 1,
        formatDate(row.date),
        row.invoiceNumber,
        isPurchase ? row.supplierName : row.customerName
      ];
      if (!isPurchase) {
        base.push(row.customerGST);
      }
      base.push(
        row.itemCode,
        row.itemName,
        row.hsnCode,
        row.packingSize,
        row.quantity,
        row.rate,
        row.taxableAmount,
        `${row.totalTax} (${row.gstPercentage}%)`,
        row.amount
      );
      return base;
    });
    
    exportToCSV(rows, headers, isPurchase ? 'Purchase_Detail_Report' : 'Sales_Detail_Report');
  };

  const handleExportExcel = () => {
    const isPurchase = reportType === 'purchase';
    const headers = isPurchase
      ? ["#", "Date", "Invoice No.", "Supplier", "Item Code", "Item Name", "HSN", "Packing", "Qty", "Rate", "Taxable", "Tax (Pur)", "Amount"]
      : ["#", "Date", "Invoice No.", "Customer", "GST / Type", "Item Code", "Item Name", "HSN", "Packing", "Qty", "Rate", "Taxable", "Tax (Sale)", "Amount"];
    
    const rows = data.map((row, idx) => {
      const base = [
        idx + 1,
        formatDate(row.date),
        row.invoiceNumber,
        isPurchase ? row.supplierName : row.customerName
      ];
      if (!isPurchase) {
        base.push(row.customerGST);
      }
      base.push(
        row.itemCode,
        row.itemName,
        row.hsnCode,
        row.packingSize,
        row.quantity,
        row.rate,
        row.taxableAmount,
        row.totalTax,
        row.amount
      );
      return base;
    });
    
    exportToXLSX(rows, headers, isPurchase ? 'Purchase_Detail_Report' : 'Sales_Detail_Report');
  };

  const isPurchase = reportType === 'purchase';

  return (
    <Layout title="Stock Detail Report">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Transaction Detail Report</h2>
          <p className="page-subtitle">Date-wise itemised {isPurchase ? 'purchase' : 'sales'} transactions</p>
        </div>
        <div className="page-header-actions">
          {data.length > 0 && (
            <>
              <button 
                className={`btn ${showCharts ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setShowCharts(!showCharts)}
                style={{ marginRight: 8 }}
              >
                {showCharts ? 'Hide Visuals' : 'Show Visuals'}
              </button>
              <button className="btn btn-secondary" onClick={() => window.print()} style={{ marginRight: 8 }}>Print</button>
              <button className="btn btn-secondary" onClick={handleExportCSV} style={{ marginRight: 8 }}>CSV</button>
              <button className="btn btn-secondary" onClick={handleExportExcel}>Excel</button>
            </>
          )}
        </div>
      </div>

      <div className="card mb-16">
        {/* Report type toggle */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, background: 'var(--bg-primary)', padding: '4px', borderRadius: 'var(--radius-md)', width: 'fit-content', border: '1px solid var(--border)' }}>
          {[
            { key: 'purchase', label: 'Purchase Report' },
            { key: 'sales',    label: 'Sales Report' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => handleTypeChange(opt.key)}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: reportType === opt.key ? 'var(--accent-primary)' : 'transparent',
                color:      reportType === opt.key ? '#fff' : 'var(--text-secondary)',
                boxShadow:  reportType === opt.key ? '0 2px 8px rgba(22,163,74,0.3)' : 'none',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="card-title" style={{ marginBottom: 14 }}>Filter Options</div>
        <div className="form-grid form-grid-4">
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input type="date" className="form-control" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date</label>
            <input type="date" className="form-control" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Item Code (optional)</label>
            <input className="form-control" value={itemCode} onChange={e => setItemCode(e.target.value.toUpperCase())} placeholder="e.g. ITM-0001" />
          </div>
          <div className="form-group">
            <label className="form-label">&nbsp;</label>
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading} style={{ width: '100%' }}>
              {loading ? <><span className="spinner"></span> Loading...</> : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {searched && (
        <>
          {data.length > 0 && (
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
              <div className="stat-card"><div className="stat-icon blue">RW</div><div className="stat-info"><div className="stat-value">{data.length}</div><div className="stat-label">Total Rows</div></div></div>
              <div className="stat-card"><div className="stat-icon teal">QT</div><div className="stat-info"><div className="stat-value">{formatNumber(totalQty, 2)}</div><div className="stat-label">Total Quantity</div></div></div>
              <div className="stat-card"><div className="stat-icon warning">TX</div><div className="stat-info"><div className="stat-value">{formatCurrency(totalTax)}</div><div className="stat-label">Total Tax</div></div></div>
              <div className="stat-card"><div className="stat-icon green">AM</div><div className="stat-info"><div className="stat-value">{formatCurrency(totalAmount)}</div><div className="stat-label">Total Amount</div></div></div>
            </div>
          )}

          {showCharts && !loading && data.length > 0 && (
            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 className="card-title" style={{ marginBottom: 15, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {isPurchase ? 'Purchase Value by Item (Rs.)' : 'Sales Value by Customer (Rs.)'}
                </h3>
                <div style={{ position: 'relative', height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <canvas ref={pieCanvasRef}></canvas>
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <h3 className="card-title" style={{ marginBottom: 15, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {isPurchase ? 'Daily Purchase Trend (Rs.)' : 'Daily Sales Trend (Rs.)'}
                </h3>
                <div style={{ position: 'relative', height: 250 }}>
                  <canvas ref={barCanvasRef}></canvas>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Invoice No.</th>
                    <th>{isPurchase ? 'Supplier' : 'Customer'}</th>
                    {!isPurchase && <th>GST / Type</th>}
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>HSN</th>
                    <th>Packing</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Taxable</th>
                    <th className="text-right">Tax ({isPurchase ? 'Pur' : 'Sale'})</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={isPurchase ? 13 : 14}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>
                  )}
                  {!loading && data.length === 0 && (
                    <tr><td colSpan={isPurchase ? 13 : 14}>
                      <div className="empty-state">
                        <div className="empty-icon">SD</div>
                        <div className="empty-title">No records found</div>
                        <div className="empty-subtitle">Try adjusting the date range or item code filter</div>
                      </div>
                    </td></tr>
                  )}
                  {!loading && data.map((row, idx) => (
                    <tr key={idx}>
                      <td className="text-muted">{idx + 1}</td>
                      <td>{formatDate(row.date)}</td>
                      <td><span className={`badge ${isPurchase ? 'badge-blue' : 'badge-green'}`}>{row.invoiceNumber}</span></td>
                      <td className="fw-600">{isPurchase ? row.supplierName : row.customerName}</td>
                      {!isPurchase && <td>{row.customerGST === 'CASH' ? <span className="badge badge-warning">CASH</span> : <span className="text-muted" style={{fontSize:11}}>{row.customerGST}</span>}</td>}
                      <td><span className="badge badge-teal">{row.itemCode}</span></td>
                      <td className="fw-600">{row.itemName}</td>
                      <td>{row.hsnCode}</td>
                      <td>{row.packingSize}</td>
                      <td className="text-right fw-600">{formatNumber(row.quantity, 3)}</td>
                      <td className="text-right">{formatCurrency(row.rate)}</td>
                      <td className="text-right">{formatCurrency(row.taxableAmount)}</td>
                      <td className="text-right text-warning">
                        {formatCurrency(row.totalTax)}
                        <span className="text-muted" style={{fontSize:10, display:'block'}}>({row.gstPercentage}%)</span>
                      </td>
                      <td className="text-right fw-600 text-accent">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  {!loading && data.length > 0 && (
                    <tr style={{ background: 'var(--bg-tertiary)', borderTop: '2px solid var(--border-accent)' }}>
                      <td colSpan={isPurchase ? 9 : 10} className="fw-700 text-right" style={{ padding: '14px 16px' }}>TOTAL</td>
                      <td className="text-right fw-700" style={{ padding: '14px 16px' }}>{formatNumber(totalQty, 2)}</td>
                      <td></td>
                      <td className="text-right fw-600 text-warning" style={{ padding: '14px 16px' }}>{formatCurrency(totalTax)}</td>
                      <td className="text-right fw-800 text-accent" style={{ fontSize: 15, padding: '14px 16px' }}>{formatCurrency(totalAmount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!searched && (
        <div className="empty-state" style={{ minHeight: 280 }}>
          <div className="empty-icon" style={{ fontSize: 16 }}>SD</div>
          <div className="empty-title">Select report type and generate</div>
          <div className="empty-subtitle">Choose Purchase or Sales report, set filters, then click Generate Report</div>
        </div>
      )}
    </Layout>
  );
}
