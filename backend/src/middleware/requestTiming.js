import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Diagnostic timing middleware.
 *
 * Tracks how much of each request's total time was spent waiting on the
 * database vs. everything else (auth, JSON parsing, business logic, the
 * Node event loop itself). Logs one line per write request (and any slow
 * request) so we can tell, from real production traffic, whether slow
 * writes are a database problem or a host/CPU problem.
 *
 * Safe to leave on temporarily — logging is gated to writes and slow
 * requests only, to keep log volume reasonable. Remove this file and its
 * two call sites (here + prisma.js) once the diagnosis is done.
 */
export const requestTimingStorage = new AsyncLocalStorage();

const SLOW_REQUEST_MS = 500;

export const requestTiming = (req, res, next) => {
  const start = process.hrtime.bigint();
  const store = { dbTimeMs: 0, dbQueryCount: 0 };

  res.on('finish', () => {
    const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
    const { dbTimeMs, dbQueryCount } = store;
    const otherMs = Math.max(0, totalMs - dbTimeMs);
    const dbShare = totalMs > 0 ? ((dbTimeMs / totalMs) * 100).toFixed(1) : '0.0';
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

    if (isWrite || totalMs > SLOW_REQUEST_MS) {
      const tag = totalMs > SLOW_REQUEST_MS ? 'SLOW' : 'OK';
      console.log(
        `[Timing:${tag}] ${req.method} ${req.originalUrl} -> ` +
        `total=${totalMs.toFixed(1)}ms db=${dbTimeMs.toFixed(1)}ms ` +
        `(${dbQueryCount} queries, ${dbShare}% of total) ` +
        `other=${otherMs.toFixed(1)}ms status=${res.statusCode}`
      );
    }
  });

  requestTimingStorage.run(store, next);
};
