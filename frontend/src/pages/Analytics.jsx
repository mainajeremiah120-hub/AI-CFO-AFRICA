import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import API from '../api/axios';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#a31b32', '#1e40af', '#065f46', '#92400e', '#6b21a8'];

const formatKES = (value) => `KES ${Number(value).toLocaleString()}`;

export default function Analytics() {
  const [tab, setTab] = useState('overview');
  const [kpis, setKpis] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [pnl, setPnl] = useState(null);
  const [receivablesAging, setReceivablesAging] = useState(null);
  const [payablesAging, setPayablesAging] = useState(null);
  const [inventoryData, setInventoryData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchKPIs();
    fetchRevenueData();
    fetchCashFlow();
  }, []);

  useEffect(() => {
    fetchRevenueData();
    fetchCashFlow();
  }, [year]);

  useEffect(() => {
    if (tab === 'pnl') fetchPnL();
    if (tab === 'aging') { fetchReceivablesAging(); fetchPayablesAging(); }
    if (tab === 'inventory') fetchInventoryPerformance();
  }, [tab]);

  const fetchKPIs = async () => {
    try {
      const res = await API.get('/analytics/dashboard-kpis');
      setKpis(res.data);
    } catch (err) {
      setError('Failed to load KPIs');
    }
  };

  const fetchRevenueData = async () => {
    try {
      const res = await API.get(`/analytics/revenue-vs-expenses?year=${year}`);
      setRevenueData(res.data);
    } catch (err) {
      setError('Failed to load revenue data');
    }
  };

  const fetchCashFlow = async () => {
    try {
      const res = await API.get(`/analytics/cash-flow?year=${year}`);
      setCashFlowData(res.data);
    } catch (err) {
      setError('Failed to load cash flow');
    }
  };

  const fetchPnL = async () => {
    setLoading(true);
    try {
      const res = await API.get('/analytics/profit-and-loss');
      setPnl(res.data);
    } catch (err) {
      setError('Failed to load P&L');
    } finally {
      setLoading(false);
    }
  };

  const fetchReceivablesAging = async () => {
    try {
      const res = await API.get('/analytics/receivables-aging');
      setReceivablesAging(res.data);
    } catch (err) {
      setError('Failed to load receivables aging');
    }
  };

  const fetchPayablesAging = async () => {
    try {
      const res = await API.get('/analytics/payables-aging');
      setPayablesAging(res.data);
    } catch (err) {
      setError('Failed to load payables aging');
    }
  };

  const fetchInventoryPerformance = async () => {
    try {
      const res = await API.get('/analytics/inventory-performance');
      setInventoryData(res.data);
    } catch (err) {
      setError('Failed to load inventory performance');
    }
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'revenue', label: 'Revenue & Expenses' },
    { key: 'cashflow', label: 'Cash Flow' },
    { key: 'pnl', label: 'Profit & Loss' },
    { key: 'aging', label: 'Aging Report' },
    { key: 'inventory', label: 'Inventory' },
  ];

  const agingPieData = (summary) => [
    { name: 'Current', value: summary?.current || 0 },
    { name: '1-30 days', value: summary?.days1_30 || 0 },
    { name: '31-60 days', value: summary?.days31_60 || 0 },
    { name: '61-90 days', value: summary?.days61_90 || 0 },
    { name: 'Over 90', value: summary?.over90 || 0 },
  ].filter(d => d.value > 0);

  return (
    <MainLayout title="Analytics">

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError(''); }}
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

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Revenue This Month', value: formatKES(kpis?.month_revenue || 0), color: '#065f46' },
              { label: 'Expenses This Month', value: formatKES(kpis?.month_expenses || 0), color: '#a31b32' },
              { label: 'Net Profit This Month', value: formatKES(kpis?.month_profit || 0), color: kpis?.month_profit >= 0 ? '#065f46' : '#a31b32' },
              { label: 'Outstanding Receivables', value: formatKES(kpis?.outstanding_receivables || 0), color: '#92400e' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-500 mb-2">{stat.label}</p>
                <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Overdue Receivables', value: formatKES(kpis?.overdue_receivables || 0), color: '#a31b32' },
              { label: 'Low Stock Items', value: kpis?.low_stock_count || 0, color: '#92400e' },
              { label: 'Total Employees', value: kpis?.total_employees || 0, color: '#1e40af' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-center">
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Revenue vs Expenses Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-semibold text-gray-800">Revenue vs Expenses</h2>
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatKES(value)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#065f46" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#a31b32" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── REVENUE & EXPENSES ── */}
      {tab === 'revenue' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-6">Monthly Revenue vs Expenses</h2>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatKES(value)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#065f46" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#a31b32" radius={[4,4,0,0]} />
                <Bar dataKey="profit" name="Profit" fill="#1e40af" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Monthly Breakdown</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Month</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Revenue</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Expenses</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Profit</th>
                </tr>
              </thead>
              <tbody>
                {revenueData.map(row => (
                  <tr key={row.month} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-800">{row.month}</td>
                    <td className="py-2.5 px-3 text-right text-green-600">{formatKES(row.revenue)}</td>
                    <td className="py-2.5 px-3 text-right text-red-600">{formatKES(row.expenses)}</td>
                    <td className={`py-2.5 px-3 text-right font-medium ${row.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatKES(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-semibold">
                  <td className="py-3 px-3 text-gray-800">Total</td>
                  <td className="py-3 px-3 text-right text-green-600">
                    {formatKES(revenueData.reduce((s, r) => s + r.revenue, 0))}
                  </td>
                  <td className="py-3 px-3 text-right text-red-600">
                    {formatKES(revenueData.reduce((s, r) => s + r.expenses, 0))}
                  </td>
                  <td className="py-3 px-3 text-right text-blue-600">
                    {formatKES(revenueData.reduce((s, r) => s + r.profit, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── CASH FLOW ── */}
      {tab === 'cashflow' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <select
              value={year}
              onChange={e => setYear(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-6">Monthly Cash Flow</h2>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatKES(value)} />
                <Legend />
                <Line type="monotone" dataKey="cash_in" name="Cash In" stroke="#065f46" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="cash_out" name="Cash Out" stroke="#a31b32" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="net" name="Net Cash" stroke="#1e40af" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Cash Flow Summary</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Month</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Cash In</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Cash Out</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {cashFlowData.map(row => (
                  <tr key={row.month} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-800">{row.month}</td>
                    <td className="py-2.5 px-3 text-right text-green-600">{formatKES(row.cash_in)}</td>
                    <td className="py-2.5 px-3 text-right text-red-600">{formatKES(row.cash_out)}</td>
                    <td className={`py-2.5 px-3 text-right font-medium ${row.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatKES(row.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PROFIT & LOSS ── */}
      {tab === 'pnl' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-6">
            Profit & Loss Statement
            {pnl && <span className="text-gray-400 font-normal text-sm ml-2">
              {new Date(pnl.period.start_date).toLocaleDateString()} — {new Date(pnl.period.end_date).toLocaleDateString()}
            </span>}
          </h2>

          {loading ? (
            <p className="text-gray-400 text-sm text-center py-8">Loading...</p>
          ) : pnl ? (
            <div className="max-w-lg">
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">Revenue</span>
                  <span className="text-sm font-bold text-green-600">{formatKES(pnl.revenue)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600 pl-4">Cost of Goods Sold</span>
                  <span className="text-sm text-red-600">({formatKES(pnl.cogs)})</span>
                </div>
                <div className="flex justify-between py-2 border-b-2 border-gray-200">
                  <span className="text-sm font-semibold text-gray-800">Gross Profit</span>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${pnl.gross_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatKES(pnl.gross_profit)}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">({pnl.gross_margin}%)</span>
                  </div>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600 pl-4">Operating Expenses</span>
                  <span className="text-sm text-red-600">({formatKES(pnl.operating_expenses)})</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600 pl-4">Payroll Costs</span>
                  <span className="text-sm text-red-600">({formatKES(pnl.payroll_costs)})</span>
                </div>
                <div className="flex justify-between py-3 bg-gray-50 rounded-lg px-3 mt-2">
                  <span className="text-base font-bold text-gray-800">Net Profit</span>
                  <div className="text-right">
                    <span className={`text-base font-bold ${pnl.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatKES(pnl.net_profit)}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">({pnl.net_margin}%)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Loading P&L data...</p>
          )}
        </div>
      )}

      {/* ── AGING REPORT ── */}
      {tab === 'aging' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Receivables Aging */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Receivables Aging</h2>
              {receivablesAging && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: 'Current', value: receivablesAging.summary.current, color: '#065f46' },
                      { label: '1-30 days', value: receivablesAging.summary.days1_30, color: '#92400e' },
                      { label: '31-60 days', value: receivablesAging.summary.days31_60, color: '#b45309' },
                      { label: 'Over 60 days', value: receivablesAging.summary.days61_90 + receivablesAging.summary.over90, color: '#a31b32' },
                    ].map(item => (
                      <div key={item.label} className="text-center p-3 rounded-lg bg-gray-50">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="text-sm font-bold mt-1" style={{ color: item.color }}>
                          {formatKES(item.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {agingPieData(receivablesAging.summary).length > 0 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={agingPieData(receivablesAging.summary)}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {agingPieData(receivablesAging.summary).map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatKES(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </div>

            {/* Payables Aging */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Payables Aging</h2>
              {payablesAging && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: 'Current', value: payablesAging.summary.current, color: '#065f46' },
                      { label: '1-30 days', value: payablesAging.summary.days1_30, color: '#92400e' },
                      { label: '31-60 days', value: payablesAging.summary.days31_60, color: '#b45309' },
                      { label: 'Over 60 days', value: payablesAging.summary.days61_90 + payablesAging.summary.over90, color: '#a31b32' },
                    ].map(item => (
                      <div key={item.label} className="text-center p-3 rounded-lg bg-gray-50">
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="text-sm font-bold mt-1" style={{ color: item.color }}>
                          {formatKES(item.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {agingPieData(payablesAging.summary).length > 0 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={agingPieData(payablesAging.summary)}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {agingPieData(payablesAging.summary).map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatKES(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Overdue Invoices Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Outstanding Invoices</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Customer</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Invoice #</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Due Date</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Balance Due</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {receivablesAging?.invoices?.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-8 text-gray-400">No outstanding invoices</td></tr>
                ) : (
                  receivablesAging?.invoices?.map(inv => (
                    <tr key={inv.invoice_number} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{inv.customer_name}</td>
                      <td className="py-2.5 px-3 font-mono text-gray-600">{inv.invoice_number}</td>
                      <td className="py-2.5 px-3 text-gray-500">{new Date(inv.due_date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-red-600">{formatKES(inv.balance_due)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          inv.days_overdue > 60 ? 'bg-red-100 text-red-800' :
                          inv.days_overdue > 30 ? 'bg-orange-100 text-orange-700' :
                          inv.days_overdue > 0 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {inv.days_overdue > 0 ? `${inv.days_overdue} days` : 'Current'}
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

      {/* ── INVENTORY PERFORMANCE ── */}
      {tab === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Product Performance</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">SKU</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Product</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Stock</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Cost</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Sell Price</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Margin</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Total Sold</th>
                  <th className="text-center py-2 px-3 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {inventoryData.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-8 text-gray-400">No products yet</td></tr>
                ) : (
                  inventoryData.map(p => (
                    <tr key={p.sku} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-mono text-gray-600">{p.sku}</td>
                      <td className="py-2.5 px-3 text-gray-800">{p.name}</td>
                      <td className="py-2.5 px-3 text-right">{Number(p.stock).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">{formatKES(p.cost_price)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">{formatKES(p.selling_price)}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-green-600">{p.margin_percent}%</td>
                      <td className="py-2.5 px-3 text-right">{Number(p.total_sold || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          Number(p.stock) === 0 ? 'bg-red-100 text-red-800' :
                          Number(p.stock) <= Number(p.reorder_level) ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {Number(p.stock) === 0 ? 'Out of stock' :
                           Number(p.stock) <= Number(p.reorder_level) ? 'Low stock' : 'In stock'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Top Products Chart */}
          {inventoryData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-6">Stock Value by Product</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inventoryData.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatKES(value)} />
                  <Bar dataKey="stock_value" name="Stock Value" fill="#a31b32" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

    </MainLayout>
  );
}