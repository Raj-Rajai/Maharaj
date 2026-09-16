import prisma from '../utils/prisma.js';
import { tableCache } from '../utils/cache.js';
import { emitTableUpdated } from '../utils/socket.js';
import * as sessionService from './sessionService.js';

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

