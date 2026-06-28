import { useState, useEffect, useRef } from 'react';
import Layout from '../../components/Layout/Layout';
import Toast, { useToast } from '../../components/UI/Toast';
import { getStockSummary } from '../../api/reports';
import { formatCurrency, formatNumber } from '../../utils/format';
import { Chart, registerables } from 'chart.js';
import { exportToCSV, exportToXLSX } from '../../utils/export';

Chart.register(...registerables);

export default function StockReport() {
  const [report, setReport] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCharts, setShowCharts] = useState(true);
  const { toast, show, hide } = useToast();

  const pieCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);
  const pieChartInstance = useRef(null);
  const barChartInstance = useRef(null);

  useEffect(() => {
    setLoading(true);
    getStockSummary()
      .then(r => { setReport(r.data); setTotalValue(r.totalValue); })
      .catch(e => show(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = report.filter(r =>
    !search || r.itemName.toLowerCase().includes(search.toLowerCase()) || r.itemCode.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ["#", "Item Code", "Item Name", "HSN Code", "Packing Size", "GST %", "Opening Qty", "Closing Stock", "Purchase Price (Rs.)", "Sales Price (Rs.)", "Stock Value (Rs.)"];
    const rows = filtered.map((r, idx) => [
      idx + 1,
      r.itemCode,
      r.itemName,
      r.hsnCode,
      r.packingSize,
      `${r.gstPercentage}%`,
      r.openingQuantity,
      r.closingStock,
      r.latestPurchasePrice,
      r.salesPrice,
      r.amount
    ]);
    exportToCSV(rows, headers, 'Stock_Summary_Report');
  };

  const handleExportExcel = () => {
    const headers = ["#", "Item Code", "Item Name", "HSN Code", "Packing Size", "GST %", "Opening Qty", "Closing Stock", "Purchase Price (Rs.)", "Sales Price (Rs.)", "Stock Value (Rs.)"];
    const rows = filtered.map((r, idx) => [
      idx + 1,
      r.itemCode,
      r.itemName,
      r.hsnCode,
      r.packingSize,
      r.gstPercentage,
      r.openingQuantity,
      r.closingStock,
      r.latestPurchasePrice,
      r.salesPrice,
      r.amount
    ]);
    exportToXLSX(rows, headers, 'Stock_Summary_Report');
  };

  useEffect(() => {
    const activeStockItems = filtered.filter(x => x.closingStock > 0);

    // Destroy previous instances to avoid canvas reuse errors
    if (pieChartInstance.current) pieChartInstance.current.destroy();
    if (barChartInstance.current) barChartInstance.current.destroy();

    if (loading || activeStockItems.length === 0 || !showCharts) return;

    // Create Stock Value Pie Chart
    const pieCtx = pieCanvasRef.current.getContext('2d');
    const sortedForPie = [...activeStockItems].sort((a, b) => b.amount - a.amount);
    const top5 = sortedForPie.slice(0, 5);
    const othersAmount = sortedForPie.slice(5).reduce((s, x) => s + x.amount, 0);
    const pieLabels = top5.map(x => x.itemName);
    const pieData = top5.map(x => x.amount);
    if (othersAmount > 0) {
      pieLabels.push('Others');
      pieData.push(othersAmount);
    }

    pieChartInstance.current = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData,
          backgroundColor: [
            '#16a34a', // var(--accent-primary)
            '#2563eb', // var(--blue)
            '#7c3aed', // var(--purple)
            '#d97706', // var(--warning)
            '#dc2626', // var(--danger)
            '#9ca3af'  // gray
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

    // Create Stock Volume Bar Chart
    const barCtx = barCanvasRef.current.getContext('2d');
    const sortedForBar = [...activeStockItems].sort((a, b) => b.closingStock - a.closingStock).slice(0, 10);
    const barLabels = sortedForBar.map(x => x.itemName);
    const barData = sortedForBar.map(x => x.closingStock);
    const barColors = sortedForBar.map(x => {
      if (x.closingStock <= 0) return 'rgba(220, 38, 38, 0.8)'; // danger
      if (x.closingStock < 10) return 'rgba(217, 119, 6, 0.8)'; // warning
      return 'rgba(22, 163, 74, 0.8)'; // success
    });
    const barBorderColors = sortedForBar.map(x => {
      if (x.closingStock <= 0) return '#dc2626';
      if (x.closingStock < 10) return '#d97706';
      return '#16a34a';
    });

    barChartInstance.current = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: [{
          label: 'Closing Qty',
          data: barData,
          backgroundColor: barColors,
          borderColor: barBorderColors,
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
              label: (context) => ` Qty: ${context.raw}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#6b7280',
              font: { family: 'Inter', size: 9 },
              callback: function(value) {
                const label = this.getLabelForValue(value);
                return label.length > 12 ? label.substring(0, 10) + '..' : label;
              }
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
  }, [filtered, loading, showCharts]);

  return (
    <Layout title="Stock Report">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Stock Summary Report</h2>
          <p className="page-subtitle">Current closing stock with latest purchase prices</p>
        </div>
        <div className="page-header-actions">
          <div className="search-bar">
            <span className="search-icon">&#x2315;</span>
            <input placeholder="Filter by name or code..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button 
            className={`btn ${showCharts ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setShowCharts(!showCharts)}
            style={{ marginRight: 8 }}
          >
            {showCharts ? 'Hide Visuals' : 'Show Visuals'}
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()} style={{ marginRight: 8 }}>Print</button>
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ marginRight: 8 }} disabled={filtered.length === 0}>CSV</button>
          <button className="btn btn-secondary" onClick={handleExportExcel} disabled={filtered.length === 0}>Excel</button>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon blue">IT</div>
          <div className="stat-info"><div className="stat-value">{filtered.length}</div><div className="stat-label">Total Items</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon teal">SV</div>
          <div className="stat-info"><div className="stat-value">{formatCurrency(totalValue)}</div><div className="stat-label">Total Stock Value</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">0!</div>
          <div className="stat-info"><div className="stat-value">{filtered.filter(r => r.closingStock <= 0).length}</div><div className="stat-label">Zero / Negative Stock</div></div>
        </div>
      </div>

      {showCharts && !loading && filtered.filter(x => x.closingStock > 0).length > 0 && (
        <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 15, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Stock Value Distribution (Rs.)</h3>
            <div style={{ position: 'relative', height: 250, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <canvas ref={pieCanvasRef}></canvas>
            </div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <h3 className="card-title" style={{ marginBottom: 15, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Stock Volumes (Top 10 Items)</h3>
            <div style={{ position: 'relative', height: 250 }}>
              <canvas ref={barCanvasRef}></canvas>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="data-table" id="stock-report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>HSN Code</th>
                <th>Packing Size</th>
                <th>GST %</th>
                <th className="text-right">Opening Qty</th>
                <th className="text-right">Closing Stock</th>
                <th className="text-right">Purchase Price (Rs.)</th>
                <th className="text-right">Sales Price (Rs.)</th>
                <th className="text-right">Stock Value (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11}><div className="loading-overlay"><div className="spinner"></div> Loading report...</div></td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={11}>
                  <div className="empty-state">
                    <div className="empty-icon">SR</div>
                    <div className="empty-title">No data found</div>
                  </div>
                </td></tr>
              )}
              {!loading && filtered.map((row, idx) => (
                <tr key={row.itemCode}>
                  <td className="text-muted">{idx + 1}</td>
                  <td><span className="badge badge-blue">{row.itemCode}</span></td>
                  <td className="fw-600">{row.itemName}</td>
                  <td><span className="badge badge-purple">{row.hsnCode}</span></td>
                  <td>{row.packingSize}</td>
                  <td><span className="badge badge-teal">{row.gstPercentage}%</span></td>
                  <td className="text-right text-muted">{formatNumber(row.openingQuantity, 0)}</td>
                  <td className="text-right">
                    <span className={`fw-600 ${row.closingStock <= 0 ? 'text-danger' : row.closingStock < 10 ? 'text-warning' : 'text-success'}`}>
                      {formatNumber(row.closingStock, 2)}
                    </span>
                  </td>
                  <td className="text-right">{formatCurrency(row.latestPurchasePrice)}</td>
                  <td className="text-right">{formatCurrency(row.salesPrice)}</td>
                  <td className="text-right fw-600 text-accent">{formatCurrency(row.amount)}</td>
                </tr>
              ))}
              {!loading && filtered.length > 0 && (
                <tr style={{ background: 'var(--bg-tertiary)', borderTop: '2px solid var(--border-accent)' }}>
                  <td colSpan={10} className="fw-700 text-right" style={{ padding: '14px 16px' }}>Total Stock Value</td>
                  <td className="text-right fw-800 text-accent" style={{ fontSize: 15, padding: '14px 16px' }}>
                    {formatCurrency(filtered.reduce((s, r) => s + r.amount, 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
