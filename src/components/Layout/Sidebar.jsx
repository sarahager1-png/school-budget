import {
  LayoutDashboard, School, TrendingUp, CreditCard,
  Package, BarChart2, Settings, LogOut, HelpCircle, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { NAV_ITEMS } from '../../data/constants.js';

const ICONS = {
  LayoutDashboard, School, TrendingUp, CreditCard,
  Package, BarChart2, Settings, HelpCircle,
};

export default function Sidebar({ onClose }) {
  const { user, logout, currentPage, navigate, school } = useApp();

  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user?.role));

  const handleNavigate = (id) => {
    navigate(id);
    onClose?.();
  };

  const handleLogout = () => {
    logout();
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo / School Name */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {school.logoUrl
              ? <img src={school.logoUrl} alt="לוגו" className="w-full h-full object-contain p-0.5" onError={e => { e.target.style.display='none'; }} />
              : <span className="text-white font-bold text-lg">{school.name?.[0]}</span>
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-sm leading-tight truncate">{school.name}</p>
            <p className="text-white/50 text-xs mt-0.5">מערכת תקציב</p>
          </div>
          {/* Close button (mobile drawer only) */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = ICONS[item.icon];
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-right ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/60 hover:bg-white/8 hover:text-white/90 active:bg-white/10'
              }`}
            >
              {Icon && <Icon size={18} className="flex-shrink-0" />}
              <span>{item.label}</span>
              {isActive && (
                <span className="mr-auto w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User Info + Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.initials || user?.name?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-white/50 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/60 hover:bg-white/8 hover:text-white/90 text-sm transition-all"
        >
          <LogOut size={16} />
          <span>יציאה</span>
        </button>
      </div>
    </div>
  );
}
