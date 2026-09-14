import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Grid3x3, ChefHat, ShoppingBag, LogOut, Sun, Moon } from 'lucide-react';
import { dineInBlue, kitchenBlue, takeAwayBlue } from '../../assets';

const navItems = [
  { to: '/tables', logo: dineInBlue, label: 'Tables' },
  { to: '/kitchen', logo: kitchenBlue, label: 'Kitchen' },
  { to: '/take-away', logo: takeAwayBlue, label: 'Take Away' },
];

export default function CaptainLayout({ children }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'C';

  return (
    <div className="flex flex-col h-screen bg-surface dark:bg-slate-950 transition-colors duration-200 overflow-hidden">
      {/* Header */}
      <header className="h-14 sm:h-16 bg-white dark:bg-slate-900 border-b border-border dark:border-slate-800 flex items-center justify-between px-3 sm:px-6 shrink-0 z-30">
        <h1 className="text-base sm:text-lg font-bold text-primary-dark dark:text-white truncate">
          Maharaj Veg Villa
        </h1>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, logo, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 dark:bg-primary/25 text-primary dark:text-white font-semibold'
                      : 'text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800 hover:text-text dark:hover:text-white'
                  }`
                }
              >
                <img src={logo} alt={label} className="w-4 h-4 object-contain dark:brightness-0 dark:invert" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Dark / Light Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-text-secondary dark:text-slate-400 hover:bg-surface dark:hover:bg-slate-800"
            title="Toggle theme"
          >
            {isDark ? <Moon size={16} className="text-amber-400 fill-amber-400" /> : <Sun size={16} className="text-amber-500 fill-amber-500" />}
          </button>

          <div className="flex items-center gap-2.5 sm:pl-3 border-l border-border dark:border-slate-800">
            <div className="text-right hidden sm:block">
              <p className="text-xs sm:text-sm font-medium text-text dark:text-slate-100 truncate max-w-[120px]">{user?.name}</p>
              <p className="text-[10px] text-text-secondary dark:text-slate-400">Captain</p>
            </div>
            <div className="sm:hidden w-7 h-7 rounded-full bg-primary/15 text-primary dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              {userInitial}
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-text-secondary dark:text-slate-400 hover:text-danger dark:hover:text-red-400 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut size={16} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6 bg-surface dark:bg-slate-950 transition-colors duration-200">
        {children}
      </main>

      {/* Mobile Bottom Bar for Captains (< md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-border dark:border-slate-800 flex items-center justify-around px-2 py-1 pb-safe shadow-lg">
        {navItems.map(({ to, logo, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-[10px] font-semibold transition-all ${
                isActive ? 'text-primary dark:text-white font-bold' : 'text-text-secondary dark:text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-lg ${isActive ? 'bg-primary/15 dark:bg-primary/25 scale-110' : ''}`}>
                  <img src={logo} alt={label} className="w-5 h-5 object-contain dark:brightness-0 dark:invert" />
                </div>
                <span className="mt-0.5">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
