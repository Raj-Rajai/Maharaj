import { useEffect, useRef } from 'react';
import realtime from '../services/realtime';

/**
 * Hook to subscribe to one or more real-time events while the component is active.
 *
 * Debounce behaviour (fixes cascading re-fetch storms on low-RAM devices):
 * When the backend emits multiple events within a short window (e.g. both
 * `bill:created` AND `table:updated` within the same transaction), the original
 * code would fire each handler immediately — triggering 5-10 duplicate API
 * calls in < 2 seconds. Now, each unique handler is trailing-debounced by
 * `debounceMs` (default 400ms) so only the LAST invocation fires.
 *
 * @param {Record<string, Function>} eventHandlers - Map of event name to handler function
 * @param {boolean} [isActive=true] - Whether the subscription should be active (e.g. from useRouteActive)
 * @param {string[]} [rooms=[]] - Optional rooms to join (e.g. ['kitchen'])
 * @param {number} [debounceMs=400] - Debounce interval in milliseconds
 */
export function useRealtime(eventHandlers = {}, isActive = true, rooms = [], debounceMs = 400) {
  // Keep a stable ref to the latest handlers so the effect doesn't re-run on every render
  const handlersRef = useRef(eventHandlers);
  handlersRef.current = eventHandlers;

  useEffect(() => {
    if (!isActive) return;

    // Join requested rooms
    for (const room of rooms) {
      realtime.join(room);
    }

    // Per-event debounce timers
    const timers = {};

    // Register event listeners with trailing debounce
    const unsubs = [];
    for (const [event, handler] of Object.entries(handlersRef.current)) {
      if (typeof handler === 'function') {
        const debouncedHandler = (...args) => {
          clearTimeout(timers[event]);
          timers[event] = setTimeout(() => {
            // Use the latest handler ref in case it changed between debounce start and fire
            const latestHandler = handlersRef.current[event];
            if (typeof latestHandler === 'function') {
              latestHandler(...args);
            } else {
              handler(...args);
            }
          }, debounceMs);
        };
        unsubs.push(realtime.on(event, debouncedHandler));
      }
    }

    return () => {
      // Clear all pending debounce timers
      for (const t of Object.values(timers)) {
        clearTimeout(t);
      }
      // Unsubscribe all
      for (const unsub of unsubs) {
        unsub();
      }
      for (const room of rooms) {
        realtime.leave(room);
      }
    };
  }, [isActive, debounceMs]);
}

export default useRealtime;
