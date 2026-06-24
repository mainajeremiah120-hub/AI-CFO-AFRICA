import MainLayout from '../components/layout/MainLayout';
import { Link } from 'react-router-dom';

const stats = [
  { label: 'Total Revenue', value: 'KES 0', icon: '📈', color: '#a31b32' },
  { label: 'Total Expenses', value: 'KES 0', icon: '📉', color: '#b45309' },
  { label: 'Net Profit', value: 'KES 0', icon: '💰', color: '#065f46' },
  { label: 'Cash Balance', value: 'KES 0', icon: '🏦', color: '#1e40af' },
];

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const company = JSON.parse(localStorage.getItem('company') || 'null');

  return (
    <MainLayout title="Dashboard">

      {/* Welcome */}
      <div
        className="rounded-2xl p-6 mb-6 text-white"
        style={{ backgroundColor: '#8f182c' }}
      >
        <h2 className="text-xl font-bold">Welcome back, {user?.name} 👋</h2>
        <p className="text-sm mt-1 opacity-80">{company?.name || 'AI CFO Africa'} {company?.industry ? `— ${company.industry}` : ''}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Accounting', desc: 'Chart of accounts, journal entries', icon: '📒', path: '/accounting' },
          { label: 'Receivables', desc: 'Invoices and customer payments', icon: '📥', path: '/receivables' },
          { label: 'Payables', desc: 'Bills and supplier payments', icon: '📤', path: '/payables' },
          { label: 'Inventory', desc: 'Stock and warehouse management', icon: '📦', path: '/inventory' },
          { label: 'Payroll', desc: 'Employee salaries and payslips', icon: '👥', path: '/payroll' },
          { label: 'Banking', desc: 'M-Pesa and bank reconciliation', icon: '🏦', path: '/banking' },
        ].map((mod) => (
          <Link
            key={mod.label}
            to={mod.path}
            className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer block"
          >
            <div className="text-2xl mb-3">{mod.icon}</div>
            <p className="font-semibold text-gray-800">{mod.label}</p>
            <p className="text-sm text-gray-400 mt-1">{mod.desc}</p>
          </Link>
        ))}
      </div>

    </MainLayout>
  );
}