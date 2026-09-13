import { useEffect } from 'react';
import realtime from '../services/realtime';

/**
 * Hook to subscribe to one or more real-time events while the component is active
 * @param {Record<string, Function>} eventHandlers - Map of event name to handler function
 * @param {boolean} [isActive=true] - Whether the subscription should be active (e.g. from useRouteActive)
 * @param {string[]} [rooms=[]] - Optional rooms to join (e.g. ['kitchen'])
 */
export function useRealtime(eventHandlers = {}, isActive = true, rooms = []) {
  useEffect(() => {
    if (!isActive) return;

    // Join requested rooms
    for (const room of rooms) {
      realtime.join(room);
    }

    // Register event listeners
    const unsubs = [];
    for (const [event, handler] of Object.entries(eventHandlers)) {
      if (typeof handler === 'function') {
        unsubs.push(realtime.on(event, handler));
      }
    }

    return () => {
      // Unsubscribe all
      for (const unsub of unsubs) {
        unsub();
      }
      for (const room of rooms) {
        realtime.leave(room);
      }
    };
  }, [isActive]);
}

export default useRealtime;
