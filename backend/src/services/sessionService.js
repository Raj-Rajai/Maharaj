import prisma from '../utils/prisma.js';
import { tableCache } from '../utils/cache.js';
import { emitSessionOpened, emitSessionClosed, emitTableUpdated, emitOrderUpdated, emitKotUpdated } from '../utils/socket.js';

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
  emitSessionOpened(session);
  emitTableUpdated({ id: data.tableId, status: 'OCCUPIED' });
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

export const close = async (id, options = {}) => {
  const { cancelOrders = true } = options;

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            items: true,
            bill: true,
          },
        },
      },
    });

    if (!session) throw { status: 404, message: 'Session not found' };
    if (session.status !== 'OPEN') throw { status: 400, message: 'Session is already closed' };

    const activeOrders = session.orders.filter(
      (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
    );

    if (activeOrders.length > 0) {
      if (!cancelOrders) {
        throw { status: 400, message: 'Cannot close session with incomplete orders' };
      }

      for (const order of activeOrders) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        });

        await tx.orderItem.updateMany({
          where: {
            orderId: order.id,
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          data: { status: 'CANCELLED' },
        });

        if (order.bill && order.bill.status === 'DRAFT') {
          await tx.bill.update({
            where: { id: order.bill.id },
            data: { status: 'CANCELLED' },
          });
        }
      }
    }

    // Cancel any active uncompleted KOTs for this session
    const activeKots = await tx.kOT.findMany({
      where: {
        sessionId: id,
        status: { in: ['NEW', 'PREPARING', 'READY'] },
      },
    });

    if (activeKots.length > 0) {
      await tx.kOT.updateMany({
        where: {
          id: { in: activeKots.map((k) => k.id) },
        },
        data: { status: 'COMPLETED' },
      });
    }

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

    return {
      closedSession,
      tableId: session.tableId,
      cancelledOrders: activeOrders,
      cancelledKots: activeKots,
    };
  });

  tableCache.invalidate();
  emitSessionClosed(result.closedSession);
  emitTableUpdated({ id: result.tableId, status: 'AVAILABLE' });
  for (const ord of result.cancelledOrders) {
    emitOrderUpdated({ id: ord.id, status: 'CANCELLED', sessionId: id });
  }
  for (const kot of result.cancelledKots) {
    emitKotUpdated({ id: kot.id, kotId: kot.id, kotStatus: 'COMPLETED' });
  }

  return result.closedSession;
};
