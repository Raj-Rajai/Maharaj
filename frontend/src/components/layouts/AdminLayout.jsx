import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Settings, LogOut, Menu, X, Sun, Moon } from 'lucide-react';
import { useState, useMemo } from 'react';
import {
  dashboardBlue, reportsBlue, menuBlue, dineInBlue, takeAwayBlue,
  kitchenBlue, billBlue, purchasesBlue, inventoryBlue, usersBlue, settingsBlue
} from '../../assets';

const roleDisplayNames = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  AC_MASTER: 'AC Master',
  NON_AC_MASTER: 'Non AC Master'
};

export default function AdminLayout({ children }) {
  const { user, logout, hasPermission, hasAnyPermission } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNavItems = useMemo(() => {
    const items = [];

    if (hasPermission('DASHBOARD_VIEW')) items.push({ to: '/dashboard', logo: dashboardBlue, label: 'Dashboard' });
    if (hasPermission('REPORT_VIEW')) items.push({ to: '/reports', logo: reportsBlue, label: 'Reports' });
    if (hasAnyPermission('MENU_AC_VIEW', 'MENU_NON_AC_VIEW', 'MENU_SWIGGY_VIEW', 'MENU_ZOMATO_VIEW')) {
      items.push({ to: '/menu', logo: menuBlue, label: 'Menu' });
    }
    if (hasPermission('TABLE_VIEW')) {
      items.push({ to: '/tables', logo: dineInBlue, label: 'Dine-In' });
    }
    if (hasAnyPermission('ONLINE_ORDER_VIEW', 'ORDER_CREATE')) {
      items.push({ to: '/take-away', logo: takeAwayBlue, label: 'Take Away' });
    }
    if (hasPermission('KOT_VIEW')) {
      items.push({ to: '/kitchen', logo: kitchenBlue, label: 'Kitchen' });
    }
    items.push({ to: '/bills', logo: billBlue, label: 'Bills' });
    if (hasPermission('PURCHASE_VIEW')) items.push({ to: '/purchases', logo: purchasesBlue, label: 'Purchases' });
    if (hasPermission('INVENTORY_VIEW')) items.push({ to: '/inventory', logo: inventoryBlue, label: 'Inventory' });
    if (hasPermission('USER_VIEW')) items.push({ to: '/users', logo: usersBlue, label: 'Users' });
    if (hasPermission('SETTINGS_VIEW')) items.push({ to: '/settings', logo: settingsBlue, label: 'Settings' });
    return items;
  }, [hasPermission, hasAnyPermission]);

  return (
    <div className="flex h-screen bg-surface dark:bg-slate-950 transition-colors duration-200">

      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-white dark:bg-slate-900 border-r border-border dark:border-slate-800 flex flex-col transition-all duration-300`}>
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'justify-between px-4'} border-b border-border dark:border-slate-800`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-slate-800 border border-transparent dark:border-slate-700/60 flex items-center justify-center text-primary dark:text-white font-bold text-xs shrink-0">
                POS
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-text dark:text-white tracking-tight leading-tight truncate">POS Console</span>
                <span className="text-[10px] font-medium text-text-secondary dark:text-slate-400 uppercase tracking-wider">Operations Hub</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-surface dark:hover:bg-slate-800 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-100 cursor-pointer transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {visibleNavItems.map(({ to, icon: Icon, logo, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 dark:bg-primary/25 text-primary dark:text-white font-semibold'
                    : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800/70 hover:text-text dark:hover:text-white'
                }`
              }
            >
              {logo ? (
                <img src={logo} alt={label} className="w-5 h-5 object-contain shrink-0 dark:brightness-0 dark:invert transition-all" />
              ) : Icon ? (
                <Icon size={20} className="shrink-0" />
              ) : null}
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-border dark:border-slate-800 flex items-center justify-between px-6 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-primary-dark dark:text-white flex items-center gap-2">
              Maharaj Veg Villa
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Pure Veg
            </span>
          </div>

          {/* Right Header Operations: Dark/Light Mode Switch + User Profile + Logout */}
          <div className="flex items-center gap-4 sm:gap-5">
            
            {/* Dark / Light Mode Toggle Switch */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                  isDark ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 hover:bg-slate-300'
                }`}
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle dark mode"
              >
                <span
                  className={`pointer-events-none inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out my-auto ${
                    isDark ? 'translate-x-5 bg-slate-900 text-amber-400' : 'translate-x-0.5 bg-white text-amber-500'
                  }`}
                >
                  {isDark ? (
                    <Moon size={13} className="fill-amber-400 text-amber-400" />
                  ) : (
                    <Sun size={13} className="fill-amber-500 text-amber-500" />
                  )}
                </span>
              </button>
            </div>

            <div className="h-6 w-px bg-border dark:bg-slate-800 hidden sm:block" />

            <div className="text-right flex flex-col items-end">
              <p className="text-sm font-medium text-text dark:text-slate-100">{user?.name}</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-400 mt-0.5">
                {roleDisplayNames[user?.role] || user?.role}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-red-400 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 bg-surface dark:bg-slate-950 transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
