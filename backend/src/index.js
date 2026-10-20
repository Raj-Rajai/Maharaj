import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { initSocket } from './utils/socket.js';
import { requestTiming } from './middleware/requestTiming.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import tableRoutes from './routes/tableRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import menuItemRoutes from './routes/menuItemRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import kotRoutes from './routes/kotRoutes.js';
import billRoutes from './routes/billRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import onlineOrderRoutes from './routes/onlineOrderRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;

// DIAGNOSTIC: logs total request time vs. time spent waiting on the database,
// to tell apart "the database is slow" from "the host/CPU is slow".
// Placed first so it wraps every other middleware. Safe to remove later.
app.use(requestTiming);

// Middleware
app.use(helmet());
app.use(
  compression({
    // Only compress responses that exceed 1 KB
    threshold: 1024,
    // Optimal compression level balancing CPU performance and size
    level: 6,
    // Custom filter to respect 'x-no-compression' header
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);
app.use(cors());
app.use(express.json());

// Support requests without /api prefix (e.g. /auth/login -> /api/auth/login)
app.use((req, res, next) => {
  if (!req.url.startsWith('/api') && req.url !== '/') {
    req.url = `/api${req.url}`;
  }
  next();
});

// Root & Health check
app.get(['/', '/api', '/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', service: 'Maharaj Veg Villa API', timestamp: new Date().toISOString() });
});

// TEMPORARY DIAGNOSTIC — test raw SQL to reveal the exact error behind 503s.
// No auth required so it can be tested via curl from anywhere. Remove once resolved.
app.get(['/api/db-diag', '/db-diag'], async (req, res) => {
  const { rawQuery, describeDbError, isMySQL } = await import('./utils/prisma.js');
  const results = { provider: isMySQL() ? 'mysql' : 'postgresql', dbUrl: (process.env.DATABASE_URL || '').replace(/\/\/[^@]+@/, '//***:***@'), tests: {} };
  const safe = (v) => JSON.parse(JSON.stringify(v, (_, val) => typeof val === 'bigint' ? Number(val) : val));
  // Test 1: simple SELECT
  try {
    const r = await rawQuery('SELECT 1 as ok');
    results.tests.simpleSelect = { ok: true, result: safe(r) };
  } catch (e) {
    results.tests.simpleSelect = { ok: false, error: describeDbError(e), stack: e.stack?.split('\n').slice(0, 5) };
  }
  // Test 2: query a real table
  try {
    const r = await rawQuery('SELECT COUNT(*) as cnt FROM `Bill`');
    results.tests.billCount = { ok: true, result: safe(r) };
  } catch (e) {
    results.tests.billCount = { ok: false, error: describeDbError(e), stack: e.stack?.split('\n').slice(0, 5) };
  }
  // Test 3: the actual bill query (simplified)
  try {
    const r = await rawQuery('SELECT b.id, b.billNumber FROM `Bill` b LEFT JOIN `Order` o ON o.id = b.orderId LIMIT 2');
    results.tests.billJoin = { ok: true, result: safe(r) };
  } catch (e) {
    results.tests.billJoin = { ok: false, error: describeDbError(e), stack: e.stack?.split('\n').slice(0, 5) };
  }
  res.json(results);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/menu/categories', categoryRoutes);
app.use('/api/menu/items', menuItemRoutes);
app.use('/api/table-sessions', sessionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/kots', kotRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/online-orders', onlineOrderRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);


// Error handler (must be last)
app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

if (!process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} with WebSockets enabled`);
  });
}

export { server };
export default app;
