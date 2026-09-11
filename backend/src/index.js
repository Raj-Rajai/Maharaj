import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
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

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
