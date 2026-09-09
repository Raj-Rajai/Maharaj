export const errorHandler = (err, req, res, next) => {
  // Supabase connection drop — return 503 so client knows to retry
  const isConnErr = ['P1017', 'P1001', 'P1002', 'P2024'].includes(err?.code) ||
    err?.message?.includes('Server has closed the connection') ||
    err?.message?.includes("Can't reach database server");
  if (isConnErr) {
    console.warn(`DB connection error (${err.code || 'unknown'}) on ${req.method} ${req.url} — returning 503`);
    return res.status(503).json({
      message: 'Database connection temporarily unavailable, please retry',
      retryable: true,
    });
  }

  console.error('Error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({
    message,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
