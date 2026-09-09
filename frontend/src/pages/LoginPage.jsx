import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UtensilsCrossed, User, Lock, Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      toast.error('Enter username and password');
      return;
    }
    setLoading(true);
    try {
      await login(cleanUser, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 flex items-center justify-center p-4 relative transition-colors duration-200">
      {/* Theme Toggle in Top Right */}
      <div className="absolute top-6 right-6">
        <button
          type="button"
          onClick={toggleTheme}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary ${
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

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 dark:bg-slate-800 border border-transparent dark:border-slate-700/60 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="text-primary dark:text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-text dark:text-white">Maharaj Veg Villa</h1>
          <p className="text-text-secondary dark:text-slate-400 mt-1">Hotel Operations Management</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-border dark:border-slate-800 p-8 space-y-5 transition-colors">
          <div>
            <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1.5">Username</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400" />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                placeholder="Enter username"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text dark:text-slate-200 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-border dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-text dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                placeholder="Enter password"
              />
            </div>
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary-light dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
