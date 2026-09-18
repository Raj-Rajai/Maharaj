import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ensure valid current page range
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, validPage * pageSize);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (validPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (validPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', validPage - 1, validPage, validPage + 1, '...', totalPages];
  }, [totalPages, validPage]);

  const handlePageClick = (p) => {
    if (typeof p === 'number' && p >= 1 && p <= totalPages && p !== validPage) {
      onPageChange?.(p);
    }
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-border dark:border-slate-800 bg-surface/40 dark:bg-slate-900/60 select-none ${className}`}
    >
      {/* Left: Summary text & rows per page selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-4 text-xs text-text-secondary dark:text-slate-400">
        <div>
          Showing <span className="font-semibold text-text dark:text-slate-100">{startItem}</span> to{' '}
          <span className="font-semibold text-text dark:text-slate-100">{endItem}</span> of{' '}
          <span className="font-semibold text-text dark:text-slate-100">{totalItems}</span> entries
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-0 sm:pl-2 sm:border-l sm:border-border sm:dark:border-slate-800">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
              }}
              className="bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-text dark:text-slate-200 text-xs font-medium rounded-lg px-2 py-1 focus:outline-none focus:border-primary cursor-pointer shadow-2xs"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Pagination buttons */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={validPage === 1}
          title="First Page"
          className="p-1.5 rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Previous Page */}
        <button
          type="button"
          onClick={() => handlePageClick(validPage - 1)}
          disabled={validPage === 1}
          title="Previous Page"
          className="p-1.5 rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Numbered Buttons */}
        <div className="flex items-center gap-1 mx-0.5">
          {pageNumbers.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs text-text-secondary dark:text-slate-500 select-none"
                >
                  •••
                </span>
              );
            }

            const isActive = p === validPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => handlePageClick(p)}
                className={`min-w-[28px] sm:min-w-[32px] h-7 sm:h-8 px-1.5 sm:px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-xs border border-primary'
                    : 'bg-white dark:bg-slate-800 border border-border dark:border-slate-700 text-text dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => handlePageClick(validPage + 1)}
          disabled={validPage === totalPages}
          title="Next Page"
          className="p-1.5 rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronRight size={14} />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => handlePageClick(totalPages)}
          disabled={validPage === totalPages}
          title="Last Page"
          className="p-1.5 rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-800 text-text dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
