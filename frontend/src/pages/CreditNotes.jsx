import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';

const TYPE_LABELS = {
  customer_return:        'Customer Return / Invoice Reversal',
  supplier_return:        'Supplier Return / Returns Outward',
  stock_spoilage:         'Stock Spoilage / Write-Off',
  payment_reversal_invoice: 'Invoice Payment Reversal',
  payment_reversal_bill:  'Bill Payment Reversal',
};

const TYPE_COLORS = {
  customer_return:          'bg-blue-100 text-blue-700',
  supplier_return:          'bg-purple-100 text-purple-700',
  stock_spoilage:           'bg-orange-100 text-orange-700',
  payment_reversal_invoice: 'bg-red-100 text-red-700',
  payment_reversal_bill:    'bg-yellow-100 text-yellow-700',
};

function blankForm() {
  return {
    type: 'customer_return',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    amount: '',
    description: '',
    customer_id: '',
    supplier_id: '',
    invoice_id: '',
    bill_id: '',
    product_id: '',
    quantity: '',
    bank_account_id: '',
    payment_method: 'bank',
  };
}

export default function CreditNotes() {
  const [tab, setTab] = useState('overview');
  const [creditNotes, setCreditNotes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Reference data
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [bills, setBills] = useState([]);
  const [products, setProducts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    fetchSummary();
    fetchCreditNotes();
    fetchCustomers();
    fetchSuppliers();
    fetchInvoices();
    fetchBills();
    fetchProducts();
    fetchBankAccounts();
  }, []);

  const fetchSummary     = async () => { try { const r = await API.get('/credit-notes/summary'); setSummary(r.data); } catch {} };
  const fetchCreditNotes = async () => { try { const r = await API.get('/credit-notes'); setCreditNotes(r.data); } catch {} };
  const fetchCustomers   = async () => { try { const r = await API.get('/receivables/customers'); setCustomers(r.data); } catch {} };
  const fetchSuppliers   = async () => { try { const r = await API.get('/payables/suppliers'); setSuppliers(r.data); } catch {} };
  const fetchInvoices    = async () => { try { const r = await API.get('/receivables/invoices'); setInvoices(r.data); } catch {} };
  const fetchBills       = async () => { try { const r = await API.get('/payables/bills'); setBills(r.data); } catch {} };
  const fetchProducts    = async () => { try { const r = await API.get('/inventory/products'); setProducts(r.data); } catch {} };
  const fetchBankAccounts= async () => { try { const r = await API.get('/banking/accounts'); setBankAccounts(r.data); } catch {} };

  const needsCustomer  = ['customer_return', 'payment_reversal_invoice'].includes(form.type);
  const needsSupplier  = ['supplier_return', 'payment_reversal_bill'].includes(form.type);
  const needsInvoice   = ['customer_return', 'payment_reversal_invoice'].includes(form.type);
  const needsBill      = ['supplier_return', 'payment_reversal_bill'].includes(form.type);
  const needsProduct   = form.type === 'stock_spoilage';
  const needsBank      = ['payment_reversal_invoice', 'payment_reversal_bill'].includes(form.type);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/credit-notes', { ...form, amount: Number(form.amount) });
      setSuccess('Credit note posted successfully');
      setForm(blankForm());
      fetchCreditNotes();
      fetchSummary();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post credit note');
    } finally {
      setLoading(false);
    }
  };

  const handleVoid = async (id) => {
    if (!window.confirm('Void this credit note? This will reverse all accounting entries.')) return;
    try {
      await API.patch(`/credit-notes/${id}/void`);
      fetchCreditNotes();
      fetchSummary();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to void');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this credit note permanently?')) return;
    try {
      await API.delete(`/credit-notes/${id}`);
      fetchCreditNotes();
      fetchSummary();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'new',      label: '+ New Credit Note' },
    { key: 'list',     label: 'All Credit Notes' },
  ];

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Credit Notes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Returns, spoilage write-offs, and payment reversals — all with automatic double-entry posting
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Customer Returns',    value: summary?.customer_returns,     color: 'text-blue-600' },
                { label: 'Supplier Returns',    value: summary?.supplier_returns,     color: 'text-purple-600' },
                { label: 'Stock Spoilage',      value: summary?.stock_spoilage,       color: 'text-orange-600' },
                { label: 'Payment Reversals',   value: summary?.payment_reversals,    color: 'text-red-600' },
                { label: 'Total Posted',        value: summary?.total_amount,         color: 'text-gray-800' },
              ].map(card => (
                <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className={`text-xl font-bold ${card.color}`}>KES {fmt(card.value)}</p>
                </div>
              ))}
            </div>

            {/* Recent */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-800">Recent Credit Notes</h2>
                <button
                  onClick={() => setTab('new')}
                  className="text-sm text-white px-4 py-2 rounded-lg"
                  style={{ backgroundColor: '#a31b32' }}
                >
                  + New
                </button>
              </div>
              {creditNotes.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">No credit notes yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2">Reference</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Date</th>
                      <th className="pb-2 text-right">Amount</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditNotes.slice(0, 10).map(cn => (
                      <tr key={cn.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 font-mono">{cn.reference}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${TYPE_COLORS[cn.type]}`}>
                            {TYPE_LABELS[cn.type] || cn.type}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500">{cn.date?.split('T')[0]}</td>
                        <td className="py-2 text-right font-medium">KES {fmt(cn.amount)}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            cn.status === 'void' ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-700'
                          }`}>{cn.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── NEW CREDIT NOTE ───────────────────────────────────── */}
        {tab === 'new' && (
          <div className="max-w-xl">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-4">New Credit Note</h2>

              {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">{error}</div>}
              {success && <div className="bg-green-50 text-green-700 text-sm px-4 py-2 rounded-lg mb-4">{success}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit Note Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...blankForm(), type: e.target.value, date: form.date })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  >
                    {Object.entries(TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">{typeHint(form.type)}</p>
                </div>

                {/* Date + Reference */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference (optional)</label>
                    <input
                      value={form.reference}
                      onChange={e => setForm({ ...form, reference: e.target.value })}
                      placeholder="CN-001"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {/* Customer (if needed) */}
                {needsCustomer && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                    <select
                      value={form.customer_id}
                      onChange={e => setForm({ ...form, customer_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">— select customer —</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Invoice (if needed) */}
                {needsInvoice && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Related Invoice</label>
                    <select
                      value={form.invoice_id}
                      onChange={e => {
                        const inv = invoices.find(i => String(i.id) === e.target.value);
                        setForm({ ...form, invoice_id: e.target.value, amount: inv ? inv.balance_due : form.amount });
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">— select invoice —</option>
                      {invoices.filter(i => i.status !== 'void').map(i => (
                        <option key={i.id} value={i.id}>
                          {i.invoice_number} — {i.customer_name} (bal: KES {Number(i.balance_due).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Supplier (if needed) */}
                {needsSupplier && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                    <select
                      value={form.supplier_id}
                      onChange={e => setForm({ ...form, supplier_id: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">— select supplier —</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Bill (if needed) */}
                {needsBill && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Related Bill</label>
                    <select
                      value={form.bill_id}
                      onChange={e => {
                        const bill = bills.find(b => String(b.id) === e.target.value);
                        setForm({ ...form, bill_id: e.target.value, amount: bill ? bill.balance_due : form.amount });
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">— select bill —</option>
                      {bills.filter(b => b.status !== 'void').map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bill_number} — {b.supplier_name} (bal: KES {Number(b.balance_due).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Product + Quantity (spoilage) */}
                {needsProduct && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                      <select
                        value={form.product_id}
                        onChange={e => setForm({ ...form, product_id: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      >
                        <option value="">— select product —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (stock: {p.quantity_on_hand})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Written Off</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.quantity}
                        onChange={e => setForm({ ...form, quantity: e.target.value })}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                )}

                {/* Bank Account (payment reversals) */}
                {needsBank && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account (original payment was from)</label>
                    <select
                      value={form.bank_account_id}
                      onChange={e => {
                        const acc = bankAccounts.find(a => String(a.id) === e.target.value);
                        const method = acc?.account_type === 'cash' ? 'cash' : acc?.account_type === 'mpesa' ? 'mpesa' : 'bank';
                        setForm({ ...form, bank_account_id: e.target.value, payment_method: e.target.value ? method : form.payment_method });
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">— select account —</option>
                      {bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_name} — KES {Number(acc.current_balance).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description / Reason</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder="e.g. Customer returned 5 damaged units"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                  style={{ backgroundColor: '#a31b32' }}
                >
                  {loading ? 'Posting...' : 'Post Credit Note'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── LIST ─────────────────────────────────────────────── */}
        {tab === 'list' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-4">
              All Credit Notes <span className="text-gray-400 font-normal text-sm">({creditNotes.length})</span>
            </h2>
            {creditNotes.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-10">No credit notes yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2 pr-4">Reference</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Party</th>
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4 text-right">Amount</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditNotes.map(cn => (
                      <tr key={cn.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-mono text-xs">{cn.reference}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${TYPE_COLORS[cn.type]}`}>
                            {TYPE_LABELS[cn.type] || cn.type}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-gray-600">
                          {cn.customer_name || cn.supplier_name || '—'}
                        </td>
                        <td className="py-2 pr-4 text-gray-500">{cn.date?.split('T')[0]}</td>
                        <td className="py-2 pr-4 text-right font-medium">KES {fmt(cn.amount)}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            cn.status === 'void' ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-700'
                          }`}>{cn.status}</span>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            {cn.status === 'posted' && (
                              <button
                                onClick={() => handleVoid(cn.id)}
                                className="text-xs px-2 py-1 rounded bg-orange-50 text-orange-600 hover:bg-orange-100"
                              >
                                Void
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(cn.id)}
                              className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function typeHint(type) {
  const hints = {
    customer_return:          'Dr Revenue → Cr Receivable. Reduces what the customer owes and reverses income.',
    supplier_return:          'Dr Payable → Cr Inventory. Reduces what you owe supplier and reduces stock.',
    stock_spoilage:           'Dr General Expenses → Cr Inventory. Writes off damaged or expired stock.',
    payment_reversal_invoice: 'Dr Receivable → Cr Bank/Cash. Reverses a customer invoice payment already recorded.',
    payment_reversal_bill:    'Dr Bank/Cash → Cr Payable. Reverses a supplier bill payment already recorded.',
  };
  return hints[type] || '';
}
