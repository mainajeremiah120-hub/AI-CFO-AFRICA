import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';

export default function Payroll() {
  const [tab, setTab] = useState('overview');
  const [employees, setEmployees] = useState([]);
  const [runs, setRuns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit state
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);

  // Employee form
  const [empForm, setEmpForm] = useState({
    employee_number: '', full_name: '', email: '', phone: '',
    position: '', department: '', basic_salary: '', bank_account: ''
  });

  // Run form
  const [runForm, setRunForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (tab === 'employees') fetchEmployees();
    if (tab === 'runs') fetchRuns();
  }, [tab]);

  const fetchSummary = async () => {
    try {
      const res = await API.get('/payroll/summary');
      setSummary(res.data);
    } catch { setError('Failed to load summary'); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await API.get('/payroll/employees');
      setEmployees(res.data);
    } catch { setError('Failed to load employees'); }
  };

  const fetchRuns = async () => {
    try {
      const res = await API.get('/payroll/runs');
      setRuns(res.data);
    } catch { setError('Failed to load payroll runs'); }
  };

  // ── EMPLOYEE handlers ──
  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { ...empForm, basic_salary: Number(empForm.basic_salary) };
      if (editingEmployeeId) {
        await API.put(`/payroll/employees/${editingEmployeeId}`, payload);
        setSuccess('Employee updated successfully');
        setEditingEmployeeId(null);
      } else {
        await API.post('/payroll/employees', payload);
        setSuccess('Employee added successfully');
      }
      setEmpForm({ employee_number: '', full_name: '', email: '', phone: '', position: '', department: '', basic_salary: '', bank_account: '' });
      fetchEmployees();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmployee = (emp) => {
    setEditingEmployeeId(emp.id);
    setEmpForm({
      employee_number: emp.employee_number || '',
      full_name: emp.full_name,
      email: emp.email || '',
      phone: emp.phone || '',
      position: emp.position || '',
      department: emp.department || '',
      basic_salary: emp.basic_salary,
      bank_account: emp.bank_account || '',
    });
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm('Delete this employee?')) return;
    setError('');
    try {
      await API.delete(`/payroll/employees/${id}`);
      setSuccess('Employee deleted');
      fetchEmployees();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete employee');
    }
  };

  // ── PAYROLL RUN handlers ──
  const handleCreateRun = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await API.post('/payroll/runs', runForm);
      setSuccess('Payroll run created');
      fetchRuns();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create run');
    } finally {
      setLoading(false);
    }
  };

  const processPayroll = async (runId) => {
    setLoading(true);
    setError('');
    try {
      await API.post(`/payroll/runs/${runId}/process`);
      setSuccess('Payroll processed successfully');
      fetchRuns();
      fetchSummary();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRun = async (id) => {
    if (!window.confirm('Delete this payroll run?')) return;
    setError('');
    try {
      await API.delete(`/payroll/runs/${id}`);
      setSuccess('Payroll run deleted');
      fetchRuns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete run');
    }
  };

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const runStatusColor = (status) => {
    if (status === 'processed') return 'bg-green-50 text-green-700';
    if (status === 'draft') return 'bg-gray-100 text-gray-600';
    return 'bg-orange-50 text-orange-700';
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'employees', label: 'Employees' },
    { key: 'runs', label: 'Payroll Runs' },
  ];

  return (
    <MainLayout title="Payroll">

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError(''); setSuccess(''); setEditingEmployeeId(null); }}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">Active Employees</p>
            <p className="text-3xl font-bold text-gray-800">{summary?.total_employees || 0}</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">Monthly Payroll</p>
            <p className="text-3xl font-bold text-blue-700">KES {Number(summary?.total_monthly_salary || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">Total Runs</p>
            <p className="text-3xl font-bold text-gray-800">{summary?.total_runs || 0}</p>
          </div>
        </div>
      )}

      {/* ── EMPLOYEES ── */}
      {tab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Add / Edit Employee */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-gray-800">
                {editingEmployeeId ? 'Edit Employee' : 'Add Employee'}
              </h2>
              {editingEmployeeId && (
                <button
                  onClick={() => { setEditingEmployeeId(null); setEmpForm({ employee_number: '', full_name: '', email: '', phone: '', position: '', department: '', basic_salary: '', bank_account: '' }); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveEmployee} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Employee #</label>
                  <input
                    value={empForm.employee_number}
                    onChange={e => setEmpForm({ ...empForm, employee_number: e.target.value })}
                    placeholder="EMP-001"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    value={empForm.full_name}
                    onChange={e => setEmpForm({ ...empForm, full_name: e.target.value })}
                    required
                    placeholder="Jane Doe"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={empForm.email}
                    onChange={e => setEmpForm({ ...empForm, email: e.target.value })}
                    placeholder="jane@company.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    value={empForm.phone}
                    onChange={e => setEmpForm({ ...empForm, phone: e.target.value })}
                    placeholder="07XXXXXXXX"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                  <input
                    value={empForm.position}
                    onChange={e => setEmpForm({ ...empForm, position: e.target.value })}
                    placeholder="Accountant"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                  <input
                    value={empForm.department}
                    onChange={e => setEmpForm({ ...empForm, department: e.target.value })}
                    placeholder="Finance"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Basic Salary (KES)</label>
                  <input
                    type="number"
                    value={empForm.basic_salary}
                    onChange={e => setEmpForm({ ...empForm, basic_salary: e.target.value })}
                    required
                    min="0"
                    placeholder="50000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bank Account</label>
                  <input
                    value={empForm.bank_account}
                    onChange={e => setEmpForm({ ...empForm, bank_account: e.target.value })}
                    placeholder="Account number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50 mt-2"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Saving...' : editingEmployeeId ? 'Update Employee' : 'Add Employee'}
              </button>
            </form>
          </div>

          {/* Employees List */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Employees <span className="text-gray-400 font-normal text-sm">({employees.length})</span>
            </h2>
            <div className="space-y-3 overflow-y-auto max-h-screen">
              {employees.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No employees yet</p>
              ) : (
                employees.map(emp => (
                  <div key={emp.id} className={`border rounded-lg p-4 transition ${editingEmployeeId === emp.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{emp.full_name}</p>
                        <p className="text-xs text-gray-400">
                          {emp.employee_number && <span className="mr-2">{emp.employee_number}</span>}
                          {emp.position && <span>{emp.position}</span>}
                          {emp.department && <span> · {emp.department}</span>}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-blue-700">KES {Number(emp.basic_salary).toLocaleString()}</p>
                    </div>
                    {(emp.email || emp.phone) && (
                      <p className="text-xs text-gray-500 mt-1">
                        {emp.email && <span className="mr-3">{emp.email}</span>}
                        {emp.phone && <span>{emp.phone}</span>}
                      </p>
                    )}
                    <div className="flex gap-3 mt-3 pt-2 border-t border-gray-100">
                      <button onClick={() => handleEditEmployee(emp)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                      <button onClick={() => handleDeleteEmployee(emp.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PAYROLL RUNS ── */}
      {tab === 'runs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Create Run */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Payroll Run</h2>
            <form onSubmit={handleCreateRun} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={runForm.month}
                  onChange={e => setRunForm({ ...runForm, month: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  value={runForm.year}
                  onChange={e => setRunForm({ ...runForm, year: Number(e.target.value) })}
                  min="2020"
                  max="2099"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
                style={{ backgroundColor: '#a31b32' }}
              >
                {loading ? 'Creating...' : 'Create Run'}
              </button>
            </form>
          </div>

          {/* Runs List */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              Payroll Runs <span className="text-gray-400 font-normal text-sm">({runs.length})</span>
            </h2>
            <div className="space-y-3">
              {runs.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No payroll runs yet</p>
              ) : (
                runs.map(r => (
                  <div key={r.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {MONTHS[(r.month || 1) - 1]} {r.year}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.total_amount ? `KES ${Number(r.total_amount).toLocaleString()}` : 'Not processed yet'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${runStatusColor(r.status)}`}>
                          {r.status}
                        </span>
                        {r.status === 'draft' && (
                          <button
                            onClick={() => processPayroll(r.id)}
                            disabled={loading}
                            className="text-xs text-green-600 hover:text-green-800 font-semibold disabled:opacity-50"
                          >
                            Process
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRun(r.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
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
