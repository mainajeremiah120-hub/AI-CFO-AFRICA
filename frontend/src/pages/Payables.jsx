import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';

export default function Payables() {
  const [tab, setTab] = useState('overview');
  const [suppliers, setSuppliers] = useState([]);
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Supplier form
  const [supplierForm, setSupplierForm] = useState({
    name: '', email: '', phone: '', address: '', supplier_type: 'company'
  });

  // Bill form
  const [billForm, setBillForm] = useState({
    supplier_id: '',
    bill_number: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    tax_rate: 0,
    notes: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }]
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    bill_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    fetchSummary();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (tab === 'bills') fetchBills();
    if (tab === 'payments') fetchPayments();
    if (tab === 'suppliers') fetchSuppliers();
  }, [tab]);

  const fetchSummary = async () => {
    try {
      const res = await API.get('/payables/summary');
      setSummary(res.data);
    } catch (err) {
      setError('Failed to load summary');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await API.get('/payables/suppliers');
      setSuppliers(res.data);
    } catch (err) {
      setError('Failed to load suppliers');
    }
  };

  const fetchBills = async () => {
    try {
      const res = await API.get('/payables/bills');
      setBills(res.data);
    } catch (err) {
      setError('Failed to fetch bills');
    }
  };

  const fetchPayments = async () => {
    try {
      const res = await API.get('/payables/payments');
      setPayments(res.data);
    } catch (err) {
      setError('Failed to fetch payments');
    }
  };

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/payables/suppliers', supplierForm);
      setSuccess('Supplier created successfully');
      setSupplierForm({ name: '', email: '', phone: '', address: '', supplier_type: 'company' });
      fetchSuppliers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create supplier');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index, field, value) => {
    const updated = [...billForm.items];
    updated[index][field] = field === 'description' ? value : Number(value);
    setBillForm({ ...billForm, items: updated });
  };

  const addItem = () => {
    setBillForm({
      ...billForm,
      items: [...billForm.items, { description: '', quantity: 1, unit_price: 0 }]
    });
  };

  const removeItem = (index) => {
    if (billForm.items.length <= 1) return;
    setBillForm({
      ...billForm,
      items: billForm.items.filter((_, i) => i !== index)
    });
  };

  const subtotal = billForm.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const taxAmount = (subtotal * billForm.tax_rate) / 100;
  const totalAmount = subtotal + taxAmount;

  const handleCreateBill = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/payables/bills', {
        ...billForm,
        tax_rate: Number(billForm.tax_rate),
      });
      setSuccess('Bill created successfully');
      setBillForm({
        supplier_id: '',
        bill_number: '',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        tax_rate: 0,
        notes: '',
        items: [{ description: '', quantity: 1, unit_price: 0 }]
      });
      fetchBills();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create bill');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/payables/payments', {
        ...paymentForm,
        amount: Number(paymentForm.amount),
      });
      setSuccess('Payment recorded successfully');
      setPaymentForm({
        bill_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        reference: '',
        notes: ''
      });
      fetchPayments();
      fetchBills();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status) => {
    if (status === 'paid') return 'bg-green-50 text-green-700';
    if (status === 'partial') return 'bg-orange-50 text-orange-700';
    if (status === 'overdue') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-600';
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'suppliers', label: 'Suppliers' },
    { key: 'bills', label: 'Bills' },
    { key: 'payments', label: 'Payments' },
  ];

  return (
    <MainLayout title="Payables">

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
              { label: 'Total Billed', value: `KES ${Number(summary?.total_billed || 0).toLocaleString()}`, color: '#1e40af' },
              { label: 'Total Paid', value: `KES ${Number(summary?.total_paid || 0).toLocaleString()}`, color: '#065f46' },
              { label: 'Outstanding', value: `KES ${Number(summary?.total_outstanding || 0).toLocaleString()}`, color: '#a31b32' },
              { label: 'Overdue', value: `KES ${Number(summary?.total_overdue || 0).toLocaleString()}`, color: '#92400e' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-500 mb-2">{stat.label}</p>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Bills', value: summary?.total_bills || 0 },
              { label: 'Paid Bills', value: summary?.paid_bills || 0 },
              { label: 'Open Bills', value: summary?.open_bills || 0 },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-center">
                <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Recent Bills */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Bills</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Bill #</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Supplier</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Total</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Balance</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-8 text-gray-400">No bills yet</td></tr>
                ) : (
                  bills.slice(0, 5).map(bill => (
                    <tr key={bill.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-mono text-gray-600">{bill.bill_number}</td>
                      <td className="py-2.5 px-3 text-gray-800">{bill.supplier_name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{new Date(bill.date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{Number(bill.total_amount).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-red-600">{Number(bill.balance_due).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(bill.status)}`}>
                          {bill.status}
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

      {/* ── SUPPLIERS ── */}
      {tab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Supplier</h2>
            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={supplierForm.name}
                  onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  required
                  placeholder="Supplier name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={supplierForm.email}
                  onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  placeholder="email@supplier.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={supplierForm.phone}
                  onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder="07XXXXXXXX"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  value={supplierForm.address}
                  onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="Nairobi, Kenya"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={supplierForm.supplier_type}
                  onChange={e => setSupplierForm({ ...supplierForm, supplier_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="company">Company</option>
                  <option value="individual">Individual</option>
                  <option value="government">Government</option>
                  <option value="ngo">NGO</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Creating...' : 'Create Supplier'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Suppliers <span className="text-gray-400 font-normal text-sm">({suppliers.length})</span>
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Phone</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-8 text-gray-400">No suppliers yet</td></tr>
                ) : (
                  suppliers.map(s => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{s.name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{s.email || '—'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{s.phone || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 capitalize">
                          {s.supplier_type}
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

      {/* ── BILLS ── */}
      {tab === 'bills' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Bill</h2>

            {/* Payball A/P info banner */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mb-4">
              <span className="text-amber-500 text-lg mt-0.5">📋</span>
              <div>
                <p className="text-xs font-semibold text-amber-800">Auto-journalized via Payball Account-1004</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Creating a bill posts: <strong>Dr 5001 Expenses</strong> / <strong>Cr 1004 Payball A/P</strong> — visible in your Trial Balance.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateBill} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bill #</label>
                  <input
                    value={billForm.bill_number}
                    onChange={e => setBillForm({ ...billForm, bill_number: e.target.value })}
                    required
                    placeholder="BILL-001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select
                    value={billForm.supplier_id}
                    onChange={e => setBillForm({ ...billForm, supplier_id: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={billForm.date}
                    onChange={e => setBillForm({ ...billForm, date: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={billForm.due_date}
                    onChange={e => setBillForm({ ...billForm, due_date: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
                <div className="space-y-2">
                  {billForm.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          value={item.description}
                          onChange={e => updateItem(index, 'description', e.target.value)}
                          required
                          placeholder="Description"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(index, 'quantity', e.target.value)}
                          min="1"
                          placeholder="Qty"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={e => updateItem(index, 'unit_price', e.target.value)}
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
                          onClick={() => removeItem(index)}
                          className="ml-2 text-red-400 hover:text-red-600 font-bold"
                        >×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="mt-2 text-xs text-primary-700 hover:underline font-medium"
                >
                  + Add item
                </button>
              </div>

              {/* Tax & Totals */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-gray-600">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={billForm.tax_rate}
                    onChange={e => setBillForm({ ...billForm, tax_rate: Number(e.target.value) })}
                    min="0"
                    max="100"
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>KES {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax ({billForm.tax_rate}%)</span>
                  <span>KES {taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-800 border-t border-gray-100 pt-2">
                  <span>Total</span>
                  <span>KES {totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={billForm.notes}
                  onChange={e => setBillForm({ ...billForm, notes: e.target.value })}
                  rows="2"
                  placeholder="Optional notes"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Creating...' : 'Create Bill'}
              </button>
            </form>
          </div>

          {/* Bills List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Bills <span className="text-gray-400 font-normal text-sm">({bills.length})</span>
            </h2>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {bills.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No bills yet</p>
              ) : (
                bills.map(bill => (
                  <div key={bill.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{bill.supplier_name}</p>
                        <p className="text-xs text-gray-400">{bill.bill_number} · {new Date(bill.date).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(bill.status)}`}>
                        {bill.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-2">
                      <span>Total: <strong>KES {Number(bill.total_amount).toLocaleString()}</strong></span>
                      <span>Balance: <strong className="text-red-600">KES {Number(bill.balance_due).toLocaleString()}</strong></span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Due: {new Date(bill.due_date).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENTS ── */}
      {tab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Record Payment</h2>

            {/* Payball A/P info banner */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4">
              <span className="text-blue-500 text-lg mt-0.5">🏦</span>
              <div>
                <p className="text-xs font-semibold text-blue-800">Payball Account-1004 (Accounts Payable)</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Every payment you record will automatically post a journal entry —{' '}
                  <strong>Dr 1004 Payball A/P</strong> / <strong>Cr 1002 Bank</strong> — and will be reflected in your Trial Balance.
                </p>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bill</label>
                <select
                  value={paymentForm.bill_id}
                  onChange={e => setPaymentForm({ ...paymentForm, bill_id: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select bill</option>
                  {bills.filter(b => b.status !== 'paid').map(bill => (
                    <option key={bill.id} value={bill.id}>
                      {bill.bill_number} — {bill.supplier_name} — KES {Number(bill.balance_due).toLocaleString()} due
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required
                    min="1"
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  value={paymentForm.reference}
                  onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="e.g. M-Pesa code or cheque number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Recording...' : 'Record Payment'}
              </button>
            </form>
          </div>

          {/* Payments List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Payment History <span className="text-gray-400 font-normal text-sm">({payments.length})</span>
            </h2>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {payments.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No payments yet</p>
              ) : (
                payments.map(p => (
                  <div key={p.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{p.supplier_name}</p>
                        <p className="text-xs text-gray-400">{p.bill_number} · {new Date(p.payment_date).toLocaleDateString()}</p>
                      </div>
                      <p className="text-sm font-bold text-red-600">KES {Number(p.amount).toLocaleString()}</p>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{p.payment_method}</span>
                      {p.reference && <span className="text-xs text-gray-400">{p.reference}</span>}
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