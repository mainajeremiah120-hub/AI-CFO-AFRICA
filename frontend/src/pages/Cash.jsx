import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';

const MODULE_COLORS = {
  'Cash Receipt':   'bg-green-50 text-green-700',
  'Cash Payment':   'bg-red-50 text-red-700',
  'Petty Cash':     'bg-amber-50 text-amber-700',
  'Payables':       'bg-orange-50 text-orange-700',
  'Receivables':    'bg-blue-50 text-blue-700',
  'Opening Balance':'bg-purple-50 text-purple-700',
  'Adjustment':     'bg-yellow-50 text-yellow-700',
  'POS':            'bg-indigo-50 text-indigo-700',
  'Payroll':        'bg-pink-50 text-pink-700',
  'General':        'bg-gray-50 text-gray-600',
};

const today = new Date().toISOString().split('T')[0];

export default function Cash() {
  const [tab, setTab] = useState('overview');
  const [summary, setSummary] = useState(null);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]); // for replenishment source
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [txFilter, setTxFilter] = useState({ account_id: '', from: '', to: '' });
  const [ledgerFilter, setLedgerFilter] = useState({ from: '', to: '' });

  const [receiptForm, setReceiptForm] = useState({
    cash_account_id: '', amount: '', date: today,
    description: '', reference: '', receipt_type: 'cash_sale',
  });

  const [paymentForm, setPaymentForm] = useState({
    cash_account_id: '', amount: '', date: today,
    description: '', reference: '', payment_type: 'expense',
  });

  const [replenishForm, setReplenishForm] = useState({
    petty_cash_account_id: '', bank_account_id: '',
    amount: '', date: today, reference: '',
  });

  useEffect(() => {
    fetchSummary();
    fetchCashAccounts();
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    if (tab === 'transactions') fetchTransactions();
    if (tab === 'ledger') fetchLedger();
  }, [tab]);

  const fetchSummary = async () => {
    try {
      const res = await API.get('/cash/summary');
      setSummary(res.data);
      setCashAccounts(res.data.accounts || []);
    } catch {
      setError('Failed to load cash summary');
    }
  };

  const fetchCashAccounts = async () => {
    try {
      const res = await API.get('/cash/accounts');
      setCashAccounts(res.data);
    } catch {
      setError('Failed to load cash accounts');
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await API.get('/banking/accounts');
      setBankAccounts(res.data.filter(a => a.account_type === 'bank' || a.account_type === 'mpesa'));
    } catch {}
  };

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams();
      if (txFilter.account_id) params.append('account_id', txFilter.account_id);
      if (txFilter.from) params.append('from', txFilter.from);
      if (txFilter.to)   params.append('to',   txFilter.to);
      const res = await API.get(`/cash/transactions?${params}`);
      setTransactions(res.data);
    } catch {
      setError('Failed to load transactions');
    }
  };

  const fetchLedger = async () => {
    try {
      const params = new URLSearchParams();
      if (ledgerFilter.from) params.append('from', ledgerFilter.from);
      if (ledgerFilter.to)   params.append('to',   ledgerFilter.to);
      const res = await API.get(`/cash/ledger?${params}`);
      setLedger(res.data);
    } catch {
      setError('Failed to load ledger');
    }
  };

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3500); };

  const handleReceipt = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await API.post('/cash/receipt', { ...receiptForm, amount: Number(receiptForm.amount) });
      flash('Cash receipt recorded successfully');
      setReceiptForm({ cash_account_id: '', amount: '', date: today, description: '', reference: '', receipt_type: 'cash_sale' });
      fetchSummary();
      if (tab === 'transactions') fetchTransactions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record receipt');
    } finally { setLoading(false); }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await API.post('/cash/payment', { ...paymentForm, amount: Number(paymentForm.amount) });
      flash('Cash payment recorded successfully');
      setPaymentForm({ cash_account_id: '', amount: '', date: today, description: '', reference: '', payment_type: 'expense' });
      fetchSummary();
      if (tab === 'transactions') fetchTransactions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally { setLoading(false); }
  };

  const handleReplenish = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await API.post('/cash/replenish', { ...replenishForm, amount: Number(replenishForm.amount) });
      flash('Petty cash replenished successfully');
      setReplenishForm({ petty_cash_account_id: '', bank_account_id: '', amount: '', date: today, reference: '' });
      fetchSummary();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to replenish petty cash');
    } finally { setLoading(false); }
  };

  const ledgerTotals = ledger.reduce(
    (a, r) => ({ in: a.in + Number(r.debit), out: a.out + Number(r.credit) }),
    { in: 0, out: 0 }
  );

  const txTotals = transactions.reduce(
    (a, t) => ({
      in:  a.in  + (t.transaction_type === 'credit' ? Number(t.amount) : 0),
      out: a.out + (t.transaction_type === 'debit'  ? Number(t.amount) : 0),
    }),
    { in: 0, out: 0 }
  );

  const tabs = [
    { key: 'overview',     label: 'Overview' },
    { key: 'receipt',      label: 'Cash Receipt' },
    { key: 'payment',      label: 'Cash Payment' },
    { key: 'petty',        label: 'Petty Cash' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'ledger',       label: 'Cash Ledger' },
  ];

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
  const btnCls   = 'w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50 bg-amber-600 hover:bg-amber-700';

  return (
    <MainLayout title="Cash">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setError(''); setSuccess(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === t.key
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error   && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 border border-red-100">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg mb-4 border border-green-100">{success}</div>}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Cash on Hand',  value: `KES ${Number(summary?.total_cash   || 0).toLocaleString()}`, color: '#92400e' },
              { label: 'GL Cash Balance',     value: `KES ${Number(summary?.gl_cash_balance || 0).toLocaleString()}`, color: '#78350f' },
              { label: "Today's Receipts",    value: `KES ${Number(summary?.today_in      || 0).toLocaleString()}`, color: '#166534' },
              { label: "Today's Payments",    value: `KES ${Number(summary?.today_out     || 0).toLocaleString()}`, color: '#991b1b' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Month Cash In',       value: `KES ${Number(summary?.month_in            || 0).toLocaleString()}` },
              { label: 'Month Cash Out',      value: `KES ${Number(summary?.month_out           || 0).toLocaleString()}` },
              { label: 'Transactions (month)',value:  Number(summary?.total_transactions        || 0).toLocaleString() },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-center">
                <p className="text-lg font-bold text-gray-800">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Cash Accounts */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Cash Accounts</h2>
            {cashAccounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm mb-1">No cash accounts yet.</p>
                <p className="text-gray-400 text-xs">
                  Go to Banking → Bank Accounts and create an account with type "Cash" (e.g. "Petty Cash", "Cash at Hand").
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cashAccounts.map(acc => (
                  <div key={acc.id} className="border border-amber-100 bg-amber-50 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-semibold text-amber-900">{acc.account_name}</p>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">cash</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-800">
                      KES {Number(acc.current_balance).toLocaleString()}
                    </p>
                    {acc.account_number && (
                      <p className="text-xs text-amber-600 mt-1">{acc.account_number}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
            <strong>Note:</strong> M-Pesa is mobile money — it is NOT cash. M-Pesa transactions are recorded in the
            Banking module under bank/M-Pesa accounts. This Cash module tracks physical notes and coins only
            (Cash at Hand, Petty Cash).
          </div>
        </div>
      )}

      {/* ── CASH RECEIPT ── */}
      {tab === 'receipt' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">Record Cash Receipt</h2>
            <p className="text-xs text-gray-400 mb-4">Physical cash received. Posts Dr 1001 (Cash).</p>

            {cashAccounts.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No cash accounts found. Create a cash-type account in Banking first.
              </div>
            ) : (
              <form onSubmit={handleReceipt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cash Account</label>
                  <select value={receiptForm.cash_account_id}
                    onChange={e => setReceiptForm({ ...receiptForm, cash_account_id: e.target.value })}
                    required className={inputCls}
                  >
                    <option value="">Select cash account</option>
                    {cashAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} — KES {Number(a.current_balance).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Type</label>
                  <select value={receiptForm.receipt_type}
                    onChange={e => setReceiptForm({ ...receiptForm, receipt_type: e.target.value })}
                    className={inputCls}
                  >
                    <option value="cash_sale">Cash Sale (Cr Revenue)</option>
                    <option value="customer_payment">Customer Payment (Cr Receivables)</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {receiptForm.receipt_type === 'cash_sale'
                      ? 'Journal: Dr Cash (1001) → Cr Sales Revenue (4002)'
                      : 'Journal: Dr Cash (1001) → Cr Accounts Receivable (1003)'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                    <input type="number" min="1" required placeholder="0"
                      value={receiptForm.amount}
                      onChange={e => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" required value={receiptForm.date}
                      onChange={e => setReceiptForm({ ...receiptForm, date: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input required placeholder="e.g. Cash sale to walk-in patient"
                    value={receiptForm.description}
                    onChange={e => setReceiptForm({ ...receiptForm, description: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference (optional)</label>
                  <input placeholder="e.g. RCP-001"
                    value={receiptForm.reference}
                    onChange={e => setReceiptForm({ ...receiptForm, reference: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <button type="submit" disabled={loading} className={btnCls}>
                  {loading ? 'Recording…' : 'Record Cash Receipt'}
                </button>
              </form>
            )}
          </div>

          {/* Recent receipts */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Cash Receipts</h2>
            <RecentTransactions type="credit" onLoad={t => setTransactions(t)} />
          </div>
        </div>
      )}

      {/* ── CASH PAYMENT ── */}
      {tab === 'payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">Record Cash Payment</h2>
            <p className="text-xs text-gray-400 mb-4">Physical cash paid out. Posts Cr 1001 (Cash).</p>

            {cashAccounts.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No cash accounts found. Create a cash-type account in Banking first.
              </div>
            ) : (
              <form onSubmit={handlePayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cash Account</label>
                  <select value={paymentForm.cash_account_id}
                    onChange={e => setPaymentForm({ ...paymentForm, cash_account_id: e.target.value })}
                    required className={inputCls}
                  >
                    <option value="">Select cash account</option>
                    {cashAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} — KES {Number(a.current_balance).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
                  <select value={paymentForm.payment_type}
                    onChange={e => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}
                    className={inputCls}
                  >
                    <option value="expense">General Expense (Dr Expenses)</option>
                    <option value="petty_cash_expense">Petty Cash Expense (Dr Expenses)</option>
                    <option value="supplier_payment">Supplier Payment (Dr Payables)</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {paymentForm.payment_type === 'supplier_payment'
                      ? 'Journal: Dr Accounts Payable (1004) → Cr Cash (1001)'
                      : 'Journal: Dr General Expenses (5001) → Cr Cash (1001)'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                    <input type="number" min="1" required placeholder="0"
                      value={paymentForm.amount}
                      onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" required value={paymentForm.date}
                      onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input required placeholder="e.g. Office supplies purchase"
                    value={paymentForm.description}
                    onChange={e => setPaymentForm({ ...paymentForm, description: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference (optional)</label>
                  <input placeholder="e.g. PV-001"
                    value={paymentForm.reference}
                    onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <button type="submit" disabled={loading} className={btnCls}>
                  {loading ? 'Recording…' : 'Record Cash Payment'}
                </button>
              </form>
            )}
          </div>

          {/* Recent payments */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Cash Payments</h2>
            <RecentTransactions type="debit" onLoad={() => {}} />
          </div>
        </div>
      )}

      {/* ── PETTY CASH ── */}
      {tab === 'petty' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">Replenish Petty Cash</h2>
            <p className="text-xs text-gray-400 mb-4">
              Transfer from a bank account into a petty cash fund.
              Journal: Dr Cash (1001) → Cr Bank (1002).
            </p>

            {cashAccounts.length === 0 || bankAccounts.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {cashAccounts.length === 0
                  ? 'No cash accounts found. Create a cash-type account (e.g. "Petty Cash") in Banking → Bank Accounts.'
                  : 'No bank accounts found. Add a bank or M-Pesa account in Banking first.'}
              </div>
            ) : (
              <form onSubmit={handleReplenish} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Petty Cash Account (Destination)</label>
                  <select value={replenishForm.petty_cash_account_id}
                    onChange={e => setReplenishForm({ ...replenishForm, petty_cash_account_id: e.target.value })}
                    required className={inputCls}
                  >
                    <option value="">Select petty cash account</option>
                    {cashAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} — KES {Number(a.current_balance).toLocaleString()} balance
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Bank Account (Source)</label>
                  <select value={replenishForm.bank_account_id}
                    onChange={e => setReplenishForm({ ...replenishForm, bank_account_id: e.target.value })}
                    required className={inputCls}
                  >
                    <option value="">Select bank account</option>
                    {bankAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} — KES {Number(a.current_balance).toLocaleString()} available
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                    <input type="number" min="1" required placeholder="0"
                      value={replenishForm.amount}
                      onChange={e => setReplenishForm({ ...replenishForm, amount: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" required value={replenishForm.date}
                      onChange={e => setReplenishForm({ ...replenishForm, date: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference (optional)</label>
                  <input placeholder="e.g. PC-REPLEN-001"
                    value={replenishForm.reference}
                    onChange={e => setReplenishForm({ ...replenishForm, reference: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <button type="submit" disabled={loading} className={btnCls}>
                  {loading ? 'Processing…' : 'Replenish Petty Cash'}
                </button>
              </form>
            )}
          </div>

          {/* Petty cash accounts status */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Petty Cash Status</h2>
            {cashAccounts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No cash accounts yet.</p>
            ) : (
              <div className="space-y-4">
                {cashAccounts.map(acc => {
                  const bal = Number(acc.current_balance);
                  const pct = Math.min(100, (bal / 100000) * 100); // treat 100K as "full"
                  return (
                    <div key={acc.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-800">{acc.account_name}</p>
                        <p className={`text-sm font-bold ${bal < 5000 ? 'text-red-600' : bal < 20000 ? 'text-amber-600' : 'text-green-600'}`}>
                          KES {bal.toLocaleString()}
                        </p>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full ${bal < 5000 ? 'bg-red-400' : bal < 20000 ? 'bg-amber-400' : 'bg-green-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {bal < 5000 && (
                        <p className="text-xs text-red-500">Low balance — consider replenishing.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS ── */}
      {tab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
                <select value={txFilter.account_id}
                  onChange={e => setTxFilter(f => ({ ...f, account_id: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">All cash accounts</option>
                  {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input type="date" value={txFilter.from}
                  onChange={e => setTxFilter(f => ({ ...f, from: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input type="date" value={txFilter.to}
                  onChange={e => setTxFilter(f => ({ ...f, to: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <button onClick={fetchTransactions}
                className="px-4 py-1.5 text-sm text-white rounded-lg bg-amber-600 hover:bg-amber-700">
                Filter
              </button>
              <div className="ml-auto flex gap-6 text-sm">
                <span className="text-green-700 font-semibold">In: KES {txTotals.in.toLocaleString()}</span>
                <span className="text-red-600 font-semibold">Out: KES {txTotals.out.toLocaleString()}</span>
                <span className="text-gray-700 font-semibold">Net: KES {Math.abs(txTotals.in - txTotals.out).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                Cash Transactions
                <span className="ml-2 text-gray-400 font-normal text-sm">({transactions.length})</span>
              </h2>
            </div>
            {transactions.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">No cash transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3 text-right text-green-700">Cash In</th>
                      <th className="px-4 py-3 text-right text-red-600">Cash Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(tx.transaction_date).toLocaleDateString('en-KE')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{tx.description}</p>
                          {tx.reference && <p className="text-xs text-gray-400">{tx.reference}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{tx.account_name}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">
                          {tx.transaction_type === 'credit' ? `KES ${Number(tx.amount).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {tx.transaction_type === 'debit' ? `KES ${Number(tx.amount).toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CASH LEDGER ── */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                <input type="date" value={ledgerFilter.from}
                  onChange={e => setLedgerFilter(f => ({ ...f, from: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                <input type="date" value={ledgerFilter.to}
                  onChange={e => setLedgerFilter(f => ({ ...f, to: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <button onClick={fetchLedger}
                className="px-4 py-1.5 text-sm text-white rounded-lg bg-amber-600 hover:bg-amber-700">
                Filter
              </button>
              <div className="ml-auto flex gap-6 text-sm">
                <span className="text-green-700 font-semibold">Total In: KES {ledgerTotals.in.toLocaleString()}</span>
                <span className="text-red-600 font-semibold">Total Out: KES {ledgerTotals.out.toLocaleString()}</span>
                <span className="text-gray-700 font-semibold">Net: KES {(ledgerTotals.in - ledgerTotals.out).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-800">
                Account 1001 — Cash at Hand Ledger
                <span className="ml-2 text-gray-400 font-normal text-sm">({ledger.length} entries)</span>
              </h2>
              <p className="text-xs text-gray-400">All modules that touched physical cash</p>
            </div>

            {ledger.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">No cash journal entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right text-green-700">Cash In (Dr)</th>
                      <th className="px-4 py-3 text-right text-red-600">Cash Out (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ledger.map((row, i) => (
                      <tr key={`${row.id}-${i}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {new Date(row.transaction_date).toLocaleDateString('en-KE')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{row.description}</p>
                          {row.reference && <p className="text-xs text-gray-400">{row.reference}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MODULE_COLORS[row.source_module] || MODULE_COLORS.General}`}>
                            {row.source_module}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">
                          {Number(row.debit) > 0 ? `KES ${Number(row.debit).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {Number(row.credit) > 0 ? `KES ${Number(row.credit).toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 rounded-b-xl">
              Sourced from journal_lines for account 1001 — includes cash payments from Payables, Receivables, POS, and direct entries.
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

// Internal helper: loads and shows recent cash transactions (credit OR debit)
function RecentTransactions({ type }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    API.get('/cash/transactions').then(r => {
      setItems(r.data.filter(t => t.transaction_type === type).slice(0, 10));
    }).catch(() => {});
  }, [type]);

  if (items.length === 0) return (
    <p className="text-center text-gray-400 text-sm py-8">No {type === 'credit' ? 'receipts' : 'payments'} yet.</p>
  );

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {items.map(tx => (
        <div key={tx.id} className="border border-gray-100 rounded-lg p-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-800">{tx.description}</p>
              <p className="text-xs text-gray-400">
                {tx.account_name} · {new Date(tx.transaction_date).toLocaleDateString('en-KE')}
              </p>
            </div>
            <p className={`text-sm font-bold ${type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
              {type === 'credit' ? '+' : '-'} KES {Number(tx.amount).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
