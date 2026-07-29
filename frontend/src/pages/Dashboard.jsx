import { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { getDashboardStats } from '../api/reports';
import { getAIReportSummary } from '../api/ai';
import { formatCurrency, formatDate } from '../utils/format';

function StatCard({ label, value, color = 'green', abbr = '?' }) {
  return (
    <div className="stat-card" style={{ '--accent-color': `var(--${color === 'green' ? 'success' : color === 'blue' ? 'blue' : color === 'teal' ? 'accent-secondary' : color === 'warning' ? 'warning' : 'danger'})` }}>
      <div className={`stat-icon ${color}`}>{abbr}</div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    getDashboardStats()
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleAIInsights = async () => {
    setAiLoading(true);
    setAiError('');
    setAiSummary('');
    try {
      const res = await getAIReportSummary(stats);
      setAiSummary(res.data.summary);
    } catch (e) {
      setAiError(e.message || 'Could not load AI insights. Please check your internet connection.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Layout title="Dashboard">
      {loading ? (
        <div className="loading-overlay"><div className="spinner"></div> Loading dashboard...</div>
      ) : stats ? (
        <>
          <div className="stat-grid">
            <StatCard abbr="IT" label="Total Items"              value={stats.totalItems}                        color="blue" />
            <StatCard abbr="SV" label="Stock Value"              value={formatCurrency(stats.totalStockValue)}   color="teal" />
            <StatCard abbr="PU" label="This Month Purchases"     value={formatCurrency(stats.monthlyPurchases)}  color="green" />
            <StatCard abbr="SA" label="This Month Sales"         value={formatCurrency(stats.monthlySales)}      color="warning" />
            <StatCard abbr="OS" label="Out of Stock Items"       value={stats.lowStockItems}                     color="red" />
          </div>

          {/* AI Insights Card */}
          <div className="ai-insight-card">
            <div className="ai-insight-header">
              <div className="ai-insight-title">
                <span className="ai-insight-icon">✦</span>
                AI Business Insights
              </div>
              {!aiSummary && !aiLoading && (
                <button className="btn btn-primary btn-sm" onClick={handleAIInsights}>
                  ✦ Generate Insights
                </button>
              )}
              {aiSummary && (
                <button className="btn btn-secondary btn-sm" onClick={handleAIInsights}>
                  ↻ Refresh
                </button>
              )}
            </div>
            {aiLoading && (
              <div className="ai-insight-shimmer">
                <div className="ai-shimmer-line" />
                <div className="ai-shimmer-line" style={{ width: '85%' }} />
                <div className="ai-shimmer-line" style={{ width: '70%' }} />
              </div>
            )}
            {aiSummary && !aiLoading && (
              <p className="ai-insight-text">{aiSummary}</p>
            )}
            {aiError && !aiLoading && (
              <p className="ai-insight-error">{aiError}</p>
            )}
            {!aiSummary && !aiLoading && !aiError && (
              <p className="ai-insight-placeholder">Click "Generate Insights" to get an AI-powered summary of your business performance.</p>
            )}
          </div>

          <div className="dashboard-grid">
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Recent Purchases</div>
                  <div className="card-subtitle">Last 5 transactions</div>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="data-table recent-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Supplier</th>
                      <th>Date</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentPurchases?.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-muted" style={{padding:'24px'}}>No purchases yet</td></tr>
                    )}
                    {stats.recentPurchases?.map((p) => (
                      <tr key={p._id}>
                        <td><span className="badge badge-blue">{p.invoiceNumber}</span></td>
                        <td>{p.supplierName || p.supplier?.supplierName}</td>
                        <td className="text-muted">{formatDate(p.date)}</td>
                        <td className="text-right fw-600 text-accent">{formatCurrency(p.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Recent Sales</div>
                  <div className="card-subtitle">Last 5 transactions</div>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="data-table recent-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSales?.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-muted" style={{padding:'24px'}}>No sales yet</td></tr>
                    )}
                    {stats.recentSales?.map((s) => (
                      <tr key={s._id}>
                        <td><span className="badge badge-green">{s.invoiceNumber}</span></td>
                        <td>{s.customerName || s.customer?.customerName}</td>
                        <td className="text-muted">{formatDate(s.date)}</td>
                        <td className="text-right fw-600 text-success">{formatCurrency(s.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">!</div>
          <div className="empty-title">Could not load dashboard</div>
          <div className="empty-subtitle">Make sure the backend server is running on port 5000</div>
        </div>
      )}
    </Layout>
  );
}
