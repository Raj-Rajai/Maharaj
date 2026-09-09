import prisma from '../utils/prisma.js';
import * as auditService from './auditService.js';

export const getAll = async () => {
  const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } });
  return items.map(item => ({
    ...item,
    currentStock: Number(item.currentStock),
    lowStockThreshold: Number(item.lowStockThreshold),
    lowStock: Number(item.currentStock) <= Number(item.lowStockThreshold)
  }));
};

export const getById = async (id) => {
  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 100 } }
  });
  if (!item) throw { status: 404, message: 'Inventory item not found' };
  return {
    ...item,
    currentStock: Number(item.currentStock),
    lowStockThreshold: Number(item.lowStockThreshold),
    lowStock: Number(item.currentStock) <= Number(item.lowStockThreshold),
    transactions: item.transactions.map(t => ({
      ...t, quantity: Number(t.quantity)
    }))
  };
};

export const create = async (data, userId) => {
  const existing = await prisma.inventoryItem.findUnique({ where: { name: data.name } });
  if (existing) throw { status: 400, message: 'Inventory item with this name already exists' };

  const item = await prisma.inventoryItem.create({ data });
  if (userId) {
    await auditService.log({ userId, action: 'CREATE', entity: 'INVENTORY', entityId: item.id, after: { name: data.name, stock: data.currentStock, unit: data.unit } });
  }
  return item;
};

export const update = async (id, data, userId) => {
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) throw { status: 404, message: 'Inventory item not found' };

  const item = await prisma.inventoryItem.update({ where: { id }, data });
  if (userId) {
    await auditService.log({ userId, action: 'UPDATE', entity: 'INVENTORY', entityId: id, before: { name: existing.name, unit: existing.unit, threshold: Number(existing.lowStockThreshold) }, after: { name: data.name || existing.name, unit: data.unit || existing.unit, threshold: data.lowStockThreshold ?? Number(existing.lowStockThreshold) } });
  }
  return item;
};

export const adjust = async (data, userId) => {
  const { inventoryItemId, quantity, type, notes, referenceId } = data;

  const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!item) throw { status: 404, message: 'Inventory item not found' };

  const currentStock = Number(item.currentStock);
  const adjustQty = Number(quantity);
  const newStock = currentStock + adjustQty;

  if (newStock < 0) throw { status: 400, message: `Adjustment would result in negative stock (${currentStock} + ${adjustQty} = ${newStock})` };

  return prisma.$transaction(async (tx) => {
    const updatedItem = await tx.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { currentStock: newStock }
    });

    const transaction = await tx.inventoryTransaction.create({
      data: { inventoryItemId, type, quantity: adjustQty, referenceId, notes }
    });

    if (userId) {
      await auditService.log({ userId, action: 'ADJUST', entity: 'INVENTORY', entityId: inventoryItemId, before: { stock: currentStock }, after: { stock: newStock }, reason: notes || type }, tx);
    }

    return { item: { ...updatedItem, currentStock: Number(updatedItem.currentStock) }, transaction };
  });
};

export const remove = async (id, userId) => {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item) throw { status: 404, message: 'Inventory item not found' };
  await prisma.inventoryItem.delete({ where: { id } });
  if (userId) {
    await auditService.log({ userId, action: 'DELETE', entity: 'INVENTORY', entityId: id, before: { name: item.name, stock: Number(item.currentStock) } });
  }
  return { message: 'Deleted' };
};

export const getTransactions = async (filters = {}) => {
  const where = {};
  if (filters.inventoryItemId) where.inventoryItemId = filters.inventoryItemId;
  if (filters.type) where.type = filters.type;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const d = new Date(filters.endDate);
      d.setHours(23, 59, 59, 999);
      where.createdAt.lte = d;
    }
  }
  return prisma.inventoryTransaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { inventoryItem: true }
  });
};
