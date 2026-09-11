import { useEffect, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';

// Primary operational pages that should be cached in memory once loaded
const CACHEABLE_ROUTES = new Set([
  '/dashboard',
  '/tables',
  '/kitchen',
  '/bills',
  '/take-away',
  '/users',
  '/menu',
  '/purchases',
  '/inventory',
  '/reports',
  '/settings',
]);

export default function RouteKeepAlive() {
  const location = useLocation();
  const currentOutlet = useOutlet();

  const [cachedRoutes, setCachedRoutes] = useState(() => {
    if (CACHEABLE_ROUTES.has(location.pathname) && currentOutlet) {
      return { [location.pathname]: currentOutlet };
    }
    return {};
  });

  useEffect(() => {
    const path = location.pathname;
    if (CACHEABLE_ROUTES.has(path) && currentOutlet) {
      setCachedRoutes((prev) => {
        if (prev[path]) return prev;
        return { ...prev, [path]: currentOutlet };
      });
    }
  }, [location.pathname, currentOutlet]);

  const currentPath = location.pathname;
  const isCurrentCacheable = CACHEABLE_ROUTES.has(currentPath);
  const isCurrentInCache = Boolean(cachedRoutes[currentPath]);

  return (
    <>
      {/* Persistent cached pages */}
      {Object.entries(cachedRoutes).map(([path, element]) => {
        const isActive = path === currentPath;
        return (
          <div
            key={path}
            style={{ display: isActive ? 'block' : 'none' }}
            className={isActive ? 'w-full h-full' : 'hidden'}
          >
            {element}
          </div>
        );
      })}

      {/* Freshly opened cacheable route not yet captured in state */}
      {isCurrentCacheable && !isCurrentInCache && currentOutlet && (
        <div key={currentPath} className="w-full h-full">
          {currentOutlet}
        </div>
      )}

      {/* Dynamic non-cacheable routes (e.g. table ordering /tables/:tableId/order) */}
      {!isCurrentCacheable && currentOutlet && (
        <div key={currentPath} className="w-full h-full">
          {currentOutlet}
        </div>
      )}
    </>
  );
}
