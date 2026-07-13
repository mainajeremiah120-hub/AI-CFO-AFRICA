import { Link, useLocation, useNavigate } from 'react-router-dom';

// ── Minimal SVG icon system ───────────────────────────────────────────────────
const Ic = ({ d, children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {d ? <path d={d} /> : children}
  </svg>
);

const icons = {
  dashboard: <Ic><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Ic>,
  pos:       <Ic><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></Ic>,
  accounting:<Ic><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></Ic>,
  receivables:<Ic><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></Ic>,
  payables:  <Ic><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></Ic>,
  inventory: <Ic><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></Ic>,
  payroll:   <Ic><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Ic>,
  procurement:<Ic><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></Ic>,
  banking:   <Ic><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></Ic>,
  cash:      <Ic><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></Ic>,
  creditnotes:<Ic><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></Ic>,
  analytics: <Ic><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Ic>,
  settings:  <Ic><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Ic>,
  logout:    <Ic><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Ic>,
};

const navItems = [
  { label: 'Dashboard',    icon: icons.dashboard,    path: '/dashboard' },
  { label: 'POS',          icon: icons.pos,          path: '/pos' },
  { label: 'Accounting',   icon: icons.accounting,   path: '/accounting' },
  { label: 'Receivables',  icon: icons.receivables,  path: '/receivables' },
  { label: 'Payables',     icon: icons.payables,     path: '/payables' },
  { label: 'Inventory',    icon: icons.inventory,    path: '/inventory' },
  { label: 'Payroll',      icon: icons.payroll,      path: '/payroll' },
  { label: 'Procurement',  icon: icons.procurement,  path: '/procurement' },
  { label: 'Banking',      icon: icons.banking,      path: '/banking' },
  { label: 'Cash',         icon: icons.cash,         path: '/cash' },
  { label: 'Credit Notes', icon: icons.creditnotes,  path: '/credit-notes' },
  { label: 'Analytics',    icon: icons.analytics,    path: '/analytics' },
  { label: 'Settings',     icon: icons.settings,     path: '/settings' },
];

export default function Sidebar({ isOpen, closeSidebar }) {
  const location = useLocation();
  const navigate  = useNavigate();
  const company   = JSON.parse(localStorage.getItem('company') || 'null');

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className={`flex flex-col h-screen w-64 bg-gray-900 text-white fixed left-0 top-0 z-20 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

      {/* Brand */}
      <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: '#a31b32' }}>
            ACA
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white tracking-tight">CFO Africa</p>
            <p className="text-xs text-gray-400 truncate max-w-[120px]">{company?.name || 'Your Organisation'}</p>
          </div>
        </div>
        <button className="md:hidden text-gray-500 hover:text-white" onClick={closeSidebar}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? 'text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
              style={isActive ? { backgroundColor: '#a31b32' } : {}}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 w-full transition-colors"
        >
          {icons.logout}
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
