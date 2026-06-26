import { Link, useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', icon: '📊', path: '/dashboard' },
  { label: 'POS', icon: '🛒', path: '/pos' },
  { label: 'Accounting', icon: '📒', path: '/accounting' },
  { label: 'Receivables', icon: '📥', path: '/receivables' },
  { label: 'Payables', icon: '📤', path: '/payables' },
  { label: 'Inventory', icon: '📦', path: '/inventory' },
  { label: 'Payroll', icon: '👥', path: '/payroll' },
  { label: 'Procurement', icon: '🛒', path: '/procurement' },
  { label: 'Banking', icon: '🏦', path: '/banking' },
  { label: 'Credit Notes', icon: '📝', path: '/credit-notes' },
  { label: 'Analytics', icon: '📈', path: '/analytics' },
];

export default function Sidebar({ isOpen, closeSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const company = JSON.parse(localStorage.getItem('company') || 'null');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className={`flex flex-col h-screen w-64 bg-primary-900 text-white fixed left-0 top-0 z-20 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      
      {/* Logo */}
      <div className="px-6 py-5 border-b border-primary-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-sm font-bold">
            ACA
          </div>
          <div>
            <p className="text-sm font-bold text-white">AI CFO Africa</p>
            <p className="text-xs text-primary-400 truncate w-24">{company?.name || 'Your Organization'}</p>
          </div>
        </div>
        <button className="md:hidden text-gray-400 hover:text-white text-xl" onClick={closeSidebar}>
          ✕
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition ${
                isActive
                  ? 'bg-primary-700 text-white font-medium'
                  : 'text-primary-300 hover:bg-primary-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span onClick={closeSidebar}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-primary-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-primary-300 hover:bg-primary-800 hover:text-white w-full transition"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}