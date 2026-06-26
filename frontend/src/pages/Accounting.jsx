import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export default function Accounting() {
  const [tab, setTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [trialBalance, setTrialBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Account form
  const [accountForm, setAccountForm] = useState({
    code: '', name: '', type: 'asset', description: ''
  });

  // Journal entry form
  const [journalForm, setJournalForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    lines: [
      { account_id: '', debit: '', credit: '' },
      { account_id: '', debit: '', credit: '' },
    ]
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (tab === 'journal') fetchJournalEntries();
    if (tab === 'trial-balance') fetchTrialBalance();
  }, [tab]);

  const fetchAccounts = async () => {
    try {
      const res = await API.get('/accounting/accounts');
      if (res.data.length === 0) {
        // Auto-seed default chart of accounts for this tenant
        await API.post('/settings/seed-accounts');
        const seeded = await API.get('/accounting/accounts');
        setAccounts(seeded.data);
      } else {
        setAccounts(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch accounts');
    }
  };

  const fetchJournalEntries = async () => {
    try {
      const res = await API.get('/accounting/journal-entries');
      setJournalEntries([...res.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch journal entries');
    }
  };

  const fetchTrialBalance = async () => {
    try {
      const res = await API.get('/accounting/trial-balance');
      setTrialBalance(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch trial balance');
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/accounting/accounts', accountForm);
      setSuccess('Account created successfully');
      setAccountForm({ code: '', name: '', type: 'asset', description: '' });
      fetchAccounts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...journalForm.lines];
    updated[index][field] = value;
    setJournalForm({ ...journalForm, lines: updated });
  };

  const addLine = () => {
    setJournalForm({
      ...journalForm,
      lines: [...journalForm.lines, { account_id: '', debit: '', credit: '' }]
    });
  };

  const removeLine = (index) => {
    if (journalForm.lines.length <= 2) return;
    const updated = journalForm.lines.filter((_, i) => i !== index);
    setJournalForm({ ...journalForm, lines: updated });
  };

  const handleCreateJournal = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const lines = journalForm.lines.map(l => ({
        account_id: l.account_id,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }));
      await API.post('/accounting/journal-entries', { ...journalForm, lines });
      setSuccess('Journal entry created successfully');
      setJournalForm({
        date: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
        lines: [
          { account_id: '', debit: '', credit: '' },
          { account_id: '', debit: '', credit: '' },
        ]
      });
      fetchJournalEntries();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create journal entry');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: 'accounts', label: 'Chart of Accounts' },
    { key: 'journal', label: 'Journal Entries' },
    { key: 'trial-balance', label: 'Trial Balance' },
  ];

  return (
    <MainLayout title="Accounting">

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

      {/* ── CHART OF ACCOUNTS ── */}
      {tab === 'accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Create Account Form */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Account</h2>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
                <input
                  value={accountForm.code}
                  onChange={e => setAccountForm({ ...accountForm, code: e.target.value })}
                  required
                  placeholder="e.g. 1001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                  required
                  placeholder="e.g. Cash at Hand"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={accountForm.type}
                  onChange={e => setAccountForm({ ...accountForm, type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {ACCOUNT_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  value={accountForm.description}
                  onChange={e => setAccountForm({ ...accountForm, description: e.target.value })}
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
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>

          {/* Accounts List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Accounts <span className="text-gray-400 font-normal text-sm">({accounts.length})</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Code</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Name</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Type</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Balance (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-8 text-gray-400">No accounts yet</td></tr>
                  ) : (
                    accounts.map(account => (
                      <tr key={account.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-mono text-gray-600">{account.code}</td>
                        <td className="py-2.5 px-3 text-gray-800">{account.name}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            account.type === 'asset' ? 'bg-blue-50 text-blue-700' :
                            account.type === 'liability' ? 'bg-red-50 text-red-700' :
                            account.type === 'equity' ? 'bg-purple-50 text-purple-700' :
                            account.type === 'revenue' ? 'bg-green-50 text-green-700' :
                            'bg-orange-50 text-orange-700'
                          }`}>
                            {account.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-gray-800">
                          {Number(account.balance).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── JOURNAL ENTRIES ── */}
      {tab === 'journal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Create Journal Entry */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Journal Entry</h2>
            <form onSubmit={handleCreateJournal} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={journalForm.date}
                    onChange={e => setJournalForm({ ...journalForm, date: e.target.value })}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input
                    value={journalForm.reference}
                    onChange={e => setJournalForm({ ...journalForm, reference: e.target.value })}
                    placeholder="e.g. JE-002"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  value={journalForm.description}
                  onChange={e => setJournalForm({ ...journalForm, description: e.target.value })}
                  required
                  placeholder="e.g. Monthly rent payment"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Lines */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Journal Lines</label>
                <div className="space-y-2">
                  {journalForm.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select
                          value={line.account_id}
                          onChange={e => handleLineChange(index, 'account_id', e.target.value)}
                          required
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Select account</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={line.debit}
                          onChange={e => handleLineChange(index, 'debit', e.target.value)}
                          placeholder="Debit"
                          min="0"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={line.credit}
                          onChange={e => handleLineChange(index, 'credit', e.target.value)}
                          placeholder="Credit"
                          min="0"
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="text-red-400 hover:text-red-600 text-lg font-bold"
                        >×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addLine}
                  className="mt-2 text-xs text-primary-700 hover:underline font-medium"
                >
                  + Add line
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Posting...' : 'Post Journal Entry'}
              </button>
            </form>
          </div>

          {/* Journal Entries List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Entries</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {journalEntries.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No journal entries yet</p>
              ) : (
                journalEntries.map(entry => (
                  <div key={entry.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{entry.description}</p>
                        <p className="text-xs text-gray-400">{new Date(entry.date).toLocaleDateString()} · {entry.reference}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {entry.lines?.map((line, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600">
                          <span>{line.account_code} — {line.account_name}</span>
                          <span>
                            {line.debit > 0 && <span className="text-blue-600">Dr {Number(line.debit).toLocaleString()}</span>}
                            {line.credit > 0 && <span className="text-green-600">Cr {Number(line.credit).toLocaleString()}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TRIAL BALANCE ── */}
      {tab === 'trial-balance' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Trial Balance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">Code</th>
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">Account Name</th>
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">Type</th>
                  <th className="text-right py-2 px-3 text-gray-600 font-medium">Debit (KES)</th>
                  <th className="text-right py-2 px-3 text-gray-600 font-medium">Credit (KES)</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance?.accounts?.map(account => (
                  <tr key={account.code} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono text-gray-600">{account.code}</td>
                    <td className="py-2.5 px-3 text-gray-800">{account.name}</td>
                    <td className="py-2.5 px-3 text-gray-500 capitalize">{account.type}</td>
                    <td className="py-2.5 px-3 text-right text-blue-600 font-medium">
                      {account.balance > 0 ? Number(account.balance).toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-green-600 font-medium">
                      {account.balance < 0 ? Number(Math.abs(account.balance)).toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-semibold">
                  <td colSpan="3" className="py-3 px-3 text-gray-800">Total</td>
                  <td className="py-3 px-3 text-right text-blue-600">
                    {Number(trialBalance?.totalDebit || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right text-green-600">
                    {Number(trialBalance?.totalCredit || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

    </MainLayout>
  );
}