import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { ChefHat, Receipt, X, ArrowRight } from 'lucide-react';

export default function NotificationToaster() {
  const { activePopups, dismissPopup } = useNotifications();
  const navigate = useNavigate();

  if (!activePopups || activePopups.length === 0) return null;

  return (
    <div className="fixed top-13 sm:top-16 right-2.5 sm:right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-xs sm:max-w-sm w-[calc(100vw-20px)] sm:w-84">
      <style>{`
        @keyframes notifDrainBar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      {activePopups.slice(-2).map(({ id, notification }) => {
        const isKot = notification.type === 'KOT';

        const handleView = () => {
          dismissPopup(id);
          if (isKot) {
            navigate('/kitchen');
          } else {
            navigate('/bills');
          }
        };

        return (
          <div
            key={id}
            className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-border dark:border-slate-800 shadow-2xl p-3.5 relative overflow-hidden transition-all duration-300 ring-1 ring-black/5 dark:ring-white/5"
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  isKot
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                }`}
              >
                {isKot ? <ChefHat size={20} /> : <Receipt size={20} />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-text dark:text-white truncate">
                    {isKot ? 'New KOT Generated' : 'New Bill Generated'}
                  </h4>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      isKot
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                        : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    {isKot ? notification.title : notification.title}
                  </span>
                </div>

                <p className="text-xs text-text-secondary dark:text-slate-300 mt-1 truncate">
                  {notification.subtitle}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={handleView}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary-light active:scale-95 transition-transform cursor-pointer shadow-xs"
                  >
                    <span>View {isKot ? 'Kitchen' : 'Bills'}</span>
                    <ArrowRight size={12} />
                  </button>
                  <span className="text-[10px] text-text-secondary/70 dark:text-slate-400">
                    Sits in bell after 10s
                  </span>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => dismissPopup(id)}
                className="absolute top-2.5 right-2.5 p-1 text-text-secondary/70 hover:text-text dark:text-slate-400 dark:hover:text-slate-100 hover:bg-surface dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title="Dismiss to bell"
              >
                <X size={15} />
              </button>
            </div>

            {/* 10s Countdown Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${isKot ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{
                  animation: 'notifDrainBar 10s linear forwards',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
