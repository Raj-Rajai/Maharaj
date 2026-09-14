import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Settings, LogOut, Menu, X, Sun, Moon, MoreHorizontal } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
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
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Close mobile drawer upon route navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileDrawerOpen(false);
    };
    if (mobileDrawerOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawerOpen]);

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

  // Mobile Bottom Navigation Tabs (primary quick access hubs)
  const mobileBottomTabs = useMemo(() => {
    const tabs = [];
    if (hasPermission('TABLE_VIEW')) {
      tabs.push({ to: '/tables', logo: dineInBlue, label: 'Dine-In' });
    }
    if (hasAnyPermission('ONLINE_ORDER_VIEW', 'ORDER_CREATE')) {
      tabs.push({ to: '/take-away', logo: takeAwayBlue, label: 'Take Away' });
    }
    if (hasPermission('KOT_VIEW')) {
      tabs.push({ to: '/kitchen', logo: kitchenBlue, label: 'Kitchen' });
    }
    tabs.push({ to: '/bills', logo: billBlue, label: 'Bills' });
    return tabs;
  }, [hasPermission, hasAnyPermission]);

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="flex h-screen bg-surface dark:bg-slate-950 transition-colors duration-200 overflow-hidden">

      {/* Mobile Slide-over Drawer Backdrop */}
      <div
        className={`fixed inset-0 z-50 md:hidden bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 ${
          mobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Slide-over Drawer Sheet */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white dark:bg-slate-900 shadow-2xl flex flex-col md:hidden transform transition-transform duration-300 ease-in-out ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Drawer Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-slate-800 border border-transparent dark:border-slate-700/60 flex items-center justify-center text-primary dark:text-white font-bold text-xs shrink-0">
              POS
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-text dark:text-white tracking-tight leading-tight truncate">Maharaj Veg Villa</span>
              <span className="text-[10px] font-medium text-text-secondary dark:text-slate-400 uppercase tracking-wider">Navigation Menu</span>
            </div>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="p-2 rounded-lg text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 hover:text-text dark:hover:text-slate-100 cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Info Bar in Drawer */}
        <div className="px-4 py-3 bg-surface/60 dark:bg-slate-800/50 border-b border-border dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/15 dark:bg-primary/30 text-primary dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
              {userInitial}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-text dark:text-white truncate">{user?.name}</span>
              <span className="text-[10px] text-text-secondary dark:text-slate-400">{roleDisplayNames[user?.role] || user?.role}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Navigation items in Mobile Drawer */}
        <nav className="mobile-nav flex-1 py-3 overflow-y-auto space-y-1">
          {visibleNavItems.map(({ to, icon: Icon, logo, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-medium transition-colors ${
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
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Drawer Footer with Theme Toggle */}
        <div className="p-4 border-t border-border dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 pb-safe">
          <span className="text-xs font-medium text-text-secondary dark:text-slate-400">Appearance</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border dark:border-slate-700 bg-surface dark:bg-slate-800 text-xs font-semibold text-text dark:text-slate-200"
          >
            {isDark ? <Moon size={14} className="text-amber-400 fill-amber-400" /> : <Sun size={14} className="text-amber-500 fill-amber-500" />}
            <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </div>
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside className={`hidden md:flex ${collapsed ? 'w-16' : 'w-60'} bg-white dark:bg-slate-900 border-r border-border dark:border-slate-800 flex-col transition-all duration-300 shrink-0`}>
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
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-14 sm:h-16 bg-white dark:bg-slate-900 border-b border-border dark:border-slate-800 flex items-center justify-between px-3 sm:px-6 transition-colors duration-200 shrink-0 z-30">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Hamburger button on Mobile (< md) */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-1.5 sm:p-2 rounded-lg text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 hover:text-text dark:hover:text-slate-100 md:hidden cursor-pointer shrink-0"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu size={22} />
            </button>

            <h1 className="text-base sm:text-xl font-bold tracking-tight text-primary-dark dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
              Maharaj Veg Villa
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
              Pure Veg
            </span>
          </div>

          {/* Right Header Operations: Dark/Light Mode Switch + User Profile + Logout */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            
            {/* Dark / Light Mode Toggle Switch */}
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

            <div className="h-6 w-px bg-border dark:bg-slate-800 hidden sm:block" />

            {/* Desktop User Info (hidden on mobile) */}
            <div className="text-right hidden sm:flex flex-col items-end min-w-0">
              <p className="text-sm font-medium text-text dark:text-slate-100 truncate max-w-[140px]">{user?.name}</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 dark:bg-primary/20 text-primary dark:text-blue-400 mt-0.5">
                {roleDisplayNames[user?.role] || user?.role}
              </span>
            </div>

            {/* Mobile User Initial Badge (shown only on mobile) */}
            <div
              className="sm:hidden w-8 h-8 rounded-full bg-primary/15 dark:bg-primary/30 text-primary dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0"
              title={`${user?.name} (${roleDisplayNames[user?.role] || user?.role})`}
            >
              {userInitial}
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-red-400 transition-colors cursor-pointer"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </header>

        {/* Main Content Area: Responsive padding with mobile bottom navigation bar clearance */}
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6 bg-surface dark:bg-slate-950 transition-colors duration-200">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (< md) */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-border dark:border-slate-800 flex items-center justify-around px-1 py-1 pb-safe shadow-lg"
          aria-label="Mobile Bottom Navigation"
        >
          {mobileBottomTabs.map(({ to, logo, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10px] font-semibold transition-all duration-150 ${
                  isActive
                    ? 'text-primary dark:text-white font-bold'
                    : 'text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-lg transition-all ${isActive ? 'bg-primary/15 dark:bg-primary/25 scale-110' : ''}`}>
                    <img src={logo} alt={label} className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
                  </div>
                  <span className="mt-0.5 truncate max-w-[64px]">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* "More" button to trigger full menu sheet */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10px] font-semibold text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200 cursor-pointer"
          >
            <div className="p-1 rounded-lg">
              <MoreHorizontal size={20} />
            </div>
            <span className="mt-0.5">More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
