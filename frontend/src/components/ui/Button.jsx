import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  onClick,
  type = 'button',
  className = '',
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variants = {
    primary: 'bg-blue-700 hover:bg-blue-600 text-white focus:ring-blue-500 shadow-sm disabled:bg-blue-300 dark:disabled:bg-blue-900/50',
    secondary: 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 focus:ring-blue-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-sm disabled:bg-red-300 dark:disabled:bg-red-900/50',
    success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500 shadow-sm disabled:bg-green-300 dark:disabled:bg-green-900/50',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 focus:ring-slate-500 disabled:text-slate-400 dark:disabled:text-slate-600',
  };

  const sizes = {
    sm: 'text-xs sm:text-sm px-3 py-1.5 min-h-[36px]',
    md: 'text-sm px-4 py-2 min-h-[40px]',
    lg: 'text-base px-6 py-2.5 sm:py-3 min-h-[46px]',
  };

  const classes = `
    ${baseClasses}
    ${variants[variant]}
    ${sizes[size]}
    ${fullWidth ? 'w-full' : ''}
    ${disabled || loading ? 'cursor-not-allowed' : ''}
    ${className}
  `;

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {!loading && Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </button>
  );
}
