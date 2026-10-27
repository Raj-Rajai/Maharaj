import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Context providing boolean: is the current keep-alive route currently active/visible in viewport?
export const RouteActiveContext = createContext(true);

/**
 * Hook to read whether the current keep-alive route is active/visible
 * @returns {boolean}
 */
export const useRouteActive = () => useContext(RouteActiveContext);

/**
 * Hook to execute a refetch function whenever the route transitions from inactive to active.
 * Avoids duplicate calls on initial mount via minIntervalMs cooldown.
 * @param {() => void} onActive - Callback to invoke when route becomes active
 * @param {{ minIntervalMs?: number }} options
 */
export function useOnRouteActive(onActive, options = {}) {
  const isActive = useRouteActive();
  const isFirstMountRef = useRef(true);
  const lastRunRef = useRef(Date.now());
  const minInterval = options.minIntervalMs ?? 1500;

  const onActiveRef = useRef(onActive);
  useEffect(() => {
    onActiveRef.current = onActive;
  }, [onActive]);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    if (isActive) {
      const now = Date.now();
      if (now - lastRunRef.current >= minInterval) {
        lastRunRef.current = now;
        onActiveRef.current?.();
      }
    }
  }, [isActive, minInterval]);
}

// Only keep the high-frequency operational pages cached in memory.
// Heavy / infrequent pages (reports, purchases, inventory, users, settings)
// are excluded to protect 1.5 GB RAM tablets — they will simply re-mount
// when navigated to, which is fine because staff rarely toggle between them.
const CACHEABLE_ROUTES = new Set([
  '/dashboard',
  '/tables',
  '/kitchen',
  '/bills',
  '/take-away',
  '/menu',
]);

// Safety cap — even among cacheable routes, never hold more than this many
// in the DOM simultaneously. If exceeded, the oldest inactive route is evicted.
const MAX_CACHED = 5;

export default function RouteKeepAlive() {
  const location = useLocation();
  const currentOutlet = useOutlet();
  const { user } = useAuth();

  const [cachedRoutes, setCachedRoutes] = useState(() => {
    if (CACHEABLE_ROUTES.has(location.pathname) && currentOutlet) {
      return { [location.pathname]: currentOutlet };
    }
    return {};
  });

  // Clear cached routes on logout or user switch to prevent state/permission leakage
  const prevUserIdRef = useRef(user?.id);
  useEffect(() => {
    if (prevUserIdRef.current && prevUserIdRef.current !== user?.id) {
      setCachedRoutes({});
    }
    prevUserIdRef.current = user?.id;
  }, [user?.id]);

  // Track route visit order for LRU eviction
  const visitOrderRef = useRef([]);

  useEffect(() => {
    const path = location.pathname;
    if (CACHEABLE_ROUTES.has(path) && currentOutlet) {
      setCachedRoutes((prev) => {
        if (prev[path]) return prev;
        let next = { ...prev, [path]: currentOutlet };

        // Evict oldest inactive route if we exceed the safety cap
        const keys = Object.keys(next);
        if (keys.length > MAX_CACHED) {
          // Find the oldest route that is NOT the currently active one
          const order = visitOrderRef.current;
          const evictCandidate = order.find((p) => p !== path && next[p]);
          if (evictCandidate) {
            delete next[evictCandidate];
            visitOrderRef.current = order.filter((p) => p !== evictCandidate);
          }
        }

        return next;
      });

      // Update visit order (move current to end = most recent)
      visitOrderRef.current = [
        ...visitOrderRef.current.filter((p) => p !== path),
        path,
      ];
    }
  }, [location.pathname, currentOutlet]);

  const currentPath = location.pathname;
  const isCurrentCacheable = CACHEABLE_ROUTES.has(currentPath);
  const isCurrentInCache = Boolean(cachedRoutes[currentPath]);

  // Dispatch global custom event for any listeners outside the context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app:route-activate', { detail: { path: currentPath } })
      );
    }
  }, [currentPath]);

  return (
    <>
      {/* Persistent cached pages */}
      {Object.entries(cachedRoutes).map(([path, element]) => {
        const isActive = path === currentPath;
        return (
          <RouteActiveContext.Provider key={path} value={isActive}>
            <div
              style={{ display: isActive ? 'block' : 'none' }}
              className={isActive ? 'w-full h-full' : 'hidden'}
              aria-hidden={!isActive}
            >
              {element}
            </div>
          </RouteActiveContext.Provider>
        );
      })}

      {/* Freshly opened cacheable route not yet captured in state */}
      {isCurrentCacheable && !isCurrentInCache && currentOutlet && (
        <RouteActiveContext.Provider value={true}>
          <div key={currentPath} className="w-full h-full">
            {currentOutlet}
          </div>
        </RouteActiveContext.Provider>
      )}

      {/* Dynamic non-cacheable routes (e.g. table ordering /tables/:tableId/order) */}
      {!isCurrentCacheable && currentOutlet && (
        <RouteActiveContext.Provider value={true}>
          <div key={currentPath} className="w-full h-full">
            {currentOutlet}
          </div>
        </RouteActiveContext.Provider>
      )}
    </>
  );
}

