import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component } from 'react';

// Error boundary to show real errors instead of blank pages
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#fef2f2', color: '#dc2626', borderRadius: 12, margin: 24, border: '1px solid #fca5a5' }}>
          <h2 style={{ marginTop: 0 }}>⚠ Page Crashed — Error Details:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.error?.toString()}</pre>
          <pre style={{ color: '#6b7280', fontSize: 11 }}>{this.state.error?.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import ItemList from './pages/Items/ItemList';
import SupplierList from './pages/Suppliers/SupplierList';
import CustomerList from './pages/Customers/CustomerList';
import PurchaseList from './pages/Purchases/PurchaseList';
import PurchaseForm from './pages/Purchases/PurchaseForm';
import SaleList from './pages/Sales/SaleList';
import SaleForm from './pages/Sales/SaleForm';
import ChallanList from './pages/Challans/ChallanList';
import ChallanForm from './pages/Challans/ChallanForm';
import StockReport from './pages/Reports/StockReport';
import StockDetailReport from './pages/Reports/StockDetailReport';
import GSTReports from './pages/Reports/GSTReports';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import SelectFirm from './pages/Auth/SelectFirm';
import Landing from './pages/Landing/Landing';
import PaymentList from './pages/Payments/PaymentList';
import Profile from './pages/Auth/Profile';

const ProtectedRoute = ({ children, requireFirm = true }) => {
  const { user, loading, activeFirmId } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireFirm && !activeFirmId) return <Navigate to="/select-firm" replace />;
  
  return children;
};

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Route - Firm Selection (Does not require active firm) */}
        <Route path="/select-firm" element={<ProtectedRoute requireFirm={false}><SelectFirm /></ProtectedRoute>} />

        {/* Public Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Protected Routes - Core Application (Requires active firm) */}
        <Route path="/dashboard"               element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/items"                   element={<ProtectedRoute><ItemList /></ProtectedRoute>} />
        <Route path="/suppliers"               element={<ProtectedRoute><SupplierList /></ProtectedRoute>} />
        <Route path="/customers"               element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
        <Route path="/purchases"               element={<ProtectedRoute><PurchaseList /></ProtectedRoute>} />
        <Route path="/purchases/new"           element={<ProtectedRoute><PurchaseForm /></ProtectedRoute>} />
        <Route path="/purchases/edit/:id"      element={<ProtectedRoute><PurchaseForm /></ProtectedRoute>} />
        <Route path="/sales"                   element={<ProtectedRoute><SaleList /></ProtectedRoute>} />
        <Route path="/sales/new"               element={<ProtectedRoute><SaleForm /></ProtectedRoute>} />
        <Route path="/sales/edit/:id"          element={<ProtectedRoute><SaleForm /></ProtectedRoute>} />
        <Route path="/challans"                element={<ProtectedRoute><ChallanList /></ProtectedRoute>} />
        <Route path="/challans/new"            element={<ProtectedRoute><ChallanForm /></ProtectedRoute>} />
        <Route path="/challans/edit/:id"       element={<ProtectedRoute><ChallanForm /></ProtectedRoute>} />
        <Route path="/reports/stock"           element={<ProtectedRoute><StockReport /></ProtectedRoute>} />
        <Route path="/reports/stock-detail"    element={<ProtectedRoute><StockDetailReport /></ProtectedRoute>} />
        <Route path="/reports/gst"             element={<ProtectedRoute><ErrorBoundary><GSTReports /></ErrorBoundary></ProtectedRoute>} />
        <Route path="/payments"                element={<ProtectedRoute><PaymentList /></ProtectedRoute>} />
        <Route path="/profile"                 element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      </Routes>
    </HashRouter>
  );
}
