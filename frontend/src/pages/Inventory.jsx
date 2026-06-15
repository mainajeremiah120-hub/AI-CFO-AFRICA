import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';

export default function Inventory() {
  const [tab, setTab] = useState('overview');
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Warehouse form
  const [warehouseForm, setWarehouseForm] = useState({ name: '', location: '' });

  // Product form
  const [productForm, setProductForm] = useState({
    sku: '', name: '', description: '', category: '', unit: 'pcs',
    cost_price: '', selling_price: '', reorder_level: ''
  });

  // Movement form
  const [movementForm, setMovementForm] = useState({
    product_id: '', warehouse_id: '', movement_type: 'in',
    quantity: '', reason: '', reference: ''
  });

  useEffect(() => {
    fetchSummary();
    fetchWarehouses();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (tab === 'products') fetchProducts();
    if (tab === 'movements') fetchMovements();
    if (tab === 'warehouses') fetchWarehouses();
  }, [tab]);

  const fetchSummary = async () => {
    try {
      const res = await API.get('/inventory/summary');
      setSummary(res.data);
    } catch (err) {
      setError('Failed to load summary');
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await API.get('/inventory/warehouses');
      setWarehouses(res.data);
    } catch (err) {
      setError('Failed to load warehouses');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await API.get('/inventory/products');
      setProducts(res.data);
    } catch (err) {
      setError('Failed to fetch products');
    }
  };

  const fetchMovements = async () => {
    try {
      const res = await API.get('/inventory/movements');
      setMovements(res.data);
    } catch (err) {
      setError('Failed to fetch movements');
    }
  };

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/inventory/warehouses', warehouseForm);
      setSuccess('Warehouse created successfully');
      setWarehouseForm({ name: '', location: '' });
      fetchWarehouses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create warehouse');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/inventory/products', {
        ...productForm,
        cost_price: Number(productForm.cost_price) || 0,
        selling_price: Number(productForm.selling_price) || 0,
        reorder_level: Number(productForm.reorder_level) || 0,
      });
      setSuccess('Product created successfully');
      setProductForm({
        sku: '', name: '', description: '', category: '', unit: 'pcs',
        cost_price: '', selling_price: '', reorder_level: ''
      });
      fetchProducts();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMovement = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/inventory/movements', {
        ...movementForm,
        quantity: Number(movementForm.quantity),
      });
      setSuccess('Stock movement recorded successfully');
      setMovementForm({
        product_id: '', warehouse_id: '', movement_type: 'in',
        quantity: '', reason: '', reference: ''
      });
      fetchMovements();
      fetchProducts();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record movement');
    } finally {
      setLoading(false);
    }
  };

  const stockBadge = (product) => {
    const stock = Number(product.total_stock);
    const reorder = Number(product.reorder_level);
    if (stock === 0) return 'bg-red-100 text-red-800';
    if (stock <= reorder) return 'bg-orange-50 text-orange-700';
    return 'bg-green-50 text-green-700';
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'products', label: 'Products' },
    { key: 'movements', label: 'Stock Movements' },
    { key: 'warehouses', label: 'Warehouses' },
  ];

  return (
    <MainLayout title="Inventory">

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError(''); setSuccess(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
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
              { label: 'Total Products', value: summary?.total_products || 0, color: '#1e40af' },
              { label: 'Stock Value', value: `KES ${Number(summary?.total_stock_value || 0).toLocaleString()}`, color: '#065f46' },
              { label: 'Low Stock Items', value: summary?.low_stock_count || 0, color: '#92400e' },
              { label: 'Out of Stock', value: summary?.out_of_stock_count || 0, color: '#a31b32' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-500 mb-2">{stat.label}</p>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Products needing attention */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Stock Levels</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">SKU</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Product</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Stock</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Reorder Level</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-8 text-gray-400">No products yet</td></tr>
                ) : (
                  products.slice(0, 8).map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-mono text-gray-600">{p.sku}</td>
                      <td className="py-2.5 px-3 text-gray-800">{p.name}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{Number(p.total_stock).toLocaleString()} {p.unit}</td>
                      <td className="py-2.5 px-3 text-right text-gray-500">{Number(p.reorder_level).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockBadge(p)}`}>
                          {Number(p.total_stock) === 0 ? 'Out of stock' : Number(p.total_stock) <= Number(p.reorder_level) ? 'Low stock' : 'In stock'}
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

      {/* ── PRODUCTS ── */}
      {tab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Create Product */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Product</h2>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    value={productForm.sku}
                    onChange={e => setProductForm({ ...productForm, sku: e.target.value })}
                    required
                    placeholder="e.g. HP-001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={productForm.unit}
                    onChange={e => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="pcs">Pieces</option>
                    <option value="box">Box</option>
                    <option value="kg">Kg</option>
                    <option value="litre">Litre</option>
                    <option value="pack">Pack</option>
                    <option value="set">Bag</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  required
                  placeholder="e.g. Laptop"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  value={productForm.category}
                  onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                  placeholder="e.g. HP"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                  <input
                    type="number"
                    value={productForm.cost_price}
                    onChange={e => setProductForm({ ...productForm, cost_price: e.target.value })}
                    min="0"
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
                  <input
                    type="number"
                    value={productForm.selling_price}
                    onChange={e => setProductForm({ ...productForm, selling_price: e.target.value })}
                    min="0"
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    value={productForm.reorder_level}
                    onChange={e => setProductForm({ ...productForm, reorder_level: e.target.value })}
                    min="0"
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  rows="2"
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Creating...' : 'Create Product'}
              </button>
            </form>
          </div>

          {/* Products List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Products <span className="text-gray-400 font-normal text-sm">({products.length})</span>
            </h2>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {products.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No products yet</p>
              ) : (
                products.map(p => (
                  <div key={p.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.sku} · {p.category || 'Uncategorized'}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockBadge(p)}`}>
                        {Number(p.total_stock).toLocaleString()} {p.unit}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-2">
                      <span>Cost: <strong>KES {Number(p.cost_price).toLocaleString()}</strong></span>
                      <span>Sell: <strong className="text-green-600">KES {Number(p.selling_price).toLocaleString()}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STOCK MOVEMENTS ── */}
      {tab === 'movements' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Record Movement */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Record Stock Movement</h2>
            <form onSubmit={handleCreateMovement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  value={movementForm.product_id}
                  onChange={e => setMovementForm({ ...movementForm, product_id: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                <select
                  value={movementForm.warehouse_id}
                  onChange={e => setMovementForm({ ...movementForm, warehouse_id: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Movement Type</label>
                  <select
                    value={movementForm.movement_type}
                    onChange={e => setMovementForm({ ...movementForm, movement_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="in">Stock In</option>
                    <option value="out">Stock Out</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={movementForm.quantity}
                    onChange={e => setMovementForm({ ...movementForm, quantity: e.target.value })}
                    required
                    min="1"
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  value={movementForm.reason}
                  onChange={e => setMovementForm({ ...movementForm, reason: e.target.value })}
                  placeholder="e.g. New delivery, Sale, Damaged"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  value={movementForm.reference}
                  onChange={e => setMovementForm({ ...movementForm, reference: e.target.value })}
                  placeholder="e.g.Invoice #"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Recording...' : 'Record Movement'}
              </button>
            </form>
          </div>

          {/* Movements List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Recent Movements <span className="text-gray-400 font-normal text-sm">({movements.length})</span>
            </h2>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {movements.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No movements yet</p>
              ) : (
                movements.map(m => (
                  <div key={m.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{m.product_name}</p>
                        <p className="text-xs text-gray-400">{m.sku} · {m.warehouse_name}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.movement_type === 'in' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {m.movement_type === 'in' ? '+ ' : '− '}{Number(m.quantity).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>{m.reason || '—'}</span>
                      <span>{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                    {m.reference && <p className="text-xs text-gray-400 mt-1">Ref: {m.reference}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── WAREHOUSES ── */}
      {tab === 'warehouses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Warehouse</h2>
            <form onSubmit={handleCreateWarehouse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={warehouseForm.name}
                  onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  required
                  placeholder="e.g. Main Store"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  value={warehouseForm.location}
                  onChange={e => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
                  placeholder="e.g. Nairobi Branch"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Creating...' : 'Create Warehouse'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Warehouses <span className="text-gray-400 font-normal text-sm">({warehouses.length})</span>
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.length === 0 ? (
                  <tr><td colSpan="2" className="text-center py-8 text-gray-400">No warehouses yet</td></tr>
                ) : (
                  warehouses.map(w => (
                    <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{w.name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{w.location || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </MainLayout>
  );
}