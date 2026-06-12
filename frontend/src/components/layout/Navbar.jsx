export default function Navbar({ title, toggleSidebar }) {
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 fixed top-0 md:left-64 left-0 right-0 z-10">
      <div className="flex items-center gap-3">
        <button 
          className="md:hidden text-gray-500 hover:text-gray-700 text-xl" 
          onClick={toggleSidebar}
        >
          ☰
        </button>
        <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800">{user?.name}</p>
          <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
        </div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: '#a31b32' }}
        >
          {user?.name?.charAt(0)}
        </div>
      </div>
    </div>
  );
}