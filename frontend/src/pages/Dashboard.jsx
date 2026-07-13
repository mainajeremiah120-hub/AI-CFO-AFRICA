import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { Icon } from '../utils/icons';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const fmt = (n) => 'KES ' + Math.abs(Number(n || 0)).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Status dot used in KPI cards and alerts
function StatusDot({ status }) {
  const colors = { error: 'bg-red-500', warning: 'bg-amber-400', ok: 'bg-green-500' };
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || 'bg-gray-300'}`} />;
}

function KPICard({ label, value, color, sub, subColor, status }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        {status && <StatusDot status={status} />}
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: subColor || '#6b7280' }}>{sub}</p>}
    </div>
  );
}

const MODULES = [
  { label: 'POS',          desc: 'Record walk-in sales',            icon: 'pos',         path: '/pos' },
  { label: 'Receivables',  desc: 'Invoices & customer payments',    icon: 'receivables',  path: '/receivables' },
  { label: 'Payables',     desc: 'Bills & supplier payments',       icon: 'payables',     path: '/payables' },
  { label: 'Banking',      desc: 'Bank & M-Pesa transactions',      icon: 'banking',      path: '/banking' },
  { label: 'Cash',         desc: 'Petty cash & physical cash',      icon: 'cash',         path: '/cash' },
  { label: 'Inventory',    desc: 'Stock & warehouse management',    icon: 'inventory',    path: '/inventory' },
  { label: 'Payroll',      desc: 'Salaries & payslips',             icon: 'payroll',      path: '/payroll' },
  { label: 'Procurement',  desc: 'Purchase orders & suppliers',     icon: 'procurement',  path: '/procurement' },
  { label: 'Credit Notes', desc: 'Returns, spoilage, reversals',    icon: 'creditnotes',  path: '/credit-notes' },
  { label: 'Accounting',   desc: 'Chart of accounts & journals',    icon: 'accounting',   path: '/accounting' },
  { label: 'Analytics',    desc: 'Revenue, expenses & trends',      icon: 'analytics',    path: '/analytics' },
  { label: 'Settings',     desc: 'Company & system settings',       icon: 'settings',     path: '/settings' },
];

export default function Dashboard() {
  const user    = JSON.parse(localStorage.getItem('user')    || 'null');
  const company = JSON.parse(localStorage.getItem('company') || 'null');
  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [kpis,    setKpis]    = useState(null);
  const [balance, setBalance] = useState(0);
  const [ledger,  setLedger]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [kpiRes, accRes, ledRes] = await Promise.all([
          fetch(`${BASE}/analytics/dashboard-kpis`,      { headers }),
          fetch(`${BASE}/banking/accounts`,              { headers }),
          fetch(`${BASE}/banking/integrated-ledger?limit=8`, { headers }),
        ]);
        const [kpiData, accData, ledData] = await Promise.all([
          kpiRes.json(), accRes.json(), ledRes.json(),
        ]);
        setKpis(kpiData);
        setBalance(Array.isArray(accData) ? accData.reduce((s, a) => s + Number(a.current_balance || 0), 0) : 0);
        setLedger(Array.isArray(ledData) ? ledData.slice(0, 8) : []);
      } catch (e) {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const now   = new Date();
  const month = now.toLocaleString('default', { month: 'long' });
  const year  = now.getFullYear();

  const profitColor = kpis && kpis.month_profit >= 0 ? '#065f46' : '#b91c1c';

  return (
    <MainLayout title="Dashboard">

      {/* Welcome banner */}
      <div className="bg-gray-900 rounded-xl px-6 py-5 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Welcome back, {user?.name}</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {company?.name || 'AI CFO Africa'}
            {company?.industry ? ` — ${company.industry}` : ''}
          </p>
        </div>
        <div className="text-right text-sm text-gray-400">
          <p className="font-medium text-gray-300">{month} {year}</p>
          <p>{now.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-red-700 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">{error}</div>
      )}

      {!loading && kpis && (
        <>
          {/* Primary KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KPICard
              label={`${month} Revenue`}
              value={fmt(kpis.month_revenue)}
              color="#065f46"
            />
            <KPICard
              label={`${month} Expenses`}
              value={fmt(kpis.month_expenses)}
              color="#b45309"
            />
            <KPICard
              label={`${month} Net Profit`}
              value={fmt(kpis.month_profit)}
              color={profitColor}
              sub={kpis.month_profit >= 0 ? 'Profitable' : 'Operating at a loss'}
              subColor={profitColor}
            />
            <KPICard
              label="Total Bank Balance"
              value={fmt(balance)}
              color="#1e40af"
              sub="All accounts combined"
            />
          </div>

          {/* Secondary KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPICard
              label="Outstanding Receivables"
              value={fmt(kpis.outstanding_receivables)}
              color="#1e40af"
              sub={kpis.overdue_receivables > 0 ? `KES ${Number(kpis.overdue_receivables).toLocaleString()} overdue` : 'None overdue'}
              subColor={kpis.overdue_receivables > 0 ? '#b91c1c' : '#065f46'}
            />
            <KPICard
              label="Overdue Invoices"
              value={fmt(kpis.overdue_receivables)}
              status={kpis.overdue_receivables > 0 ? 'error' : 'ok'}
              color={kpis.overdue_receivables > 0 ? '#b91c1c' : '#065f46'}
              sub={kpis.overdue_receivables > 0 ? 'Requires immediate follow-up' : 'All invoices on time'}
              subColor={kpis.overdue_receivables > 0 ? '#b91c1c' : '#065f46'}
            />
            <KPICard
              label="Low Stock Alerts"
              value={kpis.low_stock_count}
              status={kpis.low_stock_count > 0 ? 'warning' : 'ok'}
              color={kpis.low_stock_count > 0 ? '#b45309' : '#065f46'}
              sub={kpis.low_stock_count > 0 ? 'Products below reorder level' : 'All stock levels healthy'}
              subColor={kpis.low_stock_count > 0 ? '#b45309' : '#065f46'}
            />
            <KPICard
              label="Active Employees"
              value={kpis.total_employees}
              color="#1e40af"
              sub="On payroll"
            />
          </div>

          {/* Recent transactions + alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

            {/* Recent transactions */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Recent Transactions</h3>
                <Link to="/banking" className="text-xs text-red-700 hover:underline font-medium">View all</Link>
              </div>
              {ledger.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No transactions yet</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {ledger.map((tx, i) => {
                    const isIn = Number(tx.money_in) > 0;
                    return (
                      <div key={i} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: isIn ? '#d1fae5' : '#fee2e2' }}
                          >
                            <Icon
                              name={isIn ? 'receivables' : 'payables'}
                              size={13}
                              style={{ stroke: isIn ? '#065f46' : '#b91c1c' }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-800 truncate">{tx.description}</p>
                            <p className="text-xs text-gray-400">
                              {tx.module || 'Banking'} · {tx.date ? new Date(tx.date).toLocaleDateString('en-KE') : '—'}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold flex-shrink-0 ml-3" style={{ color: isIn ? '#065f46' : '#b91c1c' }}>
                          {fmt(isIn ? tx.money_in : tx.money_out)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Alerts & quick actions */}
            <div className="flex flex-col gap-4">

              {/* Alerts */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Alerts</h3>
                <div className="space-y-2">
                  {kpis.overdue_receivables > 0 && (
                    <Link to="/receivables" className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 transition">
                      <Icon name="alertCircle" size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-red-700">Overdue Invoices</p>
                        <p className="text-xs text-red-600">{fmt(kpis.overdue_receivables)} outstanding</p>
                      </div>
                    </Link>
                  )}
                  {kpis.overdue_payables > 0 && (
                    <Link to="/payables" className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 transition">
                      <Icon name="alertCircle" size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-red-700">Overdue Bills</p>
                        <p className="text-xs text-red-600">{fmt(kpis.overdue_payables)} past due date</p>
                      </div>
                    </Link>
                  )}
                  {kpis.low_stock_count > 0 && (
                    <Link to="/inventory" className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100 hover:bg-amber-100 transition">
                      <Icon name="warning" size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Low Stock</p>
                        <p className="text-xs text-amber-600">{kpis.low_stock_count} product{kpis.low_stock_count !== 1 ? 's' : ''} below reorder level</p>
                      </div>
                    </Link>
                  )}
                  {kpis.overdue_receivables === 0 && kpis.low_stock_count === 0 && (kpis.overdue_payables || 0) === 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                      <Icon name="checkCircle" size={15} className="text-green-600 flex-shrink-0" />
                      <p className="text-xs text-green-700 font-medium">No alerts — all systems healthy</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-3">Quick Actions</h3>
                <div className="space-y-1">
                  {[
                    { label: 'New Invoice',        path: '/receivables' },
                    { label: 'Record Payment',     path: '/payables' },
                    { label: 'POS Sale',           path: '/pos' },
                    { label: 'View Trial Balance', path: '/accounting' },
                  ].map((a) => (
                    <Link
                      key={a.label}
                      to={a.path}
                      className="flex items-center justify-between text-sm text-gray-700 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition"
                    >
                      <span>{a.label}</span>
                      <span className="text-gray-300 text-xs">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* All modules grid */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4">All Modules</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MODULES.map((mod) => (
            <Link
              key={mod.label}
              to={mod.path}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-red-200 hover:bg-red-50 transition group"
            >
              <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-gray-100 group-hover:bg-red-100 transition">
                <Icon name={mod.icon} size={15} className="text-gray-500 group-hover:text-red-700 transition" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{mod.label}</p>
                <p className="text-xs text-gray-400 leading-tight">{mod.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </MainLayout>
  );
}
