import { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
import Modal from '../../components/UI/Modal';
import Toast, { useToast } from '../../components/UI/Toast';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../../api/customers';
import { useTableKeyNav } from '../../hooks/useTableKeyNav';
import { useKeyboardShortcut, useFormShortcuts } from '../../hooks/useKeyboardShortcut';

const EMPTY = { customerCode: '', gstNumber: '', customerName: '', customerAddress: '', customerPhone: '' };

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, show, hide } = useToast();

  const { getTableProps, getRowProps } = useTableKeyNav(customers, (c) => openEdit(c));
  useKeyboardShortcut('slash', () => document.getElementById('customer-search-input')?.focus());

  const load = () => {
    setLoading(true);
    getCustomers({ search }).then(r => setCustomers(r.data)).catch(e => show(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setModalOpen(true); };
  const openEdit = (c) => { setForm({ customerCode: c.customerCode || '', gstNumber: c.gstNumber, customerName: c.customerName, customerAddress: c.customerAddress, customerPhone: c.customerPhone }); setEditId(c._id); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.gstNumber || !form.customerName) { show('GST Number and Name are required', 'error'); return; }
    
    // Strict GST Number validation
    const gstVal = form.gstNumber.trim().toUpperCase();
    const isCash = gstVal === 'CASH';
    const gstRegex = /^[A-Z0-9]{15}$/;
    if (!isCash && !gstRegex.test(gstVal)) {
      show('GST Number must be strictly 15 alphanumeric characters (or "CASH" for retail)', 'error');
      return;
    }

    // Strict Phone Number validation (optional, validate only if entered)
    if (form.customerPhone && form.customerPhone.trim() !== '') {
      const phoneVal = form.customerPhone.trim();
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phoneVal)) {
        show('Phone number must be strictly a 10-digit number', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      // Normalize form before sending
      const payload = {
        ...form,
        gstNumber: gstVal,
        customerPhone: form.customerPhone ? form.customerPhone.trim() : ''
      };
      if (editId) { await updateCustomer(editId, payload); show('Customer updated'); }
      else { await createCustomer(payload); show('Customer added'); }
      setModalOpen(false); load();
    } catch (e) { show(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteCustomer(deleteModal._id); show('Customer deleted'); setDeleteModal(null); load(); }
    catch (e) { show(e.message, 'error'); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useFormShortcuts({ onSave: modalOpen ? handleSave : null });

  return (
    <Layout title="Customers">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Customers</h2>
          <p className="page-subtitle">Manage customer master data</p>
        </div>
        <div className="page-header-actions">
          <div className="search-bar">
            <span className="search-icon">&#x2315;</span>
            <input id="customer-search-input" placeholder="Search by name or GST..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Customer</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Customer Code</th><th>GST / Type</th><th>Customer Name</th><th>Address</th><th>Phone</th><th className="text-right">Actions</th></tr></thead>
            <tbody {...getTableProps()}>
              {loading && <tr><td colSpan={6}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>}
              {!loading && customers.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-icon">CS</div>
                    <div className="empty-title">No customers found</div>
                  </div>
                </td></tr>
              )}
              {!loading && customers.map((c, idx) => (
                <tr key={c._id} {...getRowProps(idx)}>
                  <td><span className="badge badge-purple">{c.customerCode}</span></td>
                  <td>
                    {c.gstNumber === 'CASH'
                      ? <span className="badge badge-warning">CASH</span>
                      : <span className="badge badge-blue">{c.gstNumber}</span>}
                  </td>
                  <td className="fw-600">{c.customerName}</td>
                  <td className="text-muted">{c.customerAddress || '—'}</td>
                  <td>{c.customerPhone || '—'}</td>
                  <td><div className="table-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(c)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Customer' : 'Add Customer'}
        footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} title="Save (Ctrl+Enter)">{saving ? <><span className="spinner"></span> Saving...</> : editId ? 'Update' : 'Add Customer'}</button></>}>
        <div className="form-grid form-grid-2">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Customer Code</label>
            <input className="form-control" value={form.customerCode} placeholder="Auto-generated" disabled />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">GST Number / Type <span className="required">*</span></label>
            <input className="form-control" value={form.gstNumber} onChange={e => set('gstNumber', e.target.value.toUpperCase())}
              placeholder="GST number or type CASH for retail" disabled={!!editId} style={{ textTransform: 'uppercase' }} />
            <span className="form-hint">Enter CASH for retail / unregistered customers</span>
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Customer Name <span className="required">*</span></label>
            <input className="form-control" value={form.customerName} onChange={e => set('customerName', e.target.value)} placeholder="Customer full name" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Address</label>
            <textarea className="form-control" rows={2} value={form.customerAddress} onChange={e => set('customerAddress', e.target.value)} placeholder="Full address" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-control" value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)} placeholder="+91 XXXXXXXXXX" />
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Customer"
        footer={<><button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button></>}>
        <div className="alert alert-danger">Are you sure you want to delete customer <strong>{deleteModal?.customerName}</strong>? This cannot be undone.</div>
      </Modal>
    </Layout>
  );
}
