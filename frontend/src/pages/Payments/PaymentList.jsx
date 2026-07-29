import { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
import Modal from '../../components/UI/Modal';
import Toast, { useToast } from '../../components/UI/Toast';
import { getPayments, getPaymentSummary, getPartyBalances, createPayment, updatePayment, deletePayment } from '../../api/payments';
import { getCustomers } from '../../api/customers';
import { getSuppliers } from '../../api/suppliers';
import { generatePaymentReminder } from '../../api/ai';
import { formatCurrency, formatDate } from '../../utils/format';
import { useFormShortcuts } from '../../hooks/useKeyboardShortcut';

const EMPTY = {
  type: 'received', // 'received' (Customer) or 'sent' (Supplier)
  partyType: 'customer', // 'customer' or 'supplier'
  customer: '',
  supplier: '',
  amount: '',
  paymentMode: 'cash', // 'cash' or 'bank'
  bankName: '',
  customBankName: '',
  referenceNumber: '',
  remarks: '',
  date: new Date().toISOString().substring(0, 10)
};

const BANK_OPTIONS = [
  'State Bank of India (SBI)',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Punjab National Bank (PNB)',
  'Bank of Baroda (BOB)',
  'Other Bank'
];

export default function PaymentList() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ received: { total: 0, cash: 0, bank: 0 }, sent: { total: 0, cash: 0, bank: 0 }, balance: 0 });
  const [balances, setBalances] = useState({ customers: [], suppliers: [] });
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history'); // 'history', 'customers', 'suppliers'
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMode, setFilterMode] = useState('all');
  
  // Modals & Form
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // AI Reminder state
  const [reminderModal, setReminderModal] = useState(null); // { customerName, balance, phone }
  const [reminderText, setReminderText] = useState('');
  const [reminderLoading, setReminderLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const { toast, show, hide } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const payRes = await getPayments({ 
        search, 
        type: filterType !== 'all' ? filterType : undefined,
        paymentMode: filterMode !== 'all' ? filterMode : undefined 
      });
      setPayments(payRes.data);

      const sumRes = await getPaymentSummary();
      setSummary(sumRes.data);

      const balRes = await getPartyBalances();
      setBalances(balRes.data);
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDropdowns = async () => {
    try {
      const custRes = await getCustomers();
      setCustomers(custRes.data);

      const suppRes = await getSuppliers();
      setSuppliers(suppRes.data);
    } catch (e) {
      show(e.message, 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, [search, filterType, filterMode]);

  useEffect(() => {
    loadDropdowns();
  }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    const isOtherBank = p.bankName && !BANK_OPTIONS.includes(p.bankName);
    setForm({
      type: p.type,
      partyType: p.partyType,
      customer: p.customer?._id || '',
      supplier: p.supplier?._id || '',
      amount: p.amount.toString(),
      paymentMode: p.paymentMode,
      bankName: isOtherBank ? 'Other Bank' : (p.bankName || ''),
      customBankName: isOtherBank ? p.bankName : '',
      referenceNumber: p.referenceNumber || '',
      remarks: p.remarks || '',
      date: p.date ? p.date.substring(0, 10) : new Date().toISOString().substring(0, 10)
    });
    setEditId(p._id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const amountVal = parseFloat(form.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      show('Please enter a valid amount greater than 0', 'error');
      return;
    }

    if (form.partyType === 'customer' && !form.customer) {
      show('Please select a customer', 'error');
      return;
    }

    if (form.partyType === 'supplier' && !form.supplier) {
      show('Please select a supplier', 'error');
      return;
    }

    if (form.paymentMode === 'bank') {
      if (!form.bankName) {
        show('Please select a bank', 'error');
        return;
      }
      if (form.bankName === 'Other Bank' && !form.customBankName.trim()) {
        show('Please enter the custom bank name', 'error');
        return;
      }
      if (!form.referenceNumber.trim()) {
        show('Reference number (Transaction ID/UTR/Cheque) is required for bank transactions', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        type: form.type,
        partyType: form.partyType,
        customer: form.partyType === 'customer' ? form.customer : undefined,
        supplier: form.partyType === 'supplier' ? form.supplier : undefined,
        amount: amountVal,
        paymentMode: form.paymentMode,
        bankName: form.paymentMode === 'bank' 
          ? (form.bankName === 'Other Bank' ? form.customBankName.trim() : form.bankName) 
          : '',
        referenceNumber: form.referenceNumber.trim(),
        remarks: form.remarks.trim(),
        date: new Date(form.date)
      };

      if (editId) {
        await updatePayment(editId, payload);
        show('Payment entry updated successfully');
      } else {
        await createPayment(payload);
        show('Payment entry added successfully');
      }
      setModalOpen(false);
      loadData();
    } catch (e) {
      show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deletePayment(deleteModal._id);
      show('Payment entry deleted successfully');
      setDeleteModal(null);
      loadData();
    } catch (e) {
      show(e.message, 'error');
    }
  };

  const set = (k, v) => {
    setForm(f => {
      const updated = { ...f, [k]: v };
      
      // Auto alignment of partyType based on payment type
      if (k === 'type') {
        updated.partyType = v === 'received' ? 'customer' : 'supplier';
        updated.customer = '';
        updated.supplier = '';
      }
      return updated;
    });
  };

  useFormShortcuts({
    onSave: modalOpen ? handleSave : null,
    onCancel: modalOpen ? () => setModalOpen(false) : null
  });

  const openReminderModal = async (customer) => {
    setReminderModal(customer);
    setReminderText('');
    setCopied(false);
    setReminderLoading(true);
    try {
      const res = await generatePaymentReminder(customer.name, customer.balance, customer.phone || '', customer._id || '');
      setReminderText(res.data.message);
    } catch (e) {
      setReminderText('Could not generate reminder. Please check your internet connection.');
    } finally {
      setReminderLoading(false);
    }
  };

  const handleCopyReminder = () => {
    navigator.clipboard.writeText(reminderText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Layout title="Payments">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}
      
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Payments</h2>
          <p className="page-subtitle">Track payments sent and received, and manage cash flow balances</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ Add Payment Entry</button>
        </div>
      </div>

      {/* Real-time Summary Cards (Balance of Payments) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {[
          { 
            label: 'Total Received', 
            value: formatCurrency(summary.received.total), 
            sub: `Cash: ${formatCurrency(summary.received.cash)} · Bank: ${formatCurrency(summary.received.bank)}`, 
            color: '#16a34a', 
            bg: 'rgba(22, 163, 74, 0.05)', 
            icon: 'IN' 
          },
          { 
            label: 'Total Sent', 
            value: formatCurrency(summary.sent.total), 
            sub: `Cash: ${formatCurrency(summary.sent.cash)} · Bank: ${formatCurrency(summary.sent.bank)}`, 
            color: '#dc2626', 
            bg: 'rgba(220, 38, 38, 0.05)', 
            icon: 'OUT' 
          },
          { 
            label: 'Balance of Payments', 
            value: formatCurrency(summary.balance), 
            sub: summary.balance >= 0 ? 'Net Cash Surplus' : 'Net Cash Deficit', 
            color: summary.balance >= 0 ? '#2563eb' : '#d97706', 
            bg: summary.balance >= 0 ? 'rgba(37, 99, 235, 0.05)' : 'rgba(217, 119, 6, 0.05)', 
            icon: 'NET' 
          }
        ].map((stat, idx) => (
          <div key={idx} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative',
            overflow: 'hidden'
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
              fontSize: '12px',
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

      {/* Segmented Controller Tab Selector */}
      <div style={{
        background: 'var(--border-light)',
        padding: '5px',
        borderRadius: '30px',
        display: 'inline-flex',
        gap: '4px',
        marginBottom: '24px',
        border: '1px solid rgba(0, 0, 0, 0.03)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)'
      }}>
        {[
          { key: 'history', label: 'Payments History' },
          { key: 'customers', label: 'Customer Dues & Balances' },
          { key: 'suppliers', label: 'Supplier Dues & Balances' }
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
                background: isActive ? 'var(--bg-secondary)' : 'transparent',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SEARCH AND FILTERS TOOLBAR (Only for History Tab) */}
      {activeTab === 'history' && (
        <div className="card mb-16" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '240px', maxWidth: '400px', margin: 0 }}>
            <span className="search-icon">&#x2315;</span>
            <input 
              placeholder="Search by bank name, remarks or amount..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Type:</span>
              <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ height: '36px', padding: '0 12px', fontSize: '13px' }}>
                <option value="all">All Types</option>
                <option value="received">Received (Inflow)</option>
                <option value="sent">Sent (Outflow)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Mode:</span>
              <select className="form-control" value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ height: '36px', padding: '0 12px', fontSize: '13px' }}>
                <option value="all">All Modes</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENTS */}
      
      {/* 1. Payments History Tab */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Party Name</th>
                  <th>Mode</th>
                  <th>Bank Name</th>
                  <th>Reference #</th>
                  <th>Remarks</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={9}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>}
                {!loading && payments.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty-state">
                        <div className="empty-icon">PM</div>
                        <div className="empty-title">No payment entries found</div>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && payments.map((p) => {
                  const partyName = p.partyType === 'customer' 
                    ? (p.customer?.customerName || 'Retail Customer') 
                    : (p.supplier?.supplierName || 'N/A');
                  const partyCode = p.partyType === 'customer' 
                    ? p.customer?.customerCode 
                    : p.supplier?.supplierCode;

                  return (
                    <tr key={p._id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(p.date)}</td>
                      <td>
                        {p.type === 'received' 
                          ? <span className="badge badge-success" style={{ fontWeight: 700 }}>RECEIVED</span>
                          : <span className="badge badge-danger" style={{ fontWeight: 700 }}>SENT</span>
                        }
                      </td>
                      <td>
                        <div>
                          <div className="fw-600">{partyName}</div>
                          {partyCode && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{partyCode}</div>}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${p.paymentMode === 'cash' ? 'badge-warning' : 'badge-blue'}`} style={{ textTransform: 'uppercase' }}>
                          {p.paymentMode}
                        </span>
                      </td>
                      <td className="text-secondary">{p.bankName || '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{p.referenceNumber || '—'}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-muted" title={p.remarks}>
                        {p.remarks || '—'}
                      </td>
                      <td className="text-right fw-700" style={{ color: p.type === 'received' ? 'var(--success)' : 'var(--danger)' }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(p)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Customer Dues & Balances Tab */}
      {activeTab === 'customers' && (
        <div className="card" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Code</th>
                  <th>Customer Name</th>
                  <th>GSTIN</th>
                  <th>Phone Number</th>
                  <th className="text-right">Total Sales</th>
                  <th className="text-right">Total Payments Received</th>
                  <th className="text-right">Outstanding Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>}
                {!loading && balances.customers.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-icon">CS</div>
                        <div className="empty-title">No customer accounts setup</div>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && balances.customers.map((c) => (
                  <tr key={c._id}>
                    <td><span className="badge badge-purple">{c.code}</span></td>
                    <td className="fw-600">{c.name}</td>
                    <td><span className="badge badge-blue">{c.gstNumber}</span></td>
                    <td>{c.phone || '—'}</td>
                    <td className="text-right" style={{ fontFeatureSettings: '"tnum"' }}>{formatCurrency(c.totalSales)}</td>
                    <td className="text-right text-success" style={{ fontFeatureSettings: '"tnum"' }}>{formatCurrency(c.totalPaid)}</td>
                    <td className="text-right fw-800" style={{ 
                      color: c.balance > 0 ? 'var(--warning)' : c.balance < 0 ? 'var(--success)' : 'var(--text-muted)',
                      fontFeatureSettings: '"tnum"'
                    }}>
                      {formatCurrency(c.balance)}
                      {c.balance > 0 && <span style={{ fontSize: '9px', fontWeight: 600, marginLeft: '4px', color: 'var(--warning)' }}>(DUE)</span>}
                      {c.balance < 0 && <span style={{ fontSize: '9px', fontWeight: 600, marginLeft: '4px', color: 'var(--success)' }}>(ADVANCE)</span>}
                    </td>
                    <td>
                      {c.balance > 0 && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openReminderModal(c)}
                          title="Generate AI payment reminder"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          ✦ Reminder
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Supplier Dues & Balances Tab */}
      {activeTab === 'suppliers' && (
        <div className="card" style={{ padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier Code</th>
                  <th>Supplier Name</th>
                  <th>GSTIN</th>
                  <th>Phone Number</th>
                  <th className="text-right">Total Purchases</th>
                  <th className="text-right">Total Payments Sent</th>
                  <th className="text-right">Outstanding Balance</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>}
                {!loading && balances.suppliers.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-icon">SP</div>
                        <div className="empty-title">No supplier accounts setup</div>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && balances.suppliers.map((s) => (
                  <tr key={s._id}>
                    <td><span className="badge badge-purple">{s.code}</span></td>
                    <td className="fw-600">{s.name}</td>
                    <td><span className="badge badge-blue">{s.gstNumber}</span></td>
                    <td>{s.phone || '—'}</td>
                    <td className="text-right" style={{ fontFeatureSettings: '"tnum"' }}>{formatCurrency(s.totalPurchases)}</td>
                    <td className="text-right text-danger" style={{ fontFeatureSettings: '"tnum"' }}>{formatCurrency(s.totalPaid)}</td>
                    <td className="text-right fw-800" style={{ 
                      color: s.balance > 0 ? 'var(--danger)' : s.balance < 0 ? 'var(--success)' : 'var(--text-muted)',
                      fontFeatureSettings: '"tnum"'
                    }}>
                      {formatCurrency(s.balance)}
                      {s.balance > 0 && <span style={{ fontSize: '9px', fontWeight: 600, marginLeft: '4px', color: 'var(--danger)' }}>(TO PAY)</span>}
                      {s.balance < 0 && <span style={{ fontSize: '9px', fontWeight: 600, marginLeft: '4px', color: 'var(--success)' }}>(ADVANCE)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FORM ENTRY MODAL */}
      <Modal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title={editId ? 'Edit Payment Entry' : 'Add Payment Entry'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner"></span> Saving...</> : editId ? 'Update Entry' : 'Add Entry'}
            </button>
          </>
        }
      >
        <div className="form-grid form-grid-2">
          
          {/* Payment Type */}
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Transaction Type <span className="required">*</span></label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="type" 
                  value="received" 
                  checked={form.type === 'received'} 
                  onChange={e => set('type', e.target.value)} 
                />
                Received from Customer (Inflow)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="type" 
                  value="sent" 
                  checked={form.type === 'sent'} 
                  onChange={e => set('type', e.target.value)} 
                />
                Sent to Supplier (Outflow)
              </label>
            </div>
          </div>

          {/* Customer / Supplier Dropdown Selector */}
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">
              {form.type === 'received' ? 'Select Customer' : 'Select Supplier'} <span className="required">*</span>
            </label>
            {form.type === 'received' ? (
              <select 
                className="form-control" 
                value={form.customer} 
                onChange={e => set('customer', e.target.value)}
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c._id} value={c._id}>{c.customerName} ({c.customerCode})</option>
                ))}
              </select>
            ) : (
              <select 
                className="form-control" 
                value={form.supplier} 
                onChange={e => set('supplier', e.target.value)}
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => (
                  <option key={s._id} value={s._id}>{s.supplierName} ({s.supplierCode})</option>
                ))}
              </select>
            )}
          </div>

          {/* Amount and Date */}
          <div className="form-group">
            <label className="form-label">Payment Amount (Rs.) <span className="required">*</span></label>
            <input 
              type="number" 
              className="form-control" 
              placeholder="e.g. 5000" 
              value={form.amount} 
              onChange={e => set('amount', e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date <span className="required">*</span></label>
            <input 
              type="date" 
              className="form-control" 
              value={form.date} 
              onChange={e => set('date', e.target.value)} 
            />
          </div>

          {/* Payment Mode Selection */}
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Payment Mode <span className="required">*</span></label>
            <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="paymentMode" 
                  value="cash" 
                  checked={form.paymentMode === 'cash'} 
                  onChange={e => set('paymentMode', e.target.value)} 
                />
                Cash Payment
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500, cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="paymentMode" 
                  value="bank" 
                  checked={form.paymentMode === 'bank'} 
                  onChange={e => set('paymentMode', e.target.value)} 
                />
                Bank Transaction (UPI / Check / NetBanking)
              </label>
            </div>
          </div>

          {/* Dynamic Bank Name Dropdown/Input */}
          {form.paymentMode === 'bank' && (
            <>
              <div className="form-group">
                <label className="form-label">Bank Name <span className="required">*</span></label>
                <select 
                  className="form-control" 
                  value={form.bankName} 
                  onChange={e => set('bankName', e.target.value)}
                >
                  <option value="">-- Select Bank --</option>
                  {BANK_OPTIONS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {form.bankName === 'Other Bank' ? (
                <div className="form-group">
                  <label className="form-label">Specify Bank Name <span className="required">*</span></label>
                  <input 
                    className="form-control" 
                    placeholder="Enter bank name, e.g. Central Bank" 
                    value={form.customBankName} 
                    onChange={e => set('customBankName', e.target.value)} 
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Reference Number (UPI / Check / UTR) <span className="required">*</span></label>
                  <input 
                    className="form-control" 
                    placeholder="Reference / Transaction ID" 
                    value={form.referenceNumber} 
                    onChange={e => set('referenceNumber', e.target.value)} 
                  />
                </div>
              )}

              {form.bankName === 'Other Bank' && (
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Reference Number (UPI / Check / UTR) <span className="required">*</span></label>
                  <input 
                    className="form-control" 
                    placeholder="Reference / Transaction ID" 
                    value={form.referenceNumber} 
                    onChange={e => set('referenceNumber', e.target.value)} 
                  />
                </div>
              )}
            </>
          )}

          {/* Remarks */}
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Remarks</label>
            <textarea 
              className="form-control" 
              rows={2} 
              placeholder="e.g. Cleared bill inv-102" 
              value={form.remarks} 
              onChange={e => set('remarks', e.target.value)} 
            />
          </div>

        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal 
        open={!!deleteModal} 
        onClose={() => setDeleteModal(null)} 
        title="Delete Payment Entry"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete Entry</button>
          </>
        }
      >
        <div className="alert alert-danger">
          Are you sure you want to delete this payment entry of <strong>{formatCurrency(deleteModal?.amount)}</strong> logged on <strong>{deleteModal && formatDate(deleteModal.date)}</strong>? This will affect the cash flow balance calculations.
        </div>
      </Modal>
      {/* AI Payment Reminder Modal */}
      {reminderModal && (
        <div className="ai-reminder-overlay" onClick={() => setReminderModal(null)}>
          <div className="ai-reminder-modal" onClick={e => e.stopPropagation()}>
            <div className="ai-reminder-header">
              <div>
                <div className="ai-reminder-title">✦ AI Payment Reminder</div>
                <div className="ai-reminder-subtitle">For {reminderModal.name} · Due: {formatCurrency(reminderModal.balance)}</div>
              </div>
              <button className="ai-chat-close" onClick={() => setReminderModal(null)}>✕</button>
            </div>
            {reminderLoading ? (
              <div className="ai-insight-shimmer" style={{ padding: '16px 0' }}>
                <div className="ai-shimmer-line" />
                <div className="ai-shimmer-line" style={{ width: '80%' }} />
                <div className="ai-shimmer-line" style={{ width: '60%' }} />
              </div>
            ) : (
              <>
                <textarea
                  className="ai-reminder-textarea"
                  value={reminderText}
                  onChange={e => setReminderText(e.target.value)}
                  rows={5}
                />
                <div className="ai-reminder-actions">
                  <button
                    className="btn btn-primary"
                    onClick={handleCopyReminder}
                  >
                    {copied ? '✓ Copied!' : '📋 Copy Message'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => openReminderModal(reminderModal)}>↻ Regenerate</button>
                  <button className="btn btn-secondary" onClick={() => setReminderModal(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </Layout>
  );
}
