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
      // TEMPORARY DIAGNOSTIC — these 503s hide their real cause, and the server
      // log has not been reachable, so surface it in the response where it can be
      // read from the browser's network tab. Remove once the cause is known.
      debug: describeDbError(err),
    });
  }

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);
  if (err?.code === 'P2003') {
    return res.status(400).json({
      message: 'Cannot delete or modify this record because it is referenced by other records (e.g. menu items, orders, or stock history).',
      error: { message: 'Foreign key constraint violation', code: 'P2003' },
    });
  }
  if (err?.code === 'P2002') {
    return res.status(400).json({
      message: 'A record with this value already exists.',
      error: { message: 'Unique constraint violation', code: 'P2002' },
    });
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({
      message: 'The requested record was not found.',
      error: { message: 'Record not found', code: 'P2025' },
    });
  }
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
