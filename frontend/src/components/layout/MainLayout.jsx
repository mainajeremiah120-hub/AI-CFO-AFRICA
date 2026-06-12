import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function MainLayout({ children, title }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar isOpen={isSidebarOpen} closeSidebar={() => setIsSidebarOpen(false)} />
      <div className="flex-1 md:ml-64 w-full">
        <Navbar title={title} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="pt-16 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}