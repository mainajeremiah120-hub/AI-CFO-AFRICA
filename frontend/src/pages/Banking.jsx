import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';

export default function Banking() {
  const [tab, setTab] = useState('overview');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [mpesaTransactions, setMpesaTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bank Account form
  const [accountForm, setAccountForm] = useState({
    account_name: '', account_number: '', bank_name: '',
    account_type: 'bank', current_balance: ''
  });

  // Transaction form
  const [transactionForm, setTransactionForm] = useState({
    bank_account_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    transaction_type: 'credit',
    reference: ''
  });

  // M-Pesa form
  const [mpesaForm, setMpesaForm] = useState({
    transaction_id: '',
    transaction_type: 'paybill',
    phone_number: '',
    amount: '',
    direction: 'in',
    account_reference: '',
    description: ''
  });

  useEffect(() => {
    fetchSummary();
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    if (tab === 'transactions') fetchTransactions();
    if (tab === 'mpesa') fetchMpesaTransactions();
    if (tab === 'accounts') fetchBankAccounts();
  }, [tab]);

  useEffect(() => {
    if (selectedAccount) fetchTransactions(selectedAccount);
  }, [selectedAccount]);

  const fetchSummary = async () => {
    try {
      const res = await API.get('/banking/summary');
      setSummary(res.data);
    } catch (err) {
      setError('Failed to load summary');
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await API.get('/banking/accounts');
      setBankAccounts(res.data);
    } catch (err) {
      setError('Failed to load bank accounts');
    }
  };

  const fetchTransactions = async (accountId = '') => {
    try {
      const url = accountId
        ? `/banking/transactions?bank_account_id=${accountId}`
        : '/banking/transactions';
      const res = await API.get(url);
      setTransactions(res.data);
    } catch (err) {
      setError('Failed to fetch transactions');
    }
  };

  const fetchMpesaTransactions = async () => {
    try {
      const res = await API.get('/banking/mpesa');
      setMpesaTransactions(res.data);
    } catch (err) {
      setError('Failed to fetch M-Pesa transactions');
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/banking/accounts', {
        ...accountForm,
        current_balance: Number(accountForm.current_balance) || 0
      });
      setSuccess('Bank account created successfully');
      setAccountForm({ account_name: '', account_number: '', bank_name: '', account_type: 'bank', current_balance: '' });
      fetchBankAccounts();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create bank account');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/banking/transactions', {
        ...transactionForm,
        amount: Number(transactionForm.amount)
      });
      setSuccess('Transaction recorded successfully');
      setTransactionForm({
        bank_account_id: '',
        transaction_date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        transaction_type: 'credit',
        reference: ''
      });
      fetchTransactions();
      fetchBankAccounts();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMpesa = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/banking/mpesa', {
        ...mpesaForm,
        amount: Number(mpesaForm.amount)
      });
      setSuccess('M-Pesa transaction recorded successfully');
      setMpesaForm({
        transaction_id: '',
        transaction_type: 'paybill',
        phone_number: '',
        amount: '',
        direction: 'in',
        account_reference: '',
        description: ''
      });
      fetchMpesaTransactions();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record M-Pesa transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async (id) => {
    try {
      await API.put(`/banking/transactions/${id}/reconcile`, {
        reconciled_with: 'manual',
        reconciled_id: id
      });
      setSuccess('Transaction reconciled');
      fetchTransactions();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reconcile transaction');
    }
  };

  const accountTypeColor = (type) => {
    if (type === 'mpesa') return 'bg-green-50 text-green-700';
    if (type === 'cash') return 'bg-orange-50 text-orange-700';
    return 'bg-blue-50 text-blue-700';
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'accounts', label: 'Bank Accounts' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'mpesa', label: 'M-Pesa' },
  ];

  return (
    <MainLayout title="Banking">

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
              { label: 'Total Balance', value: `KES ${Number(summary?.total_balance || 0).toLocaleString()}`, color: '#065f46' },
              { label: 'Bank Balance', value: `KES ${Number(summary?.bank_balance || 0).toLocaleString()}`, color: '#1e40af' },
              { label: 'M-Pesa Balance', value: `KES ${Number(summary?.mpesa_balance || 0).toLocaleString()}`, color: '#065f46' },
              { label: 'Unreconciled', value: summary?.unreconciled_count || 0, color: '#a31b32' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-500 mb-2">{stat.label}</p>
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total M-Pesa In', value: `KES ${Number(summary?.total_mpesa_in || 0).toLocaleString()}` },
              { label: 'Total M-Pesa Out', value: `KES ${Number(summary?.total_mpesa_out || 0).toLocaleString()}` },
              { label: 'Total Transactions', value: summary?.total_transactions || 0 },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-center">
                <p className="text-xl font-bold text-gray-800">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Bank Accounts Overview */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Your Accounts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankAccounts.length === 0 ? (
                <p className="text-gray-400 text-sm col-span-3 text-center py-8">No bank accounts yet</p>
              ) : (
                bankAccounts.map(acc => (
                  <div key={acc.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{acc.account_name}</p>
                        <p className="text-xs text-gray-400">{acc.bank_name || '—'}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${accountTypeColor(acc.account_type)}`}>
                        {acc.account_type}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                      KES {Number(acc.current_balance).toLocaleString()}
                    </p>
                    {acc.account_number && (
                      <p className="text-xs text-gray-400 mt-1">Acc: {acc.account_number}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── BANK ACCOUNTS ── */}
      {tab === 'accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Bank Account</h2>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  value={accountForm.account_name}
                  onChange={e => setAccountForm({ ...accountForm, account_name: e.target.value })}
                  required
                  placeholder="e.g. KCB Business Account"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={accountForm.account_type}
                  onChange={e => setAccountForm({ ...accountForm, account_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="bank">Bank Account</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input
                  value={accountForm.bank_name}
                  onChange={e => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                  placeholder="e.g. KCB, Equity, M-Pesa"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                <input
                  value={accountForm.account_number}
                  onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })}
                  placeholder="e.g. 1234567890"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (KES)</label>
                <input
                  type="number"
                  value={accountForm.current_balance}
                  onChange={e => setAccountForm({ ...accountForm, current_balance: e.target.value })}
                  min="0"
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Accounts <span className="text-gray-400 font-normal text-sm">({bankAccounts.length})</span>
            </h2>
            <div className="space-y-3">
              {bankAccounts.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No accounts yet</p>
              ) : (
                bankAccounts.map(acc => (
                  <div key={acc.id} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{acc.account_name}</p>
                      <p className="text-xs text-gray-400">{acc.bank_name} {acc.account_number ? `· ${acc.account_number}` : ''}</p>
                      <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${accountTypeColor(acc.account_type)}`}>
                        {acc.account_type}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-800">KES {Number(acc.current_balance).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">Current balance</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS ── */}
      {tab === 'transactions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Record Transaction</h2>
            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
                <select
                  value={transactionForm.bank_account_id}
                  onChange={e => setTransactionForm({ ...transactionForm, bank_account_id: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select account</option>
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.account_name} — KES {Number(acc.current_balance).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={transactionForm.transaction_type}
                    onChange={e => setTransactionForm({ ...transactionForm, transaction_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="credit">Credit (Money In)</option>
                    <option value="debit">Debit (Money Out)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={transactionForm.transaction_date}
                    onChange={e => setTransactionForm({ ...transactionForm, transaction_date: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  value={transactionForm.description}
                  onChange={e => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  required
                  placeholder="e.g. Payment from Commundo"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                  <input
                    type="number"
                    value={transactionForm.amount}
                    onChange={e => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                    required
                    min="1"
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input
                    value={transactionForm.reference}
                    onChange={e => setTransactionForm({ ...transactionForm, reference: e.target.value })}
                    placeholder="e.g. TXN-001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Recording...' : 'Record Transaction'}
              </button>
            </form>
          </div>

          {/* Transactions List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                Transactions <span className="text-gray-400 font-normal text-sm">({transactions.length})</span>
              </h2>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All accounts</option>
                {bankAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No transactions yet</p>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{tx.description}</p>
                        <p className="text-xs text-gray-400">{tx.account_name} · {new Date(tx.transaction_date).toLocaleDateString()}</p>
                      </div>
                      <p className={`text-sm font-bold ${tx.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.transaction_type === 'credit' ? '+' : '-'} KES {Number(tx.amount).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${tx.is_reconciled ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                        {tx.is_reconciled ? '✓ Reconciled' : 'Unreconciled'}
                      </span>
                      {!tx.is_reconciled && (
                        <button
                          onClick={() => handleReconcile(tx.id)}
                          className="text-xs text-primary-700 hover:underline font-medium"
                        >
                          Mark reconciled
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── M-PESA ── */}
      {tab === 'mpesa' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Record M-Pesa Transaction</h2>
            <form onSubmit={handleCreateMpesa} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                  <select
                    value={mpesaForm.direction}
                    onChange={e => setMpesaForm({ ...mpesaForm, direction: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="in">Money In</option>
                    <option value="out">Money Out</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={mpesaForm.transaction_type}
                    onChange={e => setMpesaForm({ ...mpesaForm, transaction_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="paybill">Paybill</option>
                    <option value="till">Till</option>
                    <option value="stk_push">STK Push</option>
                    <option value="b2c">B2C</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
                <input
                  value={mpesaForm.transaction_id}
                  onChange={e => setMpesaForm({ ...mpesaForm, transaction_id: e.target.value })}
                  required
                  placeholder="e.g. QJK8X2Y3P1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    value={mpesaForm.phone_number}
                    onChange={e => setMpesaForm({ ...mpesaForm, phone_number: e.target.value })}
                    placeholder="0712345678"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                  <input
                    type="number"
                    value={mpesaForm.amount}
                    onChange={e => setMpesaForm({ ...mpesaForm, amount: e.target.value })}
                    required
                    min="1"
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Reference</label>
                <input
                  value={mpesaForm.account_reference}
                  onChange={e => setMpesaForm({ ...mpesaForm, account_reference: e.target.value })}
                  placeholder="e.g. INV-001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  value={mpesaForm.description}
                  onChange={e => setMpesaForm({ ...mpesaForm, description: e.target.value })}
                  required
                  placeholder="e.g. Payment from John Kamau"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Recording...' : 'Record M-Pesa Transaction'}
              </button>
            </form>
          </div>

          {/* M-Pesa List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              M-Pesa History <span className="text-gray-400 font-normal text-sm">({mpesaTransactions.length})</span>
            </h2>
            <div className="space-y-3 max-h-screen overflow-y-auto">
              {mpesaTransactions.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No M-Pesa transactions yet</p>
              ) : (
                mpesaTransactions.map(tx => (
                  <div key={tx.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{tx.description}</p>
                        <p className="text-xs text-gray-400">{tx.transaction_id} · {tx.phone_number}</p>
                      </div>
                      <p className={`text-sm font-bold ${tx.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.direction === 'in' ? '+' : '-'} KES {Number(tx.amount).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full capitalize">
                        {tx.transaction_type}
                      </span>
                      {tx.account_reference && (
                        <span className="text-xs text-gray-400">Ref: {tx.account_reference}</span>
                      )}
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