import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChefHat, Receipt, CheckCircle2, ArrowRight, X, Clock } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function NotificationCenter() {
  const { notifications, unreadCount, kotCount, billCount, clearNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'KOT' | 'BILL'
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const filteredList = useMemo(() => {
    if (activeTab === 'KOT') return notifications.filter((n) => n.type === 'KOT');
    if (activeTab === 'BILL') return notifications.filter((n) => n.type === 'BILL');
    return notifications;
  }, [notifications, activeTab]);

  const handleNavigate = (item) => {
    setIsOpen(false);
    if (item.type === 'KOT') {
      navigate('/kitchen');
    } else {
      navigate('/bills');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Header Notification Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-xl transition-colors cursor-pointer border text-primary dark:text-white ${
          isOpen
            ? 'bg-primary/15 dark:bg-slate-800 border-primary/30 dark:border-slate-700 shadow-2xs'
            : 'bg-transparent hover:bg-primary/10 dark:hover:bg-slate-800 border-transparent hover:border-primary/20 dark:hover:border-slate-700'
        }`}
        title={`Notifications (${unreadCount} active)`}
        aria-label="Toggle notifications center"
      >
        <Bell size={19} className={`text-primary dark:text-white transition-transform ${unreadCount > 0 ? 'stroke-[2.3]' : ''}`} />

        {/* Badge counter */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 shadow-2xl z-50 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-border dark:border-slate-800 flex items-center justify-between bg-surface/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-text dark:text-white">Notifications</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary dark:bg-primary/25 dark:text-blue-400">
                {unreadCount} Active
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-surface dark:hover:bg-slate-800 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Close panel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-border dark:border-slate-800 px-3 pt-2 gap-1 bg-surface/30 dark:bg-slate-800/20">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`pb-2 px-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'ALL'
                  ? 'border-primary text-primary dark:text-blue-400 font-bold'
                  : 'border-transparent text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
              }`}
            >
              All ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('KOT')}
              className={`pb-2 px-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'KOT'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                  : 'border-transparent text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
              }`}
            >
              KOTs ({kotCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('BILL')}
              className={`pb-2 px-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'BILL'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-transparent text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-200'
              }`}
            >
              Bills ({billCount})
            </button>
          </div>

          {/* Scrollable Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60 dark:divide-slate-800/60 no-scrollbar">
            {filteredList.length === 0 ? (
              <div className="py-10 px-4 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="text-xs sm:text-sm font-semibold text-text dark:text-slate-200">
                  All caught up!
                </h4>
                <p className="text-[11px] text-text-secondary dark:text-slate-400 mt-1 max-w-[240px]">
                  All generated KOTs have been served and all bills have been finalized.
                </p>
              </div>
            ) : (
              filteredList.map((item) => {
                const isKot = item.type === 'KOT';

                return (
                  <div
                    key={item.id}
                    className="p-3 hover:bg-surface/70 dark:hover:bg-slate-800/50 transition-colors flex items-start gap-3 group"
                  >
                    {/* Icon */}
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isKot
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                      }`}
                    >
                      {isKot ? <ChefHat size={16} /> : <Receipt size={16} />}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-text dark:text-white truncate">
                            {item.title}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                              isKot
                                ? item.status === 'READY'
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            }`}
                          >
                            {item.status}
                          </span>
                          {item.tableType && (
                            <span
                              className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                                item.isAc
                                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {item.tableType}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-text-secondary/80 dark:text-slate-400 flex items-center gap-1 shrink-0">
                          <Clock size={10} />
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>

                      <p className="text-[11px] text-text-secondary dark:text-slate-300 mt-0.5 truncate">
                        {item.subtitle}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40 dark:border-slate-800/40">
                        <span className="text-[10px] text-text-secondary/70 dark:text-slate-400">
                          {isKot ? 'Clears when served' : 'Clears when finalized'}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleNavigate(item)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          <span>Open {isKot ? 'Kitchen' : 'Bills'}</span>
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="py-2 px-3 bg-surface/70 dark:bg-slate-800/60 border-t border-border dark:border-slate-800 text-[10px] text-text-secondary dark:text-slate-400 text-center">
            Active items stay here until served or finalized
          </div>
        </div>
      )}
    </div>
  );
}
