import { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
import Modal from '../../components/UI/Modal';
import Toast, { useToast } from '../../components/UI/Toast';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../api/suppliers';
import { useTableKeyNav } from '../../hooks/useTableKeyNav';
import { useKeyboardShortcut, useFormShortcuts } from '../../hooks/useKeyboardShortcut';

const EMPTY = { supplierCode: '', gstNumber: '', supplierName: '', supplierAddress: '', supplierPhone: '' };

export default function SupplierList() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast, show, hide } = useToast();

  const { getTableProps, getRowProps } = useTableKeyNav(suppliers, (s) => openEdit(s));
  useKeyboardShortcut('slash', () => document.getElementById('supplier-search-input')?.focus());

  const load = () => {
    setLoading(true);
    getSuppliers({ search }).then(r => setSuppliers(r.data)).catch(e => show(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const openAdd = () => { setForm(EMPTY); setEditId(null); setModalOpen(true); };
  const openEdit = (s) => { setForm({ supplierCode: s.supplierCode || '', gstNumber: s.gstNumber, supplierName: s.supplierName, supplierAddress: s.supplierAddress, supplierPhone: s.supplierPhone }); setEditId(s._id); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.gstNumber || !form.supplierName) { show('GST Number and Name are required', 'error'); return; }
    
    // Strict GST Number validation
    const gstVal = form.gstNumber.trim().toUpperCase();
    const isCash = gstVal === 'CASH';
    const gstRegex = /^[A-Z0-9]{15}$/;
    if (!isCash && !gstRegex.test(gstVal)) {
      show('GST Number must be strictly 15 alphanumeric characters (or "CASH" if unregistered)', 'error');
      return;
    }

    // Strict Phone Number validation (optional, validate only if entered)
    if (form.supplierPhone && form.supplierPhone.trim() !== '') {
      const phoneVal = form.supplierPhone.trim();
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
        supplierPhone: form.supplierPhone ? form.supplierPhone.trim() : ''
      };
      if (editId) { await updateSupplier(editId, payload); show('Supplier updated'); }
      else { await createSupplier(payload); show('Supplier added'); }
      setModalOpen(false); load();
    } catch (e) { show(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteSupplier(deleteModal._id); show('Supplier deleted'); setDeleteModal(null); load(); }
    catch (e) { show(e.message, 'error'); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useFormShortcuts({ onSave: modalOpen ? handleSave : null });

  return (
    <Layout title="Suppliers">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Suppliers</h2>
          <p className="page-subtitle">Manage supplier master data</p>
        </div>
        <div className="page-header-actions">
          <div className="search-bar">
            <span className="search-icon">&#x2315;</span>
            <input id="supplier-search-input" placeholder="Search by name or GST..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Supplier Code</th><th>GST Number</th><th>Supplier Name</th><th>Address</th><th>Phone</th><th className="text-right">Actions</th></tr></thead>
            <tbody {...getTableProps()}>
              {loading && <tr><td colSpan={6}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>}
              {!loading && suppliers.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-icon">SP</div>
                    <div className="empty-title">No suppliers found</div>
                  </div>
                </td></tr>
              )}
              {!loading && suppliers.map((s, idx) => (
                <tr key={s._id} {...getRowProps(idx)}>
                  <td><span className="badge badge-purple">{s.supplierCode}</span></td>
                  <td><span className="badge badge-blue">{s.gstNumber}</span></td>
                  <td className="fw-600">{s.supplierName}</td>
                  <td className="text-muted">{s.supplierAddress || '—'}</td>
                  <td>{s.supplierPhone || '—'}</td>
                  <td><div className="table-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(s)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Supplier' : 'Add Supplier'}
        footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} title="Save (Ctrl+Enter)">{saving ? <><span className="spinner"></span> Saving...</> : editId ? 'Update' : 'Add Supplier'}</button></>}>
        <div className="form-grid form-grid-2">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Supplier Code</label>
            <input className="form-control" value={form.supplierCode} placeholder="Auto-generated" disabled />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">GST Number <span className="required">*</span></label>
            <input className="form-control" value={form.gstNumber} onChange={e => set('gstNumber', e.target.value.toUpperCase())}
              placeholder="e.g. 29ABCDE1234F1Z5" disabled={!!editId} style={{ textTransform: 'uppercase' }} />
            <span className="form-hint">Enter CASH for unregistered suppliers</span>
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Supplier Name <span className="required">*</span></label>
            <input className="form-control" value={form.supplierName} onChange={e => set('supplierName', e.target.value)} placeholder="Supplier company name" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Address</label>
            <textarea className="form-control" rows={2} value={form.supplierAddress} onChange={e => set('supplierAddress', e.target.value)} placeholder="Full address" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-control" value={form.supplierPhone} onChange={e => set('supplierPhone', e.target.value)} placeholder="+91 XXXXXXXXXX" />
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Supplier"
        footer={<><button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button></>}>
        <div className="alert alert-danger">Are you sure you want to delete supplier <strong>{deleteModal?.supplierName}</strong>? This cannot be undone.</div>
      </Modal>
    </Layout>
  );
}
