import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';

export default function Receivables() {
  const [tab, setTab] = useState('overview');
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit state
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);

  // Customer form
  const [customerForm, setCustomerForm] = useState({
    name: '', email: '', phone: '', address: '', customer_type: 'individual'
  });

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({
    customer_id: '',
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    tax_rate: 0,
    notes: '',
    items: [{ description: '', quantity: '', unit_price: '' }]
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    invoice_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    bank_account_id: '',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    fetchSummary();
    fetchCustomers();
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      const res = await API.get('/banking/accounts');
      setBankAccounts(res.data);
    } catch (err) {}
  };

  useEffect(() => {
    if (tab === 'invoices') { fetchInvoices(); fetchCustomers(); }
    if (tab === 'payments') { fetchPayments(); fetchInvoices(); }
    if (tab === 'customers') fetchCustomers();
  }, [tab]);

  const fetchSummary = async () => {
    try {
      const res = await API.get('/receivables/summary');
      setSummary(res.data);
    } catch { setError('Failed to load summary'); }
  };

  const fetchCustomers = async () => {
    try {
      const res = await API.get('/receivables/customers');
      setCustomers(res.data);
    } catch { setError('Failed to load customers'); }
  };

  const fetchInvoices = async () => {
    try {
      const res = await API.get('/receivables/invoices');
      setInvoices(res.data);
    } catch { setError('Failed to fetch invoices'); }
  };

  const fetchPayments = async () => {
    try {
      const res = await API.get('/receivables/payments');
      setPayments(res.data);
    } catch { setError('Failed to fetch payments'); }
  };

  // ── CUSTOMER handlers ──
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editingCustomerId) {
        await API.put(`/receivables/customers/${editingCustomerId}`, customerForm);
        setSuccess('Customer updated successfully');
        setEditingCustomerId(null);
      } else {
        await API.post('/receivables/customers', customerForm);
        setSuccess('Customer created successfully');
      }
      setCustomerForm({ name: '', email: '', phone: '', address: '', customer_type: 'individual' });
      fetchCustomers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save customer');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = (c) => {
    setEditingCustomerId(c.id);
    setCustomerForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', customer_type: c.customer_type });
  };

  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    setError('');
    try {
      await API.delete(`/receivables/customers/${id}`);
      setSuccess('Customer deleted');
      fetchCustomers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete customer');
    }
  };

  // ── INVOICE handlers ──
  const updateItem = (index, field, value) => {
    const updated = [...invoiceForm.items];
    updated[index][field] = value; // keep as raw string so '' shows as empty placeholder
    setInvoiceForm({ ...invoiceForm, items: updated });
  };

  const addItem = () => {
    setInvoiceForm({ ...invoiceForm, items: [...invoiceForm.items, { description: '', quantity: 1, unit_price: 0 }] });
  };

  const removeItem = (index) => {
    if (invoiceForm.items.length <= 1) return;
    setInvoiceForm({ ...invoiceForm, items: invoiceForm.items.filter((_, i) => i !== index) });
  };

  const subtotal = invoiceForm.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0);
  const taxAmount = (subtotal * invoiceForm.tax_rate) / 100;
  const totalAmount = subtotal + taxAmount;

  const blankInvoiceForm = () => ({
    customer_id: '',
    invoice_number: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    tax_rate: 0,
    notes: '',
    items: [{ description: '', quantity: '', unit_price: '' }]
  });

  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...invoiceForm,
        tax_rate: Number(invoiceForm.tax_rate) || 0,
        items: invoiceForm.items.map(it => ({
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
        })),
      };
      if (editingInvoiceId) {
        await API.put(`/receivables/invoices/${editingInvoiceId}`, payload);
        setSuccess('Invoice updated successfully');
        setEditingInvoiceId(null);
      } else {
        await API.post('/receivables/invoices', payload);
        setSuccess('Invoice created successfully');
      }
      setInvoiceForm(blankInvoiceForm());
      fetchInvoices();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleEditInvoice = async (inv) => {
    try {
      const res = await API.get(`/receivables/invoices/${inv.id}`);
      const data = res.data;
      setEditingInvoiceId(inv.id);
      setInvoiceForm({
        customer_id: data.customer_id,
        invoice_number: data.invoice_number,
        date: data.date?.split('T')[0] || '',
        due_date: data.due_date?.split('T')[0] || '',
        tax_rate: data.tax_rate || 0,
        notes: data.notes || '',
        items: data.items?.length ? data.items.map(it => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price })) : [{ description: '', quantity: 1, unit_price: 0 }],
      });
      setTab('invoices');
    } catch {
      setError('Failed to load invoice details');
    }
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    setError('');
    try {
      await API.delete(`/receivables/invoices/${id}`);
      setSuccess('Invoice deleted');
      fetchInvoices();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete invoice');
    }
  };

  // ── PAYMENT handlers ──
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/receivables/payments', { ...paymentForm, amount: Number(paymentForm.amount) });
      setSuccess('Payment recorded successfully');
      setPaymentForm({ invoice_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'cash', bank_account_id: '', reference: '', notes: '' });
      fetchBankAccounts();
      fetchPayments();
      fetchInvoices();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!window.confirm('Delete this payment? The invoice balance will be restored.')) return;
    setError('');
    try {
      await API.delete(`/receivables/payments/${id}`);
      setSuccess('Payment deleted');
      fetchPayments();
      fetchInvoices();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete payment');
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
    { key: 'customers', label: 'Customers' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'payments', label: 'Payments' },
  ];

  return (
    <MainLayout title="Receivables">

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError(''); setSuccess(''); setEditingCustomerId(null); setEditingInvoiceId(null); }}
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
              { label: 'Total Invoiced', value: `KES ${Number(summary?.total_invoiced || 0).toLocaleString()}`, color: '#1e40af' },
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
              { label: 'Total Invoices', value: summary?.total_invoices || 0 },
              { label: 'Paid Invoices', value: summary?.paid_invoices || 0 },
              { label: 'Open Invoices', value: summary?.open_invoices || 0 },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-center">
                <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Invoices</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Invoice #</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Customer</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Total</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Balance</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-8 text-gray-400">No invoices yet</td></tr>
                ) : (
                  invoices.slice(0, 5).map(inv => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-mono text-gray-600">{inv.invoice_number}</td>
                      <td className="py-2.5 px-3 text-gray-800">{inv.customer_name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{Number(inv.total_amount).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-red-600">{Number(inv.balance_due).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>
                          {inv.status}
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

      {/* ── CUSTOMERS ── */}
      {tab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                {editingCustomerId ? 'Edit Customer' : 'New Customer'}
              </h2>
              {editingCustomerId && (
                <button
                  onClick={() => { setEditingCustomerId(null); setCustomerForm({ name: '', email: '', phone: '', address: '', customer_type: 'individual' }); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  value={customerForm.name}
                  onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                  required
                  placeholder="Full name or company"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={customerForm.phone}
                  onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="07XXXXXXXX"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  value={customerForm.address}
                  onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })}
                  placeholder="Nairobi, Kenya"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={customerForm.customer_type}
                  onChange={e => setCustomerForm({ ...customerForm, customer_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                  <option value="ngo">NGO</option>
                  <option value="government">Government</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Saving...' : editingCustomerId ? 'Update Customer' : 'Create Customer'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Customers <span className="text-gray-400 font-normal text-sm">({customers.length})</span>
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Phone</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-8 text-gray-400">No customers yet</td></tr>
                ) : (
                  customers.map(c => (
                    <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 ${editingCustomerId === c.id ? 'bg-blue-50' : ''}`}>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{c.name}</td>
                      <td className="py-2.5 px-3 text-gray-500">{c.email || '—'}</td>
                      <td className="py-2.5 px-3 text-gray-500">{c.phone || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                          {c.customer_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => handleEditCustomer(c)} className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3">Edit</button>
                        <button onClick={() => handleDeleteCustomer(c.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── INVOICES ── */}
      {tab === 'invoices' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                {editingInvoiceId ? 'Edit Invoice' : 'New Invoice'}
              </h2>
              {editingInvoiceId && (
                <button
                  onClick={() => { setEditingInvoiceId(null); setInvoiceForm(blankInvoiceForm()); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveInvoice} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
                  <input
                    value={invoiceForm.invoice_number}
                    onChange={e => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })}
                    required
                    placeholder="INV-001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select
                    value={invoiceForm.customer_id}
                    onChange={e => setInvoiceForm({ ...invoiceForm, customer_id: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={invoiceForm.date}
                    onChange={e => setInvoiceForm({ ...invoiceForm, date: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={e => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
                <div className="space-y-2">
                  {invoiceForm.items.map((item, index) => (
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
                          {((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
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
                <button type="button" onClick={addItem} className="mt-2 text-xs text-primary-700 hover:underline font-medium">
                  + Add item
                </button>
              </div>

              {/* Tax & Totals */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-gray-600">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={invoiceForm.tax_rate}
                    onChange={e => setInvoiceForm({ ...invoiceForm, tax_rate: Number(e.target.value) })}
                    min="0"
                    max="100"
                    className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span>KES {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax ({invoiceForm.tax_rate}%)</span><span>KES {taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-800 border-t border-gray-100 pt-2">
                  <span>Total</span><span>KES {totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={invoiceForm.notes}
                  onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
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
                {loading ? 'Saving...' : editingInvoiceId ? 'Update Invoice' : 'Create Invoice'}
              </button>
            </form>
          </div>

          {/* Invoices List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Invoices <span className="text-gray-400 font-normal text-sm">({invoices.length})</span>
            </h2>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {invoices.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No invoices yet</p>
              ) : (
                invoices.map(inv => (
                  <div key={inv.id} className={`border rounded-lg p-4 transition ${editingInvoiceId === inv.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{inv.customer_name}</p>
                        <p className="text-xs text-gray-400">{inv.invoice_number} · {new Date(inv.date).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-2">
                      <span>Total: <strong>KES {Number(inv.total_amount).toLocaleString()}</strong></span>
                      <span>Balance: <strong className="text-red-600">KES {Number(inv.balance_due).toLocaleString()}</strong></span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Due: {new Date(inv.due_date).toLocaleDateString()}</div>
                    <div className="flex gap-3 mt-3 pt-2 border-t border-gray-100">
                      {inv.status !== 'paid' && (
                        <button onClick={() => handleEditInvoice(inv)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                      )}
                      <button onClick={() => handleDeleteInvoice(inv.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
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
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice</label>
                <select
                  value={paymentForm.invoice_id}
                  onChange={e => setPaymentForm({ ...paymentForm, invoice_id: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select invoice</option>
                  {invoices.filter(i => i.status !== 'paid').map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.customer_name} — KES {Number(inv.balance_due).toLocaleString()} due
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Receive to Account</label>
                <select
                  value={paymentForm.bank_account_id}
                  onChange={e => {
                    const acc = bankAccounts.find(a => String(a.id) === e.target.value);
                    const method = acc?.account_type === 'cash' ? 'cash' : acc?.account_type === 'mpesa' ? 'mpesa' : 'bank';
                    setPaymentForm({ ...paymentForm, bank_account_id: e.target.value, payment_method: e.target.value ? method : paymentForm.payment_method });
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">— select account —</option>
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} — KES {Number(acc.current_balance).toLocaleString()} ({acc.account_type})
                    </option>
                  ))}
                </select>
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
                        <p className="text-sm font-semibold text-gray-800">{p.customer_name}</p>
                        <p className="text-xs text-gray-400">{p.invoice_number} · {new Date(p.payment_date).toLocaleDateString()}</p>
                      </div>
                      <p className="text-sm font-bold text-green-600">KES {Number(p.amount).toLocaleString()}</p>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{p.payment_method}</span>
                      {p.reference && <span className="text-xs text-gray-400">{p.reference}</span>}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <button onClick={() => handleDeletePayment(p.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
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
