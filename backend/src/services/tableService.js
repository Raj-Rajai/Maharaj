import prisma from '../utils/prisma.js';
import { tableCache } from '../utils/cache.js';

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
  return table;
};

export const update = async (id, data) => {
  try {
    const updated = await prisma.table.update({ where: { id }, data });
    tableCache.invalidate();
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
  return updated;
};

export const remove = async (id) => {
  const table = await prisma.table.findUnique({
    where: { id },
    include: { sessions: { where: { status: 'OPEN' } } }
  });
  if (!table) throw { status: 404, message: 'Table not found' };
  if (table.sessions.length > 0) throw { status: 400, message: 'Cannot delete table with active sessions' };
  if (table.status === 'OCCUPIED') throw { status: 400, message: 'Cannot delete occupied table' };
  const deleted = await prisma.table.delete({ where: { id } });
  tableCache.invalidate();
  return deleted;
};
