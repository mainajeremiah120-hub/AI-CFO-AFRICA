import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function MainLayout({ children, title }) {
  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Navbar title={title} />
        <main className="pt-16 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}