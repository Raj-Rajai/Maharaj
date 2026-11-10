import React, { useState, useEffect, useRef, Suspense } from 'react';

// Schedule work for when the main thread is idle (falls back to a short timeout on
// browsers without requestIdleCallback, e.g. older Safari / Fire OS Silk).
const scheduleIdle = (cb, timeout = 200) => {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(cb, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(cb, 32);
  return () => clearTimeout(id);
};

// A node inside a hidden RouteKeepAlive page (display:none) has no layout box.
// getBoundingClientRect() then returns all zeros, which used to look "in viewport"
// and mounted every section of every cached page in the background.
const hasLayout = (node) => node.offsetParent !== null || node.getClientRects().length > 0;

/**
 * Super-lazy section loader.
 *
 * Stage 1 — prefetch: when the section is within `prefetchMargin` of the viewport,
 *           `preload()` is called so the code chunk (e.g. recharts) starts downloading.
 * Stage 2 — mount: when within `rootMargin`, children are mounted on the next idle
 *           frame so fast scrolling never drops frames.
 * While a lazy chunk is still downloading, the same skeleton is shown via Suspense,
 * so there is no layout jump.
 */
export default function LazyScrollSection({
  children,
  minHeight = '240px',
  className = '',
  rootMargin = '140px 0px',
  prefetchMargin = '600px 0px',
  preload,
  placeholderType = 'default',
  title = '',
}) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const containerRef = useRef(null);
  const preloadedRef = useRef(false);
  const preloadRef = useRef(preload);
  preloadRef.current = preload;

  const runPreload = () => {
    if (preloadedRef.current || !preloadRef.current) return;
    preloadedRef.current = true;
    try {
      const p = preloadRef.current();
      if (p && typeof p.catch === 'function') p.catch(() => { preloadedRef.current = false; });
    } catch {
      preloadedRef.current = false;
    }
  };

  useEffect(() => {
    if (hasLoaded) return;
    const node = containerRef.current;
    if (!node) return;

    let cancelIdle = null;
    let rafId = null;
    let cleanedUp = false;

    const reveal = () => {
      if (cancelIdle || cleanedUp) return;
      runPreload();
      cancelIdle = scheduleIdle(() => {
        if (!cleanedUp) setHasLoaded(true);
      });
    };

    const isNear = (extra) => {
      if (!hasLayout(node)) return false;
      const rect = node.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      return rect.top <= windowHeight + extra && rect.bottom >= -extra;
    };

    // Already on screen at first render (e.g. tall tablet viewport)
    if (isNear(160)) {
      reveal();
      return () => { cleanedUp = true; cancelIdle?.(); };
    }

    if (!('IntersectionObserver' in window)) {
      reveal();
      return () => { cleanedUp = true; cancelIdle?.(); };
    }

    const mountObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          mountObserver.disconnect();
          reveal();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    mountObserver.observe(node);

    let prefetchObserver = null;
    if (preloadRef.current) {
      prefetchObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            prefetchObserver.disconnect();
            runPreload();
          }
        },
        { rootMargin: prefetchMargin, threshold: 0 }
      );
      prefetchObserver.observe(node);
    }

    // Fallback for scroll containers where IntersectionObserver misfires (KeepAlive <main>).
    // rAF-throttled so it never runs more than once per frame.
    const scrollParent = node.closest('main') || window;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (isNear(160)) {
          scrollParent.removeEventListener('scroll', handleScroll);
          mountObserver.disconnect();
          reveal();
        }
      });
    };
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      cleanedUp = true;
      mountObserver.disconnect();
      prefetchObserver?.disconnect();
      scrollParent.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
      cancelIdle?.();
    };
  }, [hasLoaded, rootMargin, prefetchMargin]);

  const skeleton = <SectionSkeleton minHeight={minHeight} type={placeholderType} title={title} />;

  return (
    <div
      ref={containerRef}
      className={`lazy-scroll-section ${hasLoaded ? 'scroll-reveal-active' : ''} ${className}`}
      style={!hasLoaded ? { minHeight } : undefined}
    >
      {hasLoaded ? <Suspense fallback={skeleton}>{children}</Suspense> : skeleton}
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
