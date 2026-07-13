import { Bell, ChevronDown, Menu } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { NAV_ITEMS, ROLES } from '../../data/constants.js';

const PAGE_TITLES = Object.fromEntries(NAV_ITEMS.map(i => [i.id, i.label]));

export default function Header({ onMenuOpen }) {
  const { user, currentPage, navigate, budgetYears, currentYear, activateBudgetYear, expenseRequests } = useApp();
  const [showYearMenu, setShowYearMenu] = useState(false);

  const pendingCount = expenseRequests.filter(r => r.status === 'pending').length;
  const roleInfo = ROLES[user?.role] || {};

  return (
    <header className="bg-white border-b border-gray-100 h-14 md:h-16 flex items-center px-4 md:px-6 gap-3 shadow-sm flex-shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuOpen}
        aria-label="פתיחת תפריט"
        className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
      >
        <Menu size={20} />
      </button>

      {/* Page Title */}
      <h1 className="text-base md:text-lg font-bold text-gray-800 flex-1 truncate">
        {PAGE_TITLES[currentPage] || 'דף הבית'}
      </h1>

      {/* Budget Year Selector — visible on mobile too */}
      {budgetYears.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowYearMenu(p => !p)}
            aria-label="בחירת שנת תקציב"
            aria-expanded={showYearMenu}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs md:text-sm text-gray-600 hover:bg-gray-50 transition-colors max-w-32 sm:max-w-none"
          >
            <span className="font-medium truncate">{currentYear?.label}</span>
            <ChevronDown size={13} className="flex-shrink-0" />
          </button>
          {showYearMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowYearMenu(false)} />
              <div className="absolute top-full mt-1 left-0 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-48">
                {budgetYears.map(yr => (
                  <button
                    key={yr.id}
                    onClick={() => { activateBudgetYear(yr.id); setShowYearMenu(false); }}
                    className={`w-full text-right px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 ${yr.id === currentYear?.id ? 'text-teal-600 font-medium' : 'text-gray-700'}`}
                  >
                    <span>{yr.label}</span>
                    {yr.isActive && <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">פעיל</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Pending payment requests */}
      <button
        onClick={() => navigate('courier')}
        aria-label={pendingCount > 0 ? `${pendingCount} בקשות תשלום ממתינות` : 'בקשות תשלום'}
        className="relative p-1.5 md:p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
      >
        <Bell size={18} className="text-gray-500" />
        {pendingCount > 0 && (
          <span className="absolute top-0.5 right-0.5 md:top-1 md:right-1 w-4 h-4 bg-coral-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
            {pendingCount}
          </span>
        )}
      </button>

      {/* User Badge (desktop only) */}
      <div className="hidden md:flex items-center gap-2">
        <span className={`badge ${roleInfo.color} text-xs`}>{roleInfo.label}</span>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
          {user?.initials || user?.name?.[0]}
        </div>
      </div>
    </header>
  );
}
