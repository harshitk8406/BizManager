import { useState, useEffect } from 'react';
import Layout from '../../components/Layout/Layout';
import Modal from '../../components/UI/Modal';
import Toast, { useToast } from '../../components/UI/Toast';
import { getItems, createItem, updateItem, deleteItem } from '../../api/items';
import { suggestHSN } from '../../api/ai';
import { formatCurrency } from '../../utils/format';
import { useTableKeyNav } from '../../hooks/useTableKeyNav';
import { useKeyboardShortcut, useFormShortcuts } from '../../hooks/useKeyboardShortcut';

const EMPTY_FORM = {
  itemCode: '',
  itemName: '',
  packingSize: '',
  hsnCode: '',
  openingQuantity: 0,
  purchasePrice: 0,
  salesPrice: 0,
  gstPercentage: 5,
};

const GST_SLABS = [0, 5, 12, 18, 28];

export default function ItemList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editCode, setEditCode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hsnLoading, setHsnLoading] = useState(false);
  const [hsnSuggested, setHsnSuggested] = useState(false);
  const { toast, show, hide } = useToast();

  // Keyboard support
  const { getTableProps, getRowProps } = useTableKeyNav(items, (item) => openEdit(item));
  useKeyboardShortcut('slash', () => document.getElementById('item-search-input')?.focus());
  useKeyboardShortcut('alt+n', () => { if (!modalOpen) openAdd(); }, { deps: [modalOpen] });

  const load = () => {
    setLoading(true);
    getItems({ search }).then(r => setItems(r.data)).catch(e => show(e.message, 'error')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditCode(null); setHsnSuggested(false); setModalOpen(true); };

  const openEdit = (item) => {
    setHsnSuggested(false);
    setForm({
      itemCode: item.itemCode,
      itemName: item.itemName,
      packingSize: item.packingSize,
      hsnCode: item.hsnCode,
      openingQuantity: item.openingQuantity,
      purchasePrice: item.purchasePrice,
      salesPrice: item.salesPrice,
      gstPercentage: item.gstPercentage,
    });
    setEditCode(item.itemCode);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.itemName || !form.packingSize || !form.hsnCode) { show('Please fill all required fields', 'error'); return; }
    setSaving(true);
    try {
      if (editCode) { await updateItem(editCode, form); show('Item updated successfully'); }
      else { await createItem(form); show('Item created successfully'); }
      setModalOpen(false); load();
    } catch (e) { show(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteItem(deleteModal.itemCode); show('Item deleted'); setDeleteModal(null); load(); }
    catch (e) { show(e.message, 'error'); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleHsnSuggest = async () => {
    if (!form.itemName.trim()) { show('Please enter an item name first', 'error'); return; }
    setHsnLoading(true);
    setHsnSuggested(false);
    try {
      const res = await suggestHSN(form.itemName, form.packingSize);
      setForm(f => ({ ...f, hsnCode: res.data.hsnCode, gstPercentage: res.data.gstPercentage }));
      setHsnSuggested(true);
      show(`AI suggested HSN ${res.data.hsnCode} @ ${res.data.gstPercentage}% GST`, 'success');
    } catch (e) {
      show(e.message || 'Could not fetch suggestion', 'error');
    } finally {
      setHsnLoading(false);
    }
  };

  useFormShortcuts({ onSave: modalOpen ? handleSave : null });

  return (
    <Layout title="Item Master">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={hide} key={toast.id} />}

      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-title">Item Master</h2>
          <p className="page-subtitle">Manage your product catalog and stock items</p>
        </div>
        <div className="page-header-actions">
          <div className="search-bar">
            <span className="search-icon">&#x2315;</span>
            <input id="item-search-input" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={openAdd} title="Add Item (Alt+N)">
            + Add Item <kbd style={{fontSize:10,opacity:0.7,marginLeft:6,background:'rgba(255,255,255,0.2)',padding:'1px 5px',borderRadius:3}}>Alt+N</kbd>
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Packing Size</th>
                <th>HSN Code</th>
                <th>GST %</th>
                <th className="text-right">Opening Qty</th>
                <th className="text-right">Closing Qty</th>
                <th className="text-right">Purchase Price</th>
                <th className="text-right">Sales Price</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody {...getTableProps()}>
              {loading && (
                <tr><td colSpan={10}><div className="loading-overlay"><div className="spinner"></div></div></td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-icon">IT</div>
                    <div className="empty-title">No items found</div>
                    <div className="empty-subtitle">Add your first item to get started</div>
                  </div>
                </td></tr>
              )}
              {!loading && items.map((item, idx) => (
                <tr key={item.itemCode} {...getRowProps(idx)}>
                  <td><span className="badge badge-blue">{item.itemCode}</span></td>
                  <td className="fw-600">{item.itemName}</td>
                  <td>{item.packingSize}</td>
                  <td><span className="badge badge-purple">{item.hsnCode}</span></td>
                  <td><span className="badge badge-teal">{item.gstPercentage}%</span></td>
                  <td className="text-right">{item.openingQuantity}</td>
                  <td className="text-right">
                    <span className={item.closingQuantity <= 0 ? 'text-danger fw-600' : item.closingQuantity < 10 ? 'text-warning fw-600' : 'text-success fw-600'}>
                      {item.closingQuantity}
                    </span>
                  </td>
                  <td className="text-right">{formatCurrency(item.purchasePrice)}</td>
                  <td className="text-right">{formatCurrency(item.salesPrice)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(item)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editCode ? `Edit Item — ${editCode}` : 'Add New Item'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} title="Save (Ctrl+Enter)">
              {saving ? <><span className="spinner"></span> Saving...</> : editCode ? 'Update Item' : 'Add Item'}
            </button>
          </>
        }
      >
        <div className="form-grid form-grid-2">
          <div className="form-group">
            <label className="form-label">Item Code <span className="text-muted">(auto if blank)</span></label>
            <input className="form-control" value={form.itemCode} onChange={e => set('itemCode', e.target.value)} placeholder="Auto-generated" disabled={!!editCode} />
          </div>
          <div className="form-group">
            <label className="form-label">Item Name <span className="required">*</span></label>
            <input className="form-control" value={form.itemName} onChange={e => set('itemName', e.target.value)} placeholder="e.g. Paracetamol" />
          </div>
          <div className="form-group">
            <label className="form-label">Packing Size <span className="required">*</span></label>
            <input className="form-control" value={form.packingSize} onChange={e => set('packingSize', e.target.value)} placeholder="e.g. 10x10, 500ml" />
          </div>
          <div className="form-group">
            <label className="form-label">HSN Code <span className="required">*</span></label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input className="form-control" value={form.hsnCode} onChange={e => { set('hsnCode', e.target.value); setHsnSuggested(false); }} placeholder="e.g. 30049099" style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleHsnSuggest}
                disabled={hsnLoading}
                title="Let AI suggest HSN code and GST %"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {hsnLoading ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Thinking...</> : '✦ AI Suggest'}
              </button>
            </div>
            {hsnSuggested && <div className="ai-badge">✦ AI suggested · verify before saving</div>}
          </div>
          <div className="form-group">
            <label className="form-label">GST Percentage <span className="required">*</span></label>
            <select className="form-control" value={form.gstPercentage} onChange={e => set('gstPercentage', Number(e.target.value))}>
              {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Opening Quantity</label>
            <input type="number" className="form-control" value={form.openingQuantity} onChange={e => set('openingQuantity', Number(e.target.value))} min={0} />
          </div>
          <div className="form-group">
            <label className="form-label">Purchase Price (Rs.)</label>
            <input type="number" className="form-control" value={form.purchasePrice} onChange={e => set('purchasePrice', Number(e.target.value))} min={0} step="0.01" />
          </div>
          <div className="form-group">
            <label className="form-label">Sales Price (Rs.)</label>
            <input type="number" className="form-control" value={form.salesPrice} onChange={e => set('salesPrice', Number(e.target.value))} min={0} step="0.01" />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Delete Item"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </>
        }
      >
        <div className="alert alert-danger">
          Are you sure you want to delete <strong>{deleteModal?.itemName}</strong>? This action cannot be undone.
        </div>
      </Modal>
    </Layout>
  );
}
