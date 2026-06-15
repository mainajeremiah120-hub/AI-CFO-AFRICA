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

  // Employee form
  const [empForm, setEmpForm] = useState({
    employee_number: '', full_name: '', email: '', phone: '',
    position: '', department: '', basic_salary: '', bank_account: ''
  });

  // Run form
  const [runForm, setRunForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

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
    } catch (err) { setError('Failed to load summary'); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await API.get('/payroll/employees');
      setEmployees(res.data);
    } catch (err) { setError('Failed to load employees'); }
  };

  const fetchRuns = async () => {
    try {
      const res = await API.get('/payroll/runs');
      setRuns(res.data);
    } catch (err) { setError('Failed to load payroll runs'); }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/payroll/employees', empForm);
      setSuccess('Employee added successfully');
      setEmpForm({ employee_number: '', full_name: '', email: '', phone: '', position: '', department: '', basic_salary: '', bank_account: '' });
      fetchEmployees();
      fetchSummary();
    } catch (err) { setError(err.response?.data?.error || 'Failed to add employee'); }
    finally { setLoading(false); }
  };

  const handleCreateRun = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/payroll/runs', runForm);
      setSuccess('Payroll run created');
      fetchRuns();
      fetchSummary();
    } catch (err) { setError(err.response?.data?.error || 'Failed to create run'); }
    finally { setLoading(false); }
  };

  const processPayroll = async (runId) => {
    setLoading(true);
    try {
      await API.post(`/payroll/runs/${runId}/process`);
      setSuccess('Payroll processed successfully');
      fetchRuns();
    } catch (err) { setError(err.response?.data?.error || 'Failed to process'); }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'employees', label: 'Employees' },
    { key: 'runs', label: 'Payroll Runs' },
  ];

  return (
    <MainLayout title="Payroll">
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === t.key ? 'border-primary-700 text-primary-700' : 'border-transparent text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg mb-4">{success}</div>}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500">Active Employees</p>
            <p className="text-3xl font-bold text-gray-800">{summary?.total_employees || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-sm text-gray-500">Total Monthly Payroll</p>
            <p className="text-3xl font-bold text-blue-700">KES {Number(summary?.total_monthly_salary || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* ── EMPLOYEES ── */}
      {tab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h2 className="font-semibold mb-4">Add Employee</h2>
            <form onSubmit={handleCreateEmployee} className="space-y-3">
              <input placeholder="Name" className="w-full border p-2 rounded" value={empForm.full_name} onChange={e => setEmpForm({...empForm, full_name: e.target.value})} required />
              <input placeholder="Basic Salary" type="number" className="w-full border p-2 rounded" value={empForm.basic_salary} onChange={e => setEmpForm({...empForm, basic_salary: e.target.value})} required />
              <button className="w-full bg-primary-700 text-white py-2 rounded">Save Employee</button>
            </form>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border shadow-sm">
            <table className="w-full">
              <thead><tr className="text-left text-gray-500 text-sm border-b"><th>Name</th><th>Salary</th></tr></thead>
              <tbody>{employees.map(e => <tr key={e.id} className="border-b"><td>{e.full_name}</td><td>{e.basic_salary}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAYROLL RUNS ── */}
      {tab === 'runs' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <form onSubmit={handleCreateRun} className="flex gap-4">
              <input type="number" value={runForm.month} onChange={e => setRunForm({...runForm, month: e.target.value})} className="border p-2 rounded" />
              <input type="number" value={runForm.year} onChange={e => setRunForm({...runForm, year: e.target.value})} className="border p-2 rounded" />
              <button className="bg-primary-700 text-white px-4 py-2 rounded">Create New Run</button>
            </form>
          </div>
          
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            {runs.map(r => (
              <div key={r.id} className="flex justify-between items-center border-b p-3">
                <span>{r.month}/{r.year} - <strong>{r.status}</strong></span>
                {r.status === 'draft' && (
                  <button onClick={() => processPayroll(r.id)} className="text-green-600 font-bold text-sm">Process</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </MainLayout>
  );
}