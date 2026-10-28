import prisma from '../utils/prisma.js';
import { tableCache } from '../utils/cache.js';
import { emitTableUpdated, emitTableChanged, emitOrderUpdated } from '../utils/socket.js';
import * as sessionService from './sessionService.js';
import * as auditService from './auditService.js';

const SECTION_BY_ROLE = { AC_MASTER: 'AC', NON_AC_MASTER: 'NON_AC' };

export const getAll = async () => {
  const cached = tableCache.get();
  if (cached) return cached;

  const tables = await prisma.table.findMany({
    where: { active: true },
    include: {
      sessions: {
        where: { status: 'OPEN' },
        include: { captain: { select: { id: true, name: true, role: true } } },
      },
    },
    orderBy: { number: 'asc' },
  });

  tableCache.set(tables);
  return tables;
};

export const getById = async (id) => {
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table || !table.active) throw { status: 404, message: 'Table not found' };
  return table;
};

export const create = async (data) => {
  const table = await prisma.table.create({ data });
  tableCache.invalidate();
  emitTableUpdated(table);
  return table;
};

export const update = async (id, data) => {
  try {
    const updated = await prisma.table.update({ where: { id }, data });
    tableCache.invalidate();
    emitTableUpdated(updated);
    return updated;
  } catch (error) {
    if (error.code === 'P2025') throw { status: 404, message: 'Table not found' };
    throw error;
  }
};

export const updateStatus = async (id, status) => {
  try {
    const updated = await prisma.table.update({ where: { id }, data: { status } });
    tableCache.invalidate();
    emitTableUpdated(updated);
    return updated;
  } catch (error) {
    if (error.code === 'P2025') throw { status: 404, message: 'Table not found' };
    throw error;
  }
};

export const softDelete = async (id) => {
  const table = await getById(id);
  if (table.status !== 'AVAILABLE') throw { status: 400, message: 'Cannot delete table that is not available' };
  const updated = await prisma.table.update({ where: { id }, data: { active: false } });
  tableCache.invalidate();
  emitTableUpdated(updated);
  return updated;
};

export const remove = async (id) => {
  const table = await prisma.table.findUnique({
    where: { id },
    include: { sessions: { where: { status: 'OPEN' } } }
  });
  if (!table) throw { status: 404, message: 'Table not found' };
  if (table.sessions.length > 0) throw { status: 400, message: 'Cannot delete table with active sessions' };
  const deleted = await prisma.table.delete({ where: { id } });
  tableCache.invalidate();
  return deleted;
};

export const closeTable = async (tableId) => {
  const openSession = await prisma.tableSession.findFirst({
    where: { tableId, status: 'OPEN' },
  });

  if (openSession) {
    await sessionService.close(openSession.id, { cancelOrders: true });
  } else {
    // If no open session exists, directly release table to AVAILABLE
    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'AVAILABLE' },
    });
    tableCache.invalidate();
    emitTableUpdated({ id: tableId, status: 'AVAILABLE' });
  }

  const updatedTable = await prisma.table.findUnique({ where: { id: tableId } });
  return updatedTable;
};

/**
 * Move a running table (open session, active order, draft bill) to another free table.
 * KOTs already raised keep the table number they were printed with; new KOTs and the
 * bill use the new table.
 */
export const changeTable = async (sourceTableId, targetTableId, user) => {
  if (sourceTableId === targetTableId) {
    throw { status: 400, message: 'Choose a different table to move to' };
  }

  const result = await prisma.$transaction(async (tx) => {
    const [source, target, session] = await Promise.all([
      tx.table.findUnique({ where: { id: sourceTableId } }),
      tx.table.findUnique({ where: { id: targetTableId } }),
      tx.tableSession.findFirst({ where: { tableId: sourceTableId, status: 'OPEN' } }),
    ]);

    if (!source) throw { status: 404, message: 'Table not found' };
    if (!target || !target.active) throw { status: 404, message: 'Target table not found' };
    if (!session) throw { status: 400, message: `Table ${source.number} has no running order to move` };

    const section = SECTION_BY_ROLE[user?.role];
    if (section && target.type !== section) {
      throw { status: 403, message: `You can only move tables within the ${section === 'AC' ? 'AC' : 'Non-AC'} section` };
    }

    const targetSession = await tx.tableSession.findFirst({ where: { tableId: targetTableId, status: 'OPEN' } });
    if (targetSession) throw { status: 400, message: `Table ${target.number} is already occupied` };

    // Conditional update claims the target atomically — fails if someone took it meanwhile
    const targetStatus = source.status === 'AVAILABLE' ? 'OCCUPIED' : source.status;
    const claimed = await tx.table.updateMany({
      where: { id: targetTableId, status: 'AVAILABLE', active: true },
      data: { status: targetStatus },
    });
    if (claimed.count === 0) throw { status: 400, message: `Table ${target.number} is no longer available` };

    const activeOrders = await tx.order.findMany({
      where: { sessionId: session.id, status: 'ACTIVE' },
      select: { id: true },
    });
    const activeOrderIds = activeOrders.map((o) => o.id);

    // Freeze the table number on KOTs raised before the move so they keep showing the table they were printed for
    await tx.kOT.updateMany({
      where: {
        tableNumber: null,
        OR: [{ sessionId: session.id }, { orderId: { in: activeOrderIds } }],
      },
      data: { tableNumber: source.number },
    });

    const orderSource = target.type === 'AC' ? 'DINE_IN_AC' : 'DINE_IN_NON_AC';
    await Promise.all([
      tx.tableSession.update({ where: { id: session.id }, data: { tableId: targetTableId } }),
      tx.order.updateMany({
        where: { id: { in: activeOrderIds } },
        data: { tableId: targetTableId, orderSource },
      }),
      tx.bill.updateMany({
        where: { sessionId: session.id, status: 'DRAFT' },
        data: { tableId: targetTableId },
      }),
      tx.table.update({ where: { id: sourceTableId }, data: { status: 'AVAILABLE' } }),
    ]);

    await auditService.log({
      userId: user.id,
      action: 'CHANGE_TABLE',
      entity: 'TABLE_SESSION',
      entityId: session.id,
      before: { tableId: source.id, tableNumber: source.number, type: source.type },
      after: { tableId: target.id, tableNumber: target.number, type: target.type },
    }, tx);

    return {
      sessionId: session.id,
      from: { id: source.id, number: source.number, type: source.type },
      to: { id: target.id, number: target.number, type: target.type },
      targetStatus,
      activeOrderIds,
    };
  });

  tableCache.invalidate();
  emitTableUpdated({ id: result.from.id, status: 'AVAILABLE' });
  emitTableUpdated({ id: result.to.id, status: result.targetStatus });
  emitTableChanged({ sessionId: result.sessionId, from: result.from, to: result.to });
  for (const orderId of result.activeOrderIds) {
    emitOrderUpdated({ id: orderId, tableId: result.to.id, sessionId: result.sessionId });
  }

  return { sessionId: result.sessionId, from: result.from, to: result.to };
};
