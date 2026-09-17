import { isConnectionError, describeDbError } from '../utils/prisma.js';

export const errorHandler = (err, req, res, next) => {
  // Database / pooler connection drop — return 503 with retryable flag
  const isConnErr = isConnectionError(err);
  if (isConnErr) {
    // The client response is deliberately generic, so the real cause has to be
    // logged here or it is lost entirely. Previously only `err.code` was logged,
    // which is undefined for most driver-level errors — making a dropped
    // connection, a pool timeout (P2024), a query killed by MySQL and a
    // wrong-provider Prisma client all look identical in the logs.
    console.warn(`[DB 503] ${req.method} ${req.originalUrl} -> ${describeDbError(err)}`);
    if (err?.stack) {
      console.warn(err.stack);
    }
    return res.status(503).json({
      message: 'Database connection temporarily unavailable, please retry',
      retryable: true,
    });
  }

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  const status = err.status || 500;
  const message = err.message || (typeof err === 'string' ? err : 'Internal server error');
  res.status(status).json({
    message,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
