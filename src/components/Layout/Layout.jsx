import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import BottomNav from './BottomNav.jsx';
import ToastHost from '../ui/Toast.jsx';
import { useApp } from '../../context/AppContext.jsx';

export default function Layout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toasts } = useApp();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 h-full sidebar-bg flex-shrink-0 overflow-y-auto shadow-xl flex-col">
        <Sidebar />
      </aside>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" dir="rtl">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full sidebar-bg overflow-y-auto shadow-2xl">
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuOpen={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6 fade-in">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav onMoreClick={() => setDrawerOpen(true)} />

      {/* Action feedback */}
      <ToastHost toasts={toasts} />
    </div>
  );
}
