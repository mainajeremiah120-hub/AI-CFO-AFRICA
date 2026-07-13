import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';
import { isAdmin } from '../utils/auth';

const ROLES = ['admin', 'cfo', 'accountant', 'auditor', 'hr_manager', 'store_manager'];
const INDUSTRIES = ['Healthcare', 'Retail', 'Manufacturing', 'Logistics', 'Construction', 'NGO / Non-Profit', 'Education', 'Hospitality', 'Other'];
const PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 60', 'Net 90', 'Cash', 'Prepaid'];

const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 01-1-1V5a1 1 0 011-1h6a1 1 0 011 1v1a1 1 0 01-1 1H9z" />
  </svg>
);

export default function Settings() {
  const admin = isAdmin();
  const [tab, setTab] = useState('company');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [editUser, setEditUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', role: '', is_active: true });
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [userOpLoading, setUserOpLoading] = useState(false);

  // Master data
  const [masterTab, setMasterTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Edit / delete modal
  const [editItem, setEditItem] = useState(null);
  const [editType, setEditType] = useState('');
  const [editForm, setEditForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState('');

  // Company form
  const [companyForm, setCompanyForm] = useState({
    name: '', industry: '', country: 'Kenya', currency: 'KES'
  });

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    address: '', kra_pin: '', phone: '', email: '', website: '',
    default_tax_rate: 16, default_payment_terms: 'Net 30',
    fiscal_year_start: 1, date_format: 'DD/MM/YYYY',
    receipt_header: '', receipt_footer: 'Thank you for your business!',
    etr_device_number: '',
    low_stock_alerts: true, email_notifications: true,
    overdue_alerts: true, payroll_reminders: true,
  });

  // Profile form
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });

  // Statutory rates form
  const [ratesForm, setRatesForm] = useState({
    paye_rate: 0.20,
    nssf_amount: 2160,
    housing_levy_rate: 0.015,
    nhif_brackets: [
      { min_salary: 0,      max_salary: 15000,  amount: 150  },
      { min_salary: 15001,  max_salary: 30000,  amount: 500  },
      { min_salary: 30001,  max_salary: 50000,  amount: 850  },
      { min_salary: 50001,  max_salary: 100000, amount: 1200 },
      { min_salary: 100001, max_salary: null,   amount: 1700 },
    ],
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    current_password: '', new_password: '', confirm_password: ''
  });

  // Audit log
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditEntity, setAuditEntity] = useState('');

  // New user form
  const [userForm, setUserForm] = useState({
    name: '', email: '', password: '', role: 'accountant'
  });

  useEffect(() => {
    fetchSettings();
    fetchProfile();
    fetchUsers();
    fetchStatutoryRates();
  }, []);

  useEffect(() => {
    if (tab === 'master') fetchMasterData();
    if (tab === 'audit') fetchAuditLogs();
  }, [tab, masterTab]);

  const fetchAuditLogs = async (entity = auditEntity) => {
    try {
      const params = entity ? `?entity=${encodeURIComponent(entity)}` : '';
      const res = await API.get(`/audit${params}`);
      setAuditLogs(res.data);
    } catch {
      showMessage('Failed to load audit logs', true);
    }
  };

  const handleClearOldLogs = async () => {
    if (!window.confirm('Delete all audit log entries older than 90 days?')) return;
    try {
      const res = await API.delete('/audit/old');
      showMessage(res.data.message || 'Old logs cleared');
      fetchAuditLogs();
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to clear logs', true);
    }
  };

  const fetchStatutoryRates = async () => {
    try {
      const res = await API.get('/settings/statutory-rates');
      setRatesForm(res.data);
    } catch { /* silently use defaults */ }
  };

  const handleUpdateStatutoryRates = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.put('/settings/statutory-rates', ratesForm);
      showMessage('Statutory rates updated successfully');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update statutory rates', true);
    } finally {
      setLoading(false);
    }
  };

  const updateBracket = (index, field, value) => {
    const brackets = [...ratesForm.nhif_brackets];
    brackets[index] = { ...brackets[index], [field]: value === '' ? null : Number(value) };
    setRatesForm({ ...ratesForm, nhif_brackets: brackets });
  };

  const fetchSettings = async () => {
    try {
      const res = await API.get('/settings');
      const { company, settings } = res.data;
      setCompanyForm({
        name: company.name || '',
        industry: company.industry || '',
        country: company.country || 'Kenya',
        currency: company.currency || 'KES',
      });
      setSettingsForm({
        address: settings.address || '',
        kra_pin: settings.kra_pin || '',
        phone: settings.phone || '',
        email: settings.email || '',
        website: settings.website || '',
        default_tax_rate: settings.default_tax_rate || 16,
        default_payment_terms: settings.default_payment_terms || 'Net 30',
        fiscal_year_start: settings.fiscal_year_start || 1,
        date_format: settings.date_format || 'DD/MM/YYYY',
        receipt_header: settings.receipt_header || '',
        receipt_footer: settings.receipt_footer || 'Thank you for your business!',
        etr_device_number: settings.etr_device_number || '',
        low_stock_alerts: settings.low_stock_alerts ?? true,
        email_notifications: settings.email_notifications ?? true,
        overdue_alerts: settings.overdue_alerts ?? true,
        payroll_reminders: settings.payroll_reminders ?? true,
      });
    } catch (err) {
      setError('Failed to load settings');
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await API.get('/settings/profile');
      setProfileForm({ name: res.data.name || '', email: res.data.email || '' });
    } catch (err) {
      setError('Failed to load profile');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await API.get('/settings/users');
      setUsers(res.data);
    } catch (err) {
      setError('Failed to load users');
    }
  };

  const showMessage = (msg, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.put('/settings/company', companyForm);
      showMessage('Company details updated successfully');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update company', true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.put('/settings/update', settingsForm);
      showMessage('Settings updated successfully');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update settings', true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.put('/settings/profile', profileForm);
      const stored = JSON.parse(localStorage.getItem('user'));
      localStorage.setItem('user', JSON.stringify({ ...stored, name: profileForm.name, email: profileForm.email }));
      showMessage('Profile updated successfully');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update profile', true);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showMessage('New passwords do not match', true);
      return;
    }
    setLoading(true);
    try {
      await API.put('/settings/password', passwordForm);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      showMessage('Password changed successfully');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to change password', true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/settings/users', userForm);
      setUserForm({ name: '', email: '', password: '', role: 'accountant' });
      fetchUsers();
      showMessage('User created successfully');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to create user', true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (id, role, is_active) => {
    try {
      await API.put(`/settings/users/${id}`, { role, is_active });
      fetchUsers();
      showMessage('User updated successfully');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update user', true);
    }
  };

  const fetchMasterData = async () => {
    try {
      const fetchers = {
        accounts:   () => API.get('/accounting/accounts').then(r => setAccounts(r.data)),
        products:   () => API.get('/inventory/products').then(r => setProducts(r.data)),
        warehouses: () => API.get('/inventory/warehouses').then(r => setWarehouses(r.data)),
        customers:  () => API.get('/receivables/customers').then(r => setCustomers(r.data)),
        suppliers:  () => API.get('/payables/suppliers').then(r => setSuppliers(r.data)),
        employees:  () => API.get('/payroll/employees').then(r => setEmployees(r.data)),
        vendors:    () => API.get('/procurement/vendors').then(r => setVendors(r.data)),
      };
      await fetchers[masterTab]?.();
    } catch (err) {
      setError('Failed to load records');
    }
  };

  const openEdit = (type, item) => {
    setEditType(type);
    setEditItem(item);
    setEditForm({ ...item });
  };

  const handleEdit = async () => {
    setLoading(true);
    try {
      const routes = {
        accounts:   `/accounting/accounts/${editItem.id}`,
        products:   `/inventory/products/${editItem.id}`,
        warehouses: `/inventory/warehouses/${editItem.id}`,
        customers:  `/receivables/customers/${editItem.id}`,
        suppliers:  `/payables/suppliers/${editItem.id}`,
        employees:  `/payroll/employees/${editItem.id}`,
        vendors:    `/procurement/vendors/${editItem.id}`,
      };
      await API.put(routes[editType], editForm);
      setEditItem(null);
      fetchMasterData();
      showMessage('Record updated successfully');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update record', true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const routes = {
        accounts:   `/accounting/accounts/${deleteTarget.id}`,
        products:   `/inventory/products/${deleteTarget.id}`,
        warehouses: `/inventory/warehouses/${deleteTarget.id}`,
        customers:  `/receivables/customers/${deleteTarget.id}`,
        suppliers:  `/payables/suppliers/${deleteTarget.id}`,
        employees:  `/payroll/employees/${deleteTarget.id}`,
        vendors:    `/procurement/vendors/${deleteTarget.id}`,
      };
      await API.delete(routes[deleteType]);
      setDeleteTarget(null);
      fetchMasterData();
      showMessage('Record deleted');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to delete record', true);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async () => {
    setUserOpLoading(true);
    try {
      await API.put(`/settings/users/${editUser.id}`, editUserForm);
      setEditUser(null);
      fetchUsers();
      showMessage('User updated — notification email sent');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to update user', true);
    } finally {
      setUserOpLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    setUserOpLoading(true);
    try {
      await API.delete(`/settings/users/${deleteUserTarget.id}`);
      setDeleteUserTarget(null);
      fetchUsers();
      showMessage('User deleted');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to delete user', true);
    } finally {
      setUserOpLoading(false);
    }
  };

  const handleDataReset = async () => {
    if (resetConfirm !== 'RESET') {
      showMessage('Please type RESET to confirm', true);
      return;
    }
    setLoading(true);
    try {
      await API.post('/settings/reset', { confirm_text: resetConfirm });
      setShowResetModal(false);
      setResetConfirm('');
      showMessage('Transaction data cleared. Accounts and settings preserved.');
    } catch (err) {
      showMessage(err.response?.data?.error || 'Failed to reset data', true);
    } finally {
      setLoading(false);
    }
  };

  const Toggle = ({ value, onChange }) => (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-primary-700' : 'bg-gray-300'}`}
      style={value ? { backgroundColor: '#a31b32' } : {}}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  );

  const tabs = [
    { key: 'company',       label: 'Company' },
    { key: 'financial',     label: 'Financial' },
    { key: 'statutory',     label: 'Statutory Rates' },
    { key: 'pos',           label: 'POS & Receipt' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'profile',       label: 'My Profile' },
    { key: 'users',         label: 'Users' },
    { key: 'master',        label: 'Master Data' },
    { key: 'audit',         label: 'Audit Log' },
    { key: 'danger',        label: 'Data Reset' },
  ];

  return (
    <MainLayout title="Settings">

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
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

      {/* ── COMPANY ── */}
      {tab === 'company' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Company Details</h2>
            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  value={companyForm.name}
                  onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <select
                  value={companyForm.industry}
                  onChange={e => setCompanyForm({ ...companyForm, industry: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  value={companyForm.country}
                  onChange={e => setCompanyForm({ ...companyForm, country: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={companyForm.currency}
                  onChange={e => setCompanyForm({ ...companyForm, currency: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="KES">KES — Kenyan Shilling</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="UGX">UGX — Ugandan Shilling</option>
                  <option value="TZS">TZS — Tanzanian Shilling</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Saving...' : 'Save Company Details'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Contact & Tax Info</h2>
            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={settingsForm.address}
                  onChange={e => setSettingsForm({ ...settingsForm, address: e.target.value })}
                  rows="2"
                  placeholder="Business address"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">KRA PIN</label>
                <input
                  value={settingsForm.kra_pin}
                  onChange={e => setSettingsForm({ ...settingsForm, kra_pin: e.target.value })}
                  placeholder="A000000000X"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={settingsForm.phone}
                  onChange={e => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                  placeholder="0700000000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
                <input
                  type="email"
                  value={settingsForm.email}
                  onChange={e => setSettingsForm({ ...settingsForm, email: e.target.value })}
                  placeholder="info@business.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  value={settingsForm.website}
                  onChange={e => setSettingsForm({ ...settingsForm, website: e.target.value })}
                  placeholder="www.business.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Saving...' : 'Save Contact Info'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── FINANCIAL ── */}
      {tab === 'financial' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-lg">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Financial Settings</h2>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate (%)</label>
              <input
                type="number"
                value={settingsForm.default_tax_rate}
                onChange={e => setSettingsForm({ ...settingsForm, default_tax_rate: e.target.value })}
                min="0"
                max="100"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-400 mt-1">Kenya VAT is 16%</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms</label>
              <select
                value={settingsForm.default_payment_terms}
                onChange={e => setSettingsForm({ ...settingsForm, default_payment_terms: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year Start Month</label>
              <select
                value={settingsForm.fiscal_year_start}
                onChange={e => setSettingsForm({ ...settingsForm, fiscal_year_start: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
              <select
                value={settingsForm.date_format}
                onChange={e => setSettingsForm({ ...settingsForm, date_format: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
              style={{ backgroundColor: '#a31b32' }}
            >
              {loading ? 'Saving...' : 'Save Financial Settings'}
            </button>
          </form>
        </div>
      )}

      {/* ── POS & RECEIPT ── */}
      {tab === 'pos' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-lg">
          <h2 className="text-base font-semibold text-gray-800 mb-4">POS & Receipt Settings</h2>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Header</label>
              <textarea
                value={settingsForm.receipt_header}
                onChange={e => setSettingsForm({ ...settingsForm, receipt_header: e.target.value })}
                rows="2"
                placeholder="e.g. Nairobi General Hospital — Pharmacy"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Footer</label>
              <textarea
                value={settingsForm.receipt_footer}
                onChange={e => setSettingsForm({ ...settingsForm, receipt_footer: e.target.value })}
                rows="2"
                placeholder="e.g. Thank you for your business!"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ETR Device Number</label>
              <input
                value={settingsForm.etr_device_number}
                onChange={e => setSettingsForm({ ...settingsForm, etr_device_number: e.target.value })}
                placeholder="KRA ETR registration number"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-400 mt-1">Required for KRA compliance</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
              style={{ backgroundColor: '#a31b32' }}
            >
              {loading ? 'Saving...' : 'Save POS Settings'}
            </button>
          </form>
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === 'notifications' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-lg">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Notification Settings</h2>
          <form onSubmit={handleUpdateSettings} className="space-y-4">
            {[
              { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive system notifications via email' },
              { key: 'overdue_alerts', label: 'Overdue Invoice Alerts', desc: 'Alert when invoices become overdue' },
              { key: 'low_stock_alerts', label: 'Low Stock Alerts', desc: 'Alert when products hit reorder level' },
              { key: 'payroll_reminders', label: 'Payroll Reminders', desc: 'Remind when monthly payroll is due' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                </div>
                <Toggle
                  value={settingsForm[item.key]}
                  onChange={val => setSettingsForm({ ...settingsForm, [item.key]: val })}
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
              style={{ backgroundColor: '#a31b32' }}
            >
              {loading ? 'Saving...' : 'Save Notification Settings'}
            </button>
          </form>
        </div>
      )}

      {/* ── MY PROFILE ── */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">My Profile</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Saving...' : 'Update Profile'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Change Password</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Add New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  value={userForm.name}
                  onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  required
                  placeholder="John Kamau"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  required
                  placeholder="john@company.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                  required
                  placeholder="Min 6 characters"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              System Users <span className="text-gray-400 font-normal text-sm">({users.length})</span>
            </h2>
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="border border-gray-100 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Joined: {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      u.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {u.role.replace('_', ' ').toUpperCase()}
                    </span>
                    <button
                      onClick={() => { setEditUser(u); setEditUserForm({ name: u.name, email: u.email, role: u.role, is_active: u.is_active }); }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit user"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => setDeleteUserTarget(u)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Delete user"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MASTER DATA ── */}
      {tab === 'master' && (
        <div>
          {/* Sub-tabs */}
          <div className="flex gap-1 mb-5 overflow-x-auto">
            {[
              { key: 'accounts', label: 'Chart of Accounts' },
              { key: 'products', label: 'Products' },
              { key: 'warehouses', label: 'Warehouses' },
              { key: 'customers', label: 'Customers' },
              { key: 'suppliers', label: 'Suppliers' },
              { key: 'employees', label: 'Employees' },
              { key: 'vendors', label: 'Vendors' },
            ].map(st => (
              <button
                key={st.key}
                onClick={() => setMasterTab(st.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  masterTab === st.key ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={masterTab === st.key ? { backgroundColor: '#a31b32' } : {}}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Accounts */}
            {masterTab === 'accounts' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Balance</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {accounts.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.code}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{a.name}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{a.type}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{Number(a.balance || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit('accounts', a)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><PencilIcon /></button>
                          <button onClick={() => { setDeleteTarget(a); setDeleteType('accounts'); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><TrashIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Products */}
            {masterTab === 'products' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Price</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.category}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{Number(p.cost_price).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{Number(p.selling_price).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit('products', p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><PencilIcon /></button>
                          <button onClick={() => { setDeleteTarget(p); setDeleteType('products'); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><TrashIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Warehouses */}
            {masterTab === 'warehouses' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Location</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {warehouses.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{w.name}</td>
                      <td className="px-4 py-3 text-gray-500">{w.location}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit('warehouses', w)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><PencilIcon /></button>
                          <button onClick={() => { setDeleteTarget(w); setDeleteType('warehouses'); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><TrashIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Customers */}
            {masterTab === 'customers' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.email}</td>
                      <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{c.customer_type}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit('customers', c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><PencilIcon /></button>
                          <button onClick={() => { setDeleteTarget(c); setDeleteType('customers'); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><TrashIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Suppliers */}
            {masterTab === 'suppliers' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                      <td className="px-4 py-3 text-gray-500">{s.email}</td>
                      <td className="px-4 py-3 text-gray-500">{s.phone}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{s.supplier_type}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit('suppliers', s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><PencilIcon /></button>
                          <button onClick={() => { setDeleteTarget(s); setDeleteType('suppliers'); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><TrashIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Employees */}
            {masterTab === 'employees' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Department</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Basic Salary</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{e.full_name}</td>
                      <td className="px-4 py-3 text-gray-500">{e.position}</td>
                      <td className="px-4 py-3 text-gray-500">{e.department}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{Number(e.basic_salary).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit('employees', e)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><PencilIcon /></button>
                          <button onClick={() => { setDeleteTarget(e); setDeleteType('employees'); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><TrashIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Vendors */}
            {masterTab === 'vendors' && (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Payment Terms</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {vendors.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{v.name}</td>
                      <td className="px-4 py-3 text-gray-500">{v.email}</td>
                      <td className="px-4 py-3 text-gray-500">{v.phone}</td>
                      <td className="px-4 py-3 text-gray-500">{v.payment_terms}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => openEdit('vendors', v)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><PencilIcon /></button>
                          <button onClick={() => { setDeleteTarget(v); setDeleteType('vendors'); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><TrashIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── STATUTORY RATES ── */}
      {tab === 'statutory' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
            These rates are used for all new payroll runs. Existing processed payrolls are not affected.
            Rates are sourced from Kenya Revenue Authority (KRA) and relevant Acts.
          </div>

          <form onSubmit={handleUpdateStatutoryRates} className="space-y-6">

            {/* PAYE */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">PAYE — Income Tax</h2>
              <p className="text-xs text-gray-400 mb-4">Applied as a flat percentage of gross salary (simplified). Update when KRA changes the rate.</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">PAYE Rate (%)</label>
                  <input
                    type="number" min="0" max="100" step="0.01"
                    value={Number((ratesForm.paye_rate || 0) * 100).toFixed(2)}
                    onChange={e => setRatesForm({ ...ratesForm, paye_rate: Number(e.target.value) / 100 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-gray-500">Current Rate</p>
                  <p className="text-2xl font-bold text-orange-600">{Number((ratesForm.paye_rate || 0) * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* NSSF */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">NSSF — Pension Contribution</h2>
              <p className="text-xs text-gray-400 mb-4">Fixed monthly amount per employee (Tier I + Tier II combined cap under the NSSF Act 2013).</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">NSSF Amount (KES / month)</label>
                  <input
                    type="number" min="0" step="1"
                    value={ratesForm.nssf_amount || 2160}
                    onChange={e => setRatesForm({ ...ratesForm, nssf_amount: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-gray-500">Monthly Deduction</p>
                  <p className="text-2xl font-bold text-blue-600">KES {Number(ratesForm.nssf_amount || 2160).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Housing Levy */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Affordable Housing Levy</h2>
              <p className="text-xs text-gray-400 mb-4">Percentage of gross salary deducted per the Housing Levy Act 2023.</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Housing Levy Rate (%)</label>
                  <input
                    type="number" min="0" max="100" step="0.01"
                    value={Number((ratesForm.housing_levy_rate || 0) * 100).toFixed(2)}
                    onChange={e => setRatesForm({ ...ratesForm, housing_levy_rate: Number(e.target.value) / 100 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-gray-500">Current Rate</p>
                  <p className="text-2xl font-bold text-teal-600">{Number((ratesForm.housing_levy_rate || 0) * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* NHIF Brackets */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">NHIF / SHA — Health Insurance Brackets</h2>
              <p className="text-xs text-gray-400 mb-4">
                Monthly deduction based on gross salary range. Adjust when the government updates the NHIF/SHA contribution table.
                Brackets are evaluated from highest min_salary down.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600">
                      <th className="text-left px-3 py-2 font-semibold">Min Salary (KES)</th>
                      <th className="text-left px-3 py-2 font-semibold">Max Salary (KES)</th>
                      <th className="text-left px-3 py-2 font-semibold">NHIF Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ratesForm.nhif_brackets || []).map((b, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0"
                            value={b.min_salary ?? 0}
                            onChange={e => updateBracket(i, 'min_salary', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0"
                            value={b.max_salary ?? ''}
                            placeholder="No limit"
                            onChange={e => updateBracket(i, 'max_salary', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0"
                            value={b.amount ?? 0}
                            onChange={e => updateBracket(i, 'amount', e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-3">
                <button type="button"
                  onClick={() => setRatesForm({ ...ratesForm, nhif_brackets: [...(ratesForm.nhif_brackets||[]), { min_salary: 0, max_salary: null, amount: 0 }] })}
                  className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-medium">
                  + Add Bracket
                </button>
                {ratesForm.nhif_brackets?.length > 1 && (
                  <button type="button"
                    onClick={() => setRatesForm({ ...ratesForm, nhif_brackets: ratesForm.nhif_brackets.slice(0, -1) })}
                    className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium">
                    Remove Last
                  </button>
                )}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50"
              style={{ backgroundColor: '#a31b32' }}>
              {loading ? 'Saving…' : 'Save Statutory Rates'}
            </button>
          </form>
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2 className="text-base font-semibold text-gray-800 flex-1">Audit Log</h2>
              <select
                value={auditEntity}
                onChange={e => { setAuditEntity(e.target.value); fetchAuditLogs(e.target.value); }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Entities</option>
                <option value="invoice">Invoice</option>
                <option value="payment">Payment</option>
                <option value="bill">Bill</option>
                <option value="bill_payment">Bill Payment</option>
                <option value="payroll">Payroll</option>
              </select>
              {admin && (
                <button
                  onClick={handleClearOldLogs}
                  className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition"
                >
                  Clear logs older than 90 days
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Date / Time</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">User</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Action</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Entity</th>
                    <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-8 text-gray-400 text-sm">No audit logs found</td></tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-700">{log.user_name || '—'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.action === 'CREATE'  ? 'bg-green-50 text-green-700' :
                            log.action === 'DELETE'  ? 'bg-red-50 text-red-700' :
                            log.action === 'UPDATE'  ? 'bg-blue-50 text-blue-700' :
                            log.action === 'PROCESS' ? 'bg-purple-50 text-purple-700' :
                            log.action === 'LOGIN'   ? 'bg-gray-100 text-gray-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-600 capitalize">{log.entity}</td>
                        <td className="py-2.5 px-3 text-xs text-gray-500">{log.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DATA RESET ── */}
      {tab === 'danger' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl border border-red-100 shadow-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:2}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div>
                <h2 className="text-base font-semibold text-red-700">Data Reset</h2>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently delete all transaction data. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-4 mb-4 space-y-1">
              <p className="text-sm font-medium text-red-700">What will be deleted:</p>
              <p className="text-xs text-red-600">✗ All invoices and payments</p>
              <p className="text-xs text-red-600">✗ All bills and bill payments</p>
              <p className="text-xs text-red-600">✗ All journal entries</p>
              <p className="text-xs text-red-600">✗ All payroll runs and payslips</p>
              <p className="text-xs text-red-600">✗ All stock movements and levels</p>
              <p className="text-xs text-red-600">✗ All POS sessions and sales</p>
              <p className="text-xs text-red-600">✗ All purchase orders and goods received</p>
              <p className="text-xs text-red-600">✗ All bank transactions</p>
              <p className="text-xs text-red-600">✗ All account balances reset to 0</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4 mb-6 space-y-1">
              <p className="text-sm font-medium text-green-700">What will be preserved:</p>
              <p className="text-xs text-green-600">✓ Chart of accounts</p>
              <p className="text-xs text-green-600">✓ Company settings</p>
              <p className="text-xs text-green-600">✓ Users and roles</p>
              <p className="text-xs text-green-600">✓ Products and warehouses</p>
              <p className="text-xs text-green-600">✓ Customers and suppliers</p>
              <p className="text-xs text-green-600">✓ Employees</p>
              <p className="text-xs text-green-600">✓ Vendors</p>
            </div>

            <button
              onClick={() => setShowResetModal(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg text-sm transition"
            >
              Reset Transaction Data
            </button>
          </div>
        </div>
      )}

      {/* ── RESET CONFIRMATION MODAL ── */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h2 className="text-lg font-bold text-red-700">Confirm Data Reset</h2>
              <p className="text-sm text-gray-500 mt-1">
                This will permanently delete all transaction data. This cannot be undone.
              </p>
            </div>

            <div className="bg-red-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-red-600 text-center">
                Type <strong>RESET</strong> below to confirm
              </p>
            </div>

            <input
              value={resetConfirm}
              onChange={e => setResetConfirm(e.target.value)}
              placeholder="Type RESET here"
              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400 text-center font-mono"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setShowResetModal(false); setResetConfirm(''); }}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDataReset}
                disabled={resetConfirm !== 'RESET' || loading}
                className="flex-1 bg-red-600 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Yes, Reset Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ── */}
      {editUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Edit User</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input
                  value={editUserForm.name}
                  onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={editUserForm.email}
                  onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                <select
                  value={editUserForm.role}
                  onChange={e => setEditUserForm({ ...editUserForm, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ').toUpperCase()}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <span className="text-sm text-gray-700">Account Active</span>
                <button
                  type="button"
                  onClick={() => setEditUserForm({ ...editUserForm, is_active: !editUserForm.is_active })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editUserForm.is_active ? '' : 'bg-gray-300'}`}
                  style={editUserForm.is_active ? { backgroundColor: '#a31b32' } : {}}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editUserForm.is_active ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditUser(null)} className="flex-1 bg-gray-100 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
              <button onClick={handleEditUser} disabled={userOpLoading} className="flex-1 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50" style={{ backgroundColor: '#a31b32' }}>
                {userOpLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE USER MODAL ── */}
      {deleteUserTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Delete User?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to delete <strong>{deleteUserTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUserTarget(null)} className="flex-1 bg-gray-100 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
              <button onClick={handleDeleteUser} disabled={userOpLoading} className="flex-1 bg-red-600 text-white font-medium py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50">
                {userOpLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Edit {editType.replace(/s$/, '')}</h2>
            <div className="space-y-3">
              {Object.entries(editForm)
                .filter(([key]) => !['id','tenant_id','created_at','updated_at','is_active','total_stock'].includes(key))
                .map(([key, val]) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{key.replace(/_/g, ' ')}</label>
                    <input
                      value={val ?? ''}
                      onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditItem(null)}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={loading}
                className="flex-1 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <span className="text-4xl">🗑️</span>
            <h2 className="text-base font-semibold text-gray-800 mt-3 mb-2">Delete Record?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Are you sure you want to delete <strong>{deleteTarget.name || deleteTarget.full_name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-100 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 bg-red-600 text-white font-medium py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
}