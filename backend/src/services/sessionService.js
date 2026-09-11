import prisma from '../utils/prisma.js';
import { tableCache } from '../utils/cache.js';

export const create = async (data, captainId) => {
  const session = await prisma.$transaction(async (tx) => {
    // Parallelize table lookup and open session check
    const [table, existingOpenSession] = await Promise.all([
      tx.table.findUnique({ where: { id: data.tableId } }),
      tx.tableSession.findFirst({
        where: { tableId: data.tableId, status: 'OPEN' },
      }),
    ]);

    if (!table) throw { status: 404, message: 'Table not found' };
    if (table.status !== 'AVAILABLE') throw { status: 400, message: 'Table is not available' };
    if (existingOpenSession) throw { status: 400, message: 'Table already has an open session' };

    // Parallelize session creation and table status update
    const [newSession] = await Promise.all([
      tx.tableSession.create({
        data: {
          tableId: data.tableId,
          captainId,
          guestCount: data.guestCount,
          status: 'OPEN',
        },
      }),
      tx.table.update({
        where: { id: data.tableId },
        data: { status: 'OCCUPIED' },
      }),
    ]);

    return newSession;
  });

  tableCache.invalidate();
  return session;
};

export const getActive = async () => {
  return prisma.tableSession.findMany({
    where: { status: 'OPEN' },
    include: {
      table: true,
      captain: { select: { name: true } }
    }
  });
};

export const getById = async (id) => {
  const session = await prisma.tableSession.findUnique({
    where: { id },
    include: {
      table: true,
      captain: { select: { name: true } },
      orders: true,
      kots: true
    }
  });
  if (!session) throw { status: 404, message: 'Session not found' };
  return session;
};

export const close = async (id) => {
  const updatedSession = await prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findUnique({
      where: { id },
      include: { orders: true }
    });

    if (!session) throw { status: 404, message: 'Session not found' };
    if (session.status !== 'OPEN') throw { status: 400, message: 'Session is already closed' };

    const hasIncompleteOrders = session.orders.some(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    if (hasIncompleteOrders) throw { status: 400, message: 'Cannot close session with incomplete orders' };

    // Parallelize session close and table release
    const [closedSession] = await Promise.all([
      tx.tableSession.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
        },
      }),
      tx.table.update({
        where: { id: session.tableId },
        data: { status: 'AVAILABLE' },
      }),
    ]);

    return closedSession;
  });

  tableCache.invalidate();
  return updatedSession;
};
