import React, { useState, useEffect, useRef } from 'react';

export default function LazyScrollSection({
  children,
  minHeight = '240px',
  className = '',
  rootMargin = '140px 0px',
  placeholderType = 'default',
  title = '',
}) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (hasLoaded) return;
    const node = containerRef.current;
    if (!node) return;

    // Check if element is already within viewport on initial render
    const checkVisibility = () => {
      const rect = node.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top <= windowHeight + 160 && rect.bottom >= -160) {
        setHasLoaded(true);
        return true;
      }
      return false;
    };

    if (checkVisibility()) return;

    if (!('IntersectionObserver' in window)) {
      setHasLoaded(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setHasLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.05 }
    );

    observer.observe(node);

    // Fallback scroll listener on the closest scrollable container (e.g. main)
    const scrollParent = node.closest('main') || window;
    const handleScroll = () => {
      if (checkVisibility()) {
        observer.disconnect();
        scrollParent.removeEventListener('scroll', handleScroll);
      }
    };
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      scrollParent.removeEventListener('scroll', handleScroll);
    };
  }, [hasLoaded, rootMargin]);

  return (
    <div
      ref={containerRef}
      className={`lazy-scroll-section ${hasLoaded ? 'scroll-reveal-active' : ''} ${className}`}
      style={!hasLoaded ? { minHeight } : undefined}
    >
      {hasLoaded ? (
        children
      ) : (
        <SectionSkeleton minHeight={minHeight} type={placeholderType} title={title} />
      )}
    </div>
  );
}

function SectionSkeleton({ minHeight, type, title }) {
  return (
    <div
      style={{ minHeight }}
      className="w-full rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-dashed border-border/80 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between animate-pulse shadow-2xs"
    >
      <div className="flex items-center justify-between pb-3 border-b border-border/50 dark:border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-slate-800" />
          <div className="space-y-1.5">
            <div className="w-32 h-3.5 bg-slate-200/80 dark:bg-slate-800 rounded-md" />
            <div className="w-48 h-2.5 bg-slate-100 dark:bg-slate-850 rounded-md" />
          </div>
        </div>
        <div className="w-20 h-5 bg-slate-100 dark:bg-slate-800 rounded-full" />
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        <div className="space-y-3 w-full max-w-sm mx-auto text-center">
          <div className="w-full h-20 bg-slate-100/60 dark:bg-slate-800/40 rounded-xl" />
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/70"></span>
            </span>
            <span className="text-[11px] font-medium text-text-secondary dark:text-slate-400">
              {title ? `Scroll to reveal ${title}` : 'Scroll to reveal section'}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-border/40 dark:border-slate-800/60 flex justify-between items-center text-[10px] text-text-secondary/60">
        <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded" />
        <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded" />
      </div>
    </div>
  );
}
