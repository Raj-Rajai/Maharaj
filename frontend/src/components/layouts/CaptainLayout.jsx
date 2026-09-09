import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Grid3x3, ChefHat, Smartphone, LogOut } from 'lucide-react';

const navItems = [
  { to: '/tables', icon: Grid3x3, label: 'Tables' },
  { to: '/kitchen', icon: ChefHat, label: 'Kitchen' },
  { to: '/online-orders', icon: Smartphone, label: 'Online Orders' },
];

export default function CaptainLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Header */}
      <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6">
        <h1 className="text-lg font-bold text-primary-dark">Maharaj Veg Villa</h1>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-text-secondary hover:bg-surface hover:text-text'
                  }`
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="text-right">
              <p className="text-sm font-medium text-text">{user?.name}</p>
              <p className="text-xs text-text-secondary">Captain</p>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-red-50 text-text-secondary hover:text-danger transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
