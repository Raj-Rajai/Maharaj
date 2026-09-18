import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Filter, ArrowUp, ArrowDown, Search, X, Check, RotateCcw } from 'lucide-react';

export default function MasterColumnFilter({
  isOpen,
  onClose,
  anchorRect,
  columnKey,
  columnLabel,
  allValues = [],
  selectedValues = null,
  onApplyFilter,
  sortConfig = null,
  onApplySort,
  targetCellValue = null,
  sortType = 'text',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelected, setTempSelected] = useState(new Set());
  const popoverRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (selectedValues && selectedValues.size > 0) {
        setTempSelected(new Set(selectedValues));
      } else {

        setTempSelected(new Set(allValues.map((v) => v.value)));
      }
      setSearchTerm('');
    }
  }, [isOpen, selectedValues, allValues]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return allValues;
    const term = searchTerm.toLowerCase();
    return allValues.filter((item) => {
      const label = (item.label || item.value || '').toLowerCase();
      return label.includes(term);
    });
  }, [allValues, searchTerm]);

  const isAllSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    return filteredItems.every((item) => tempSelected.has(item.value));
  }, [filteredItems, tempSelected]);

  const isIndeterminate = useMemo(() => {
    const selectedCount = filteredItems.filter((item) => tempSelected.has(item.value)).length;
    return selectedCount > 0 && selectedCount < filteredItems.length;
  }, [filteredItems, tempSelected]);

  const handleToggleAll = () => {
    const next = new Set(tempSelected);
    if (isAllSelected) {

      filteredItems.forEach((item) => next.delete(item.value));
    } else {

      filteredItems.forEach((item) => next.add(item.value));
    }
    setTempSelected(next);
  };

  const handleToggleItem = (val) => {
    const next = new Set(tempSelected);
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    setTempSelected(next);
  };

  const handleApply = () => {
    if (tempSelected.size === allValues.length || tempSelected.size === 0) {
      onApplyFilter(tempSelected.size === 0 ? new Set(['__EMPTY__']) : null);
    } else {
      onApplyFilter(new Set(tempSelected));
    }
    onClose();
  };

  const handleClearColumn = () => {
    onApplyFilter(null);
    if (sortConfig?.columnKey === columnKey) {
      onApplySort(null);
    }
    onClose();
  };

  const handleFilterOnlyThis = (val) => {
    onApplyFilter(new Set([val]));
    onClose();
  };

  if (!isOpen) return null;

  const popoverWidth = Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 24 : 280);
  const winHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
  const maxHeight = Math.min(380, winHeight - 24);

  let top = (anchorRect?.bottom || 100) + 4;
  let left = anchorRect?.left || 100;

  if (top + maxHeight > winHeight) {
    const aboveTop = (anchorRect?.top || 200) - maxHeight - 4;
    if (aboveTop >= 8) {
      top = aboveTop;
    } else {
      top = Math.max(8, winHeight - maxHeight - 8);
    }
  }
  if (left + popoverWidth > winWidth - 12) {
    left = Math.max(8, winWidth - popoverWidth - 12);
  }
  if (left < 12) {
    left = 12;
  }

  const sortLabels = {
    text: { asc: 'Sort A to Z', desc: 'Sort Z to A' },
    number: { asc: 'Sort Smallest to Largest', desc: 'Sort Largest to Smallest' },
    date: { asc: 'Sort Oldest to Newest', desc: 'Sort Newest to Oldest' },
  }[sortType] || { asc: 'Sort Ascending', desc: 'Sort Descending' };

  return (
    <>
      <div className="fixed inset-0 z-40 cursor-default" onClick={onClose} />

      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          maxHeight: `${maxHeight}px`,
        }}
        className="z-50 w-72 max-w-[calc(100vw-24px)] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 text-text dark:text-slate-100 text-xs p-3 font-sans animate-in fade-in zoom-in-95 duration-100 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="flex items-center justify-between pb-2 border-b border-border dark:border-slate-800">
          <div className="flex items-center gap-1.5 font-semibold text-text dark:text-slate-100 text-xs">
            <Filter size={13} className="text-primary dark:text-blue-400" />
            <span>Master Filter: <span className="text-primary dark:text-blue-400">{columnLabel}</span></span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-100 hover:bg-surface dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onApplySort(sortConfig?.columnKey === columnKey && sortConfig?.direction === 'asc' ? null : 'asc')}
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
              sortConfig?.columnKey === columnKey && sortConfig?.direction === 'asc'
                ? 'bg-primary/10 dark:bg-primary/25 border-primary text-primary dark:text-blue-300 font-semibold shadow-xs'
                : 'bg-surface dark:bg-slate-800 border-border dark:border-slate-700 text-text dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowUp size={12} className="shrink-0" />
            <span className="truncate">{sortLabels.asc}</span>
          </button>
          <button
            onClick={() => onApplySort(sortConfig?.columnKey === columnKey && sortConfig?.direction === 'desc' ? null : 'desc')}
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
              sortConfig?.columnKey === columnKey && sortConfig?.direction === 'desc'
                ? 'bg-primary/10 dark:bg-primary/25 border-primary text-primary dark:text-blue-300 font-semibold shadow-xs'
                : 'bg-surface dark:bg-slate-800 border-border dark:border-slate-700 text-text dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowDown size={12} className="shrink-0" />
            <span className="truncate">{sortLabels.desc}</span>
          </button>
        </div>

        {targetCellValue !== null && targetCellValue !== undefined && (
          <button
            onClick={() => handleFilterOnlyThis(targetCellValue)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
            title={`Filter table to only show ${targetCellValue || '(Blank)'}`}
          >
            <span className="truncate">
              ⚡ Filter only: <strong>{targetCellValue || '(Blank)'}</strong>
            </span>
            <Check size={13} className="shrink-0 ml-1.5" />
          </button>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400" />
          <input
            type="text"
            placeholder={`Search in ${columnLabel}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-surface dark:bg-slate-800 rounded-lg border border-border dark:border-slate-700 focus:outline-none focus:border-primary text-text dark:text-slate-100"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary dark:text-slate-400 hover:text-text dark:hover:text-slate-100"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between px-1 text-[11px] text-text-secondary dark:text-slate-400 font-medium">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = isIndeterminate;
              }}
              onChange={handleToggleAll}
              className="rounded border-border dark:border-slate-600 text-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            <span>(Select All)</span>
          </label>
          <span className="text-[10px] text-text-secondary dark:text-slate-400">
            {filteredItems.length} values
          </span>
        </div>

        <div className="max-h-32 sm:max-h-44 flex-1 overflow-y-auto space-y-0.5 pr-1 divide-y divide-slate-50 dark:divide-slate-800 border border-border/50 dark:border-slate-800 rounded-lg p-1 bg-slate-50/50 dark:bg-slate-800/50">
          {filteredItems.map(({ value, label, count, icon }) => {
            const isChecked = tempSelected.has(value);
            return (
              <label
                key={value}
                className="flex items-center justify-between px-2 py-1 rounded hover:bg-white dark:hover:bg-slate-800 cursor-pointer select-none text-xs transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleItem(value)}
                    className="rounded border-border dark:border-slate-600 text-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  {icon && (
                    <img src={icon} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                  )}
                  <span className="truncate text-text dark:text-slate-200 font-medium">{label || value}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-text-secondary dark:text-slate-400 font-mono shrink-0 ml-1.5">
                  {count}
                </span>
              </label>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="py-4 text-center text-text-secondary dark:text-slate-400 text-xs">
              No matching values found
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border dark:border-slate-800">
          <button
            onClick={handleClearColumn}
            className="text-[11px] text-danger hover:underline font-medium flex items-center gap-1"
          >
            <RotateCcw size={11} /> Clear Filter
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="px-2.5 py-1 text-xs rounded-lg border border-border dark:border-slate-700 text-text dark:text-slate-200 hover:bg-surface dark:hover:bg-slate-800 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1 text-xs rounded-lg bg-primary text-white hover:bg-primary-light font-semibold shadow-xs transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
