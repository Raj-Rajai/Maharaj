import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;

/**
 * Initialize Socket.io with the HTTP server
 * @param {import('http').Server} httpServer
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 15000,
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired authentication token'));
    }
  });

  io.on('connection', (socket) => {
    // Join room handlers
    socket.on('join', (room) => {
      if (['kitchen', 'tables', 'billing', 'orders'].includes(room)) {
        socket.join(room);
      }
    });

    socket.on('leave', (room) => {
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

/**
 * Get active Socket.io instance
 * @returns {import('socket.io').Server | null}
 */
export function getIO() {
  return io;
}

// ─── BROADCAST HELPERS ────────────────────────────────────────────────────────

export function emitKotCreated(kot) {
  if (!io) return;
  io.emit('kot:created', kot);
}

export function emitKotUpdated(kot) {
  if (!io) return;
  io.emit('kot:updated', kot);
}

export function emitTableUpdated(table) {
  if (!io) return;
  io.emit('table:updated', table);
}

export function emitSessionOpened(session) {
  if (!io) return;
  io.emit('session:opened', session);
  if (session?.table) {
    io.emit('table:updated', session.table);
  }
}

export function emitSessionClosed(session) {
  if (!io) return;
  io.emit('session:closed', session);
  if (session?.table) {
    io.emit('table:updated', session.table);
  }
}

export function emitBillCreated(bill) {
  if (!io) return;
  io.emit('bill:created', bill);
  if (bill?.tableId || bill?.table) {
    io.emit('table:updated', bill.table || { id: bill.tableId, status: 'BILLING' });
  }
}

export function emitBillUpdated(bill) {
  if (!io) return;
  io.emit('bill:updated', bill);
}

export function emitBillFinalized(bill) {
  if (!io) return;
  io.emit('bill:finalized', bill);
  if (bill?.tableId || bill?.table) {
    io.emit('table:updated', bill.table || { id: bill.tableId, status: 'AVAILABLE' });
  }
}

export function emitOrderUpdated(order) {
  if (!io) return;
  io.emit('order:updated', order);
}
