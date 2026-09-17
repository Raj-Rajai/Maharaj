import { isConnectionError } from '../utils/prisma.js';

export const errorHandler = (err, req, res, next) => {
  // Database / PgBouncer connection drop — return 503 with retryable flag
  const isConnErr = isConnectionError(err);
  if (isConnErr) {
    console.warn(`DB connection error (${err.code || 'unknown'}) on ${req.method} ${req.url} — returning 503`);
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
