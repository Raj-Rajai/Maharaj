import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-3xl',
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-1.5 sm:p-3 md:p-4 tablet-modal-container">
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className={`relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-[96vw] ${sizes[size] || sizes.md} transform transition-all animate-in fade-in zoom-in-95 duration-200 z-[10000] my-auto max-h-[96vh] sm:max-h-[94vh] flex flex-col tablet-modal-content tablet-modal-zoom overflow-hidden`}
      >
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0 tablet-modal-header bg-white dark:bg-slate-900">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate pr-2">{title}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="!p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg cursor-pointer shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200 tablet-modal-body">
          {children}
        </div>

        {footer && (
          <div className="px-3.5 sm:px-5 py-2 sm:py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs rounded-b-2xl shrink-0 sticky bottom-0 z-10 tablet-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
