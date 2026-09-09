import prisma from '../utils/prisma.js';

export const create = async (data, captainId) => {
  return prisma.$transaction(async (tx) => {
    const table = await tx.table.findUnique({ where: { id: data.tableId } });
    if (!table) throw { status: 404, message: 'Table not found' };
    if (table.status !== 'AVAILABLE') throw { status: 400, message: 'Table is not available' };

    const existingOpenSession = await tx.tableSession.findFirst({
      where: { tableId: data.tableId, status: 'OPEN' }
    });
    if (existingOpenSession) throw { status: 400, message: 'Table already has an open session' };

    const session = await tx.tableSession.create({
      data: {
        tableId: data.tableId,
        captainId,
        guestCount: data.guestCount,
        status: 'OPEN'
      }
    });

    await tx.table.update({
      where: { id: data.tableId },
      data: { status: 'OCCUPIED' }
    });

    return session;
  });
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
  return prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findUnique({
      where: { id },
      include: { orders: true }
    });

    if (!session) throw { status: 404, message: 'Session not found' };
    if (session.status !== 'OPEN') throw { status: 400, message: 'Session is already closed' };

    const hasIncompleteOrders = session.orders.some(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    if (hasIncompleteOrders) throw { status: 400, message: 'Cannot close session with incomplete orders' };

    const updatedSession = await tx.tableSession.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date()
      }
    });

    await tx.table.update({
      where: { id: session.tableId },
      data: { status: 'AVAILABLE' }
    });

    return updatedSession;
  });
};
