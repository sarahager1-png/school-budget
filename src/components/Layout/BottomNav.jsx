import { LayoutDashboard, School, CreditCard, Package, MoreHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';

const PRINCIPAL_ITEMS = [
  { id: 'dashboard', label: 'הבית', icon: LayoutDashboard },
  { id: 'classes', label: 'כיתות', icon: School },
  { id: 'expenses', label: 'הוצאות', icon: CreditCard },
  { id: 'courier', label: 'בקשות', icon: Package },
];

const COURIER_ITEMS = [
  { id: 'courier', label: 'בקשות', icon: Package },
];

export default function BottomNav({ onMoreClick }) {
  const { currentPage, navigate, user, expenseRequests } = useApp();

  const items = user?.role === 'courier' ? COURIER_ITEMS : PRINCIPAL_ITEMS;
  const pendingCount = expenseRequests.filter(r => r.status === 'pending').length;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-40 flex" dir="rtl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(item => {
        const Icon = item.icon;
        const active = currentPage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors ${active ? 'text-teal-600' : 'text-gray-400 active:text-gray-600'}`}
          >
            <div className="relative">
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {item.id === 'courier' && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-coral-500 rounded-full text-white text-xs flex items-center justify-center font-bold leading-none">
                  {pendingCount}
                </span>
              )}
            </div>
            <span className={`text-xs ${active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
            {active && <span className="absolute top-0 inset-x-0 h-0.5 bg-teal-500 rounded-b" />}
          </button>
        );
      })}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-gray-400 active:text-gray-600"
      >
        <MoreHorizontal size={22} strokeWidth={1.8} />
        <span className="text-xs font-medium">עוד</span>
      </button>
    </nav>
  );
}
