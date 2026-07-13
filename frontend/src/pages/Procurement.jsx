import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';
import { isAdmin } from '../utils/auth';

export default function Procurement() {
  const admin = isAdmin();
  const [tab, setTab] = useState('overview');
  const [vendors, setVendors] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceived, setGoodsReceived] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Vendor form
  const [vendorForm, setVendorForm] = useState({
    name: '', email: '', phone: '', kra_pin: '', payment_terms: 'Net 30'
  });

  // Requisition form
  const [requisitionForm, setRequisitionForm] = useState({
    requester_name: '', department: '', description: ''
  });

  // Purchase Order form
  const [poForm, setPoForm] = useState({
    vendor_id: '',
    po_number: '',
    order_date: new Date().toISOString().split('T')[0],
    items: [{ item_name: '', quantity: 1, unit_price: 0 }]
  });

  // Goods Received form
  const [grForm, setGrForm] = useState({
    po_id: '', received_by: '', notes: '', items: []
  });
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Edit state
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editingPoId, setEditingPoId] = useState(null);

  useEffect(() => {
    fetchSummary();
    fetchVendors();
    fetchPurchaseOrders();
  }, []);

  useEffect(() => {
    if (tab === 'vendors') fetchVendors();
    if (tab === 'requisitions') fetchRequisitions();
    if (tab === 'orders') fetchPurchaseOrders();
    if (tab === 'receiving') { fetchGoodsReceived(); fetchProducts(); fetchWarehouses(); }
  }, [tab]);

  const fetchSummary = async () => {
    try {
      const res = await API.get('/procurement/summary');
      setSummary(res.data);
    } catch (err) {
      setError('Failed to load summary');
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await API.get('/procurement/vendors');
      setVendors(res.data);
    } catch (err) {
      setError('Failed to load vendors');
    }
  };

  const fetchRequisitions = async () => {
    try {
      const res = await API.get('/procurement/requisitions');
      setRequisitions(res.data);
    } catch (err) {
      setError('Failed to load requisitions');
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const res = await API.get('/procurement/purchase-orders');
      setPurchaseOrders(res.data);
    } catch (err) {
      setError('Failed to load purchase orders');
    }
  };

  const fetchGoodsReceived = async () => {
    try {
      const res = await API.get('/procurement/goods-received');
      setGoodsReceived(res.data);
    } catch (err) {
      setError('Failed to load goods received');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await API.get('/inventory/products');
      setProducts(res.data);
    } catch (err) {}
  };

  const fetchWarehouses = async () => {
    try {
      const res = await API.get('/inventory/warehouses');
      setWarehouses(res.data);
    } catch (err) {}
  };

  const handlePoSelect = (poId) => {
    const selected = purchaseOrders.find(po => String(po.id) === String(poId));
    const items = (selected?.items || [])
      .filter(i => i && i.item_name)
      .map(i => ({ item_name: i.item_name, quantity: i.quantity, product_id: '', warehouse_id: '' }));
    setGrForm({ ...grForm, po_id: poId, items });
  };

  const updateGrItem = (index, field, value) => {
    const updated = [...grForm.items];
    updated[index][field] = value;
    setGrForm({ ...grForm, items: updated });
  };

  const handleCreateVendor = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editingVendorId) {
        await API.put(`/procurement/vendors/${editingVendorId}`, vendorForm);
        setSuccess('Vendor updated successfully');
        setEditingVendorId(null);
      } else {
        await API.post('/procurement/vendors', vendorForm);
        setSuccess('Vendor created successfully');
      }
      setVendorForm({ name: '', email: '', phone: '', kra_pin: '', payment_terms: 'Net 30' });
      fetchVendors();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save vendor');
    } finally {
      setLoading(false);
    }
  };

  const handleEditVendor = (v) => {
    setEditingVendorId(v.id);
    setVendorForm({ name: v.name, email: v.email || '', phone: v.phone || '', kra_pin: v.kra_pin || '', payment_terms: v.payment_terms || 'Net 30' });
  };

  const handleDeleteVendor = async (id) => {
    if (!window.confirm('Delete this vendor?')) return;
    try {
      await API.delete(`/procurement/vendors/${id}`);
      setSuccess('Vendor deleted');
      fetchVendors();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete vendor');
    }
  };

  const handleDeleteRequisition = async (id) => {
    if (!window.confirm('Delete this requisition?')) return;
    try {
      await API.delete(`/procurement/requisitions/${id}`);
      setSuccess('Requisition deleted');
      fetchRequisitions();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete requisition');
    }
  };

  const handleCreateRequisition = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/procurement/requisitions', requisitionForm);
      setSuccess('Requisition submitted successfully');
      setRequisitionForm({ requester_name: '', department: '', description: '' });
      fetchRequisitions();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create requisition');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRequisitionStatus = async (id, status) => {
    try {
      await API.patch(`/procurement/requisitions/${id}/status`, { status });
      setSuccess(`Requisition ${status} successfully`);
      fetchRequisitions();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update requisition');
    }
  };

  const updatePoItem = (index, field, value) => {
    const updated = [...poForm.items];
    updated[index][field] = field === 'item_name' ? value : Number(value);
    setPoForm({ ...poForm, items: updated });
  };

  const addPoItem = () => {
    setPoForm({
      ...poForm,
      items: [...poForm.items, { item_name: '', quantity: 1, unit_price: 0 }]
    });
  };

  const removePoItem = (index) => {
    if (poForm.items.length <= 1) return;
    setPoForm({ ...poForm, items: poForm.items.filter((_, i) => i !== index) });
  };

  const poTotal = poForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const handleCreatePO = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/procurement/purchase-orders', poForm);
      setSuccess('Purchase order created successfully');
      setPoForm({
        vendor_id: '',
        po_number: '',
        order_date: new Date().toISOString().split('T')[0],
        items: [{ item_name: '', quantity: 1, unit_price: 0 }]
      });
      fetchPurchaseOrders();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create purchase order');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePO = async (id) => {
    if (!window.confirm('Delete this purchase order? This cannot be undone.')) return;
    try {
      await API.delete(`/procurement/purchase-orders/${id}`);
      setSuccess('Purchase order deleted');
      fetchPurchaseOrders();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete purchase order');
    }
  };

  const handleDeleteGR = async (id) => {
    if (!window.confirm('Delete this goods received record?')) return;
    try {
      await API.delete(`/procurement/goods-received/${id}`);
      setSuccess('Record deleted');
      fetchGoodsReceived();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete record');
    }
  };

  const handleReceiveGoods = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/procurement/goods-received', grForm);
      setSuccess('Goods received — inventory and payables updated automatically');
      setGrForm({ po_id: '', received_by: '', notes: '', items: [] });
      fetchGoodsReceived();
      fetchPurchaseOrders();
      fetchProducts();
      fetchSummary();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record goods received');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status) => {
    if (status === 'approved' || status === 'received') return 'bg-green-50 text-green-700';
    if (status === 'pending' || status === 'open') return 'bg-orange-50 text-orange-700';
    if (status === 'rejected' || status === 'cancelled') return 'bg-red-50 text-red-700';
    return 'bg-gray-100 text-gray-600';
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'vendors', label: 'Vendors' },
    { key: 'requisitions', label: 'Requisitions' },
    { key: 'orders', label: 'Purchase Orders' },
    { key: 'receiving', label: 'Goods Received' },
  ];

  return (
    <MainLayout title="Procurement">

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError(''); setSuccess(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === t.key
                ? 'border-primary-700 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 border border-red-100">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg mb-4 border border-green-100">{success}</div>}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Orders', value: summary?.total_orders || 0, color: '#1e40af' },
              { label: 'Total Value', value: `KES ${Number(summary?.total_value || 0).toLocaleString()}`, color: '#065f46' },
              { label: 'Open Orders', value: summary?.open_orders || 0, color: '#92400e' },
              { label: 'Pending Requisitions', value: summary?.pending_requisitions || 0, color: '#a31b32' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-500 mb-2">{stat.label}</p>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Requisitions', value: summary?.total_requisitions || 0 },
              { label: 'Approved Requisitions', value: summary?.approved_requisitions || 0 },
              { label: 'Received Orders', value: summary?.received_orders || 0 },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-center">
                <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Recent Purchase Orders */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Purchase Orders</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">PO Number</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Vendor</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Amount</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-8 text-gray-400">No purchase orders yet</td></tr>
                ) : (
                  purchaseOrders.slice(0, 5).map(po => (
                    <tr key={po.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-mono text-gray-600">{po.po_number}</td>
                      <td className="py-2.5 px-3 text-gray-800">{po.vendor_name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{new Date(po.order_date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right font-medium">KES {Number(po.total_amount).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(po.status)}`}>
                          {po.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VENDORS ── */}
      {tab === 'vendors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              {editingVendorId ? 'Edit Vendor' : 'New Vendor'}
            </h2>
            <form onSubmit={handleCreateVendor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={vendorForm.name}
                  onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })}
                  required
                  placeholder="Vendor name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={vendorForm.email}
                  onChange={e => setVendorForm({ ...vendorForm, email: e.target.value })}
                  placeholder="email@vendor.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={vendorForm.phone}
                  onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })}
                  placeholder="07XXXXXXXX"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KRA PIN</label>
                <input
                  value={vendorForm.kra_pin}
                  onChange={e => setVendorForm({ ...vendorForm, kra_pin: e.target.value })}
                  placeholder="A000000000X"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select
                  value={vendorForm.payment_terms}
                  onChange={e => setVendorForm({ ...vendorForm, payment_terms: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Net 90">Net 90</option>
                  <option value="Cash">Cash on Delivery</option>
                  <option value="Prepaid">Prepaid</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                  style={{ backgroundColor: '#a31b32' }}
                >
                  {loading ? 'Saving...' : editingVendorId ? 'Update Vendor' : 'Create Vendor'}
                </button>
                {editingVendorId && (
                  <button
                    type="button"
                    onClick={() => { setEditingVendorId(null); setVendorForm({ name: '', email: '', phone: '', kra_pin: '', payment_terms: 'Net 30' }); }}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >Cancel</button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Vendors <span className="text-gray-400 font-normal text-sm">({vendors.length})</span>
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Phone</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Terms</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-8 text-gray-400">No vendors yet</td></tr>
                ) : (
                  vendors.map(v => (
                    <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{v.name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{v.email || '—'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{v.phone || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {v.payment_terms || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {admin && <button onClick={() => handleEditVendor(v)} className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3">Edit</button>}
                        {admin && <button onClick={() => handleDeleteVendor(v.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── REQUISITIONS ── */}
      {tab === 'requisitions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Requisition</h2>
            <form onSubmit={handleCreateRequisition} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requester Name</label>
                <input
                  value={requisitionForm.requester_name}
                  onChange={e => setRequisitionForm({ ...requisitionForm, requester_name: e.target.value })}
                  required
                  placeholder="Full name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  value={requisitionForm.department}
                  onChange={e => setRequisitionForm({ ...requisitionForm, department: e.target.value })}
                  required
                  placeholder="e.g. Pharmacy, ICU, Admin"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={requisitionForm.description}
                  onChange={e => setRequisitionForm({ ...requisitionForm, description: e.target.value })}
                  required
                  rows="4"
                  placeholder="Describe what is needed and why..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Submitting...' : 'Submit Requisition'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Requisitions <span className="text-gray-400 font-normal text-sm">({requisitions.length})</span>
            </h2>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {requisitions.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No requisitions yet</p>
              ) : (
                requisitions.map(r => (
                  <div key={r.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{r.requester_name}</p>
                        <p className="text-xs text-gray-400">{r.department} · {new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">{r.description}</p>
                    <div className="flex gap-2">
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateRequisitionStatus(r.id, 'approved')}
                            className="flex-1 text-xs py-1.5 rounded-lg text-white font-medium"
                            style={{ backgroundColor: '#065f46' }}
                          >Approve</button>
                          <button
                            onClick={() => handleUpdateRequisitionStatus(r.id, 'rejected')}
                            className="flex-1 text-xs py-1.5 rounded-lg text-white font-medium"
                            style={{ backgroundColor: '#a31b32' }}
                          >Reject</button>
                        </>
                      )}
                      {admin && <button
                        onClick={() => handleDeleteRequisition(r.id)}
                        className="px-3 text-xs py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 font-medium"
                      >Delete</button>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PURCHASE ORDERS ── */}
      {tab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Purchase Order</h2>
            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
                  <input
                    value={poForm.po_number}
                    onChange={e => setPoForm({ ...poForm, po_number: e.target.value })}
                    required
                    placeholder="PO-001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
                  <input
                    type="date"
                    value={poForm.order_date}
                    onChange={e => setPoForm({ ...poForm, order_date: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <select
                  value={poForm.vendor_id}
                  onChange={e => setPoForm({ ...poForm, vendor_id: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select vendor</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              {/* Line Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                <div className="space-y-2">
                  {poForm.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          value={item.item_name}
                          onChange={e => updatePoItem(index, 'item_name', e.target.value)}
                          required
                          placeholder="Item name"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updatePoItem(index, 'quantity', e.target.value)}
                          min="1"
                          placeholder="Qty"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={e => updatePoItem(index, 'unit_price', e.target.value)}
                          min="0"
                          placeholder="Price"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xs text-gray-600 font-medium">
                          {(item.quantity * item.unit_price).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePoItem(index)}
                          className="ml-1 text-red-400 hover:text-red-600 font-bold"
                        >×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addPoItem}
                  className="mt-2 text-xs text-primary-700 hover:underline font-medium"
                >
                  + Add item
                </button>
              </div>

              <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-gray-800">
                <span>Total</span>
                <span>KES {poTotal.toLocaleString()}</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Creating...' : 'Create Purchase Order'}
              </button>
            </form>
          </div>

          {/* PO List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Purchase Orders <span className="text-gray-400 font-normal text-sm">({purchaseOrders.length})</span>
            </h2>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {purchaseOrders.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No purchase orders yet</p>
              ) : (
                purchaseOrders.map(po => (
                  <div key={po.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{po.vendor_name}</p>
                        <p className="text-xs text-gray-400">{po.po_number} · {new Date(po.order_date).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(po.status)}`}>
                        {po.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-sm font-bold text-gray-800">KES {Number(po.total_amount).toLocaleString()}</p>
                      {admin && <button
                        onClick={() => handleDeletePO(po.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >Delete</button>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── GOODS RECEIVED ── */}
      {tab === 'receiving' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Receive Goods</h2>
            <form onSubmit={handleReceiveGoods} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order</label>
                <select
                  value={grForm.po_id}
                  onChange={e => handlePoSelect(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select PO</option>
                  {purchaseOrders.filter(po => po.status === 'open').map(po => (
                    <option key={po.id} value={po.id}>
                      {po.po_number} — {po.vendor_name} — KES {Number(po.total_amount).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                <input
                  value={grForm.received_by}
                  onChange={e => setGrForm({ ...grForm, received_by: e.target.value })}
                  required
                  placeholder="Name of person receiving goods"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={grForm.notes}
                  onChange={e => setGrForm({ ...grForm, notes: e.target.value })}
                  rows="3"
                  placeholder="Any notes about the delivery..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {grForm.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Map Items to Inventory</p>
                  <div className="space-y-3">
                    {grForm.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          {item.item_name} <span className="text-gray-400 font-normal">× {item.quantity}</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Product</label>
                            <select
                              value={item.product_id}
                              onChange={e => updateGrItem(idx, 'product_id', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              <option value="">— select product —</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Warehouse</label>
                            <select
                              value={item.warehouse_id}
                              onChange={e => updateGrItem(idx, 'warehouse_id', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              <option value="">— select warehouse —</option>
                              {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs text-blue-700 font-medium">Auto-wired on receipt:</p>
                <p className="text-xs text-blue-600 mt-1">— Inventory stock updated for mapped items</p>
                <p className="text-xs text-blue-600">— Bill created in Payables automatically</p>
                <p className="text-xs text-blue-600">— Journal entry posted to Accounting</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Processing...' : 'Confirm Goods Received'}
              </button>
            </form>
          </div>

          {/* Goods Received List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Received Deliveries <span className="text-gray-400 font-normal text-sm">({goodsReceived.length})</span>
            </h2>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {goodsReceived.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No deliveries recorded yet</p>
              ) : (
                goodsReceived.map(gr => (
                  <div key={gr.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{gr.vendor_name}</p>
                        <p className="text-xs text-gray-400">{gr.po_number} · {new Date(gr.delivery_date).toLocaleDateString()}</p>
                      </div>
                      <p className="text-sm font-bold text-green-600">KES {Number(gr.total_amount).toLocaleString()}</p>
                    </div>
                    {gr.received_by && <p className="text-xs text-gray-500 mt-1">Received by: {gr.received_by}</p>}
                    {gr.notes && <p className="text-xs text-gray-400 mt-1">{gr.notes}</p>}
                    <div className="mt-2 pt-2 border-t border-gray-50">
                      <span className="text-xs text-gray-400 italic">Use Supplier Return credit note to reverse</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
}