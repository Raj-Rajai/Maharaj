import prisma from '../utils/prisma.js';
import { parseDateRange } from '../utils/dateUtils.js';

export const log = async ({ userId, action, entity, entityId, before = null, after = null, reason = null }, tx = null) => {
  try {
    const client = tx || prisma;
    return await client.auditLog.create({
      data: { userId, action, entity, entityId, before, after, reason }
    });
  } catch (err) {
    console.error('Failed to create audit log:', err);
    return null;
  }
};

export const getAll = async (filters = {}) => {
  const where = {};
  if (filters.entity) where.entity = filters.entity;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.startDate || filters.endDate) {
    const { start, end } = parseDateRange(filters.startDate, filters.endDate);
    where.createdAt = { gte: start, lte: end };
  }
  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200
  });
};
