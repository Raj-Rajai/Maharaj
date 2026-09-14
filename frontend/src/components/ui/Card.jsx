export default function Card({ children, className = '', hover = false, onClick, padding = 'p-3.5 sm:p-5 md:p-6' }) {
  return (
    <div
      className={`
        bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-text dark:text-slate-100 shadow-sm
        ${hover ? 'transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5 cursor-pointer' : ''}
        ${padding}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
