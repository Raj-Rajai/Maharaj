import prisma from '../utils/prisma.js';
import * as auditService from './auditService.js';

export const getAll = async (filters = {}) => {
  const where = {};
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.status) where.status = filters.status;
  if (filters.startDate || filters.endDate) {
    where.purchaseDate = {};
    if (filters.startDate) where.purchaseDate.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const d = new Date(filters.endDate);
      d.setHours(23, 59, 59, 999);
      where.purchaseDate.lte = d;
    }
  }
  return prisma.purchaseEntry.findMany({
    where,
    include: { supplier: true, items: true },
    orderBy: { purchaseDate: 'desc' }
  });
};

export const getById = async (id) => {
  const purchase = await prisma.purchaseEntry.findUnique({
    where: { id },
    include: { supplier: true, items: true }
  });
  if (!purchase) throw { status: 404, message: 'Purchase not found' };
  return purchase;
};

export const create = async (data, userId) => {
  const { supplierId, purchaseNumber, purchaseDate, items, addToInventory = false } = data;

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.rate)), 0);

  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchaseEntry.create({
      data: {
        supplierId,
        purchaseNumber,
        purchaseDate: new Date(purchaseDate),
        totalAmount,
        addToInventory,
        status: 'ACTIVE',
        items: {
          create: items.map(item => ({
            name: item.name,
            quantity: Number(item.quantity),
            unit: item.unit,
            rate: Number(item.rate),
            amount: Number(item.quantity) * Number(item.rate)
          }))
        }
      },
      include: { items: true }
    });

    if (addToInventory) {
      for (const item of purchase.items) {
        await addItemToInventory(tx, item, purchase.id, purchase.purchaseNumber);
      }
    }

    if (userId) {
      await auditService.log({
        userId, action: 'CREATE', entity: 'PURCHASE', entityId: purchase.id,
        after: { supplierId, totalAmount, addToInventory, itemCount: items.length }
      }, tx);
    }

    return purchase;
  });
};

export const update = async (id, data, userId) => {
  const existing = await prisma.purchaseEntry.findUnique({
    where: { id },
    include: { items: true }
  });
  if (!existing) throw { status: 404, message: 'Purchase not found' };
  if (existing.status === 'CANCELLED') throw { status: 400, message: 'Cannot edit cancelled purchase' };

  const { supplierId, purchaseNumber, purchaseDate, items, addToInventory } = data;
  const newTotalAmount = items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.rate)), 0);

  return prisma.$transaction(async (tx) => {

    if (existing.addToInventory) {

      const oldMap = {};
      for (const oi of existing.items) {
        const key = `${oi.name}__${oi.unit}`;
        oldMap[key] = Number(oi.quantity);
      }

      const newMap = {};
      for (const ni of items) {
        const key = `${ni.name}__${ni.unit}`;
        newMap[key] = Number(ni.quantity);
      }

      for (const [key, oldQty] of Object.entries(oldMap)) {
        if (!(key in newMap)) {
          const [name, unit] = key.split('__');
          await adjustInventoryForPurchase(tx, name, unit, -oldQty, id, existing.purchaseNumber, 'PURCHASE_REVERSAL');
        }
      }

      for (const [key, newQty] of Object.entries(newMap)) {
        const oldQty = oldMap[key] || 0;
        const diff = newQty - oldQty;
        if (diff !== 0) {
          const [name, unit] = key.split('__');
          const txType = diff > 0 ? 'PURCHASE' : 'PURCHASE_REVERSAL';
          await adjustInventoryForPurchase(tx, name, unit, diff, id, existing.purchaseNumber, txType);
        }
      }
    }

    if (!existing.addToInventory && addToInventory) {
      for (const ni of items) {
        await addItemToInventoryRaw(tx, ni.name, ni.unit, Number(ni.quantity), id, purchaseNumber);
      }
    }

    if (existing.addToInventory && !addToInventory) {
      for (const oi of existing.items) {
        await adjustInventoryForPurchase(tx, oi.name, oi.unit, -Number(oi.quantity), id, existing.purchaseNumber, 'PURCHASE_REVERSAL');
      }
    }

    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

    const updated = await tx.purchaseEntry.update({
      where: { id },
      data: {
        supplierId: supplierId || existing.supplierId,
        purchaseNumber: purchaseNumber !== undefined ? purchaseNumber : existing.purchaseNumber,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : existing.purchaseDate,
        totalAmount: newTotalAmount,
        addToInventory: addToInventory !== undefined ? addToInventory : existing.addToInventory,
        items: {
          create: items.map(i => ({
            name: i.name,
            quantity: Number(i.quantity),
            unit: i.unit,
            rate: Number(i.rate),
            amount: Number(i.quantity) * Number(i.rate)
          }))
        }
      },
      include: { items: true, supplier: true }
    });

    if (userId) {
      await auditService.log({
        userId, action: 'UPDATE', entity: 'PURCHASE', entityId: id,
        before: { totalAmount: Number(existing.totalAmount), itemCount: existing.items.length },
        after: { totalAmount: newTotalAmount, itemCount: items.length, addToInventory }
      }, tx);
    }

    return updated;
  });
};

export const cancel = async (id, userId) => {
  const purchase = await prisma.purchaseEntry.findUnique({
    where: { id },
    include: { items: true }
  });
  if (!purchase) throw { status: 404, message: 'Purchase not found' };
  if (purchase.status === 'CANCELLED') throw { status: 400, message: 'Purchase already cancelled' };

  return prisma.$transaction(async (tx) => {

    if (purchase.addToInventory) {
      for (const item of purchase.items) {
        await adjustInventoryForPurchase(
          tx, item.name, item.unit, -Number(item.quantity),
          id, purchase.purchaseNumber, 'PURCHASE_REVERSAL'
        );
      }
    }

    const cancelled = await tx.purchaseEntry.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { items: true, supplier: true }
    });

    if (userId) {
      await auditService.log({
        userId, action: 'CANCEL', entity: 'PURCHASE', entityId: id,
        before: { status: 'ACTIVE', totalAmount: Number(purchase.totalAmount) },
        after: { status: 'CANCELLED' },
        reason: 'Purchase cancelled'
      }, tx);
    }

    return cancelled;
  });
};

async function addItemToInventory(tx, purchaseItem, purchaseId, purchaseNumber) {
  await addItemToInventoryRaw(
    tx, purchaseItem.name, purchaseItem.unit,
    Number(purchaseItem.quantity), purchaseId, purchaseNumber
  );
}

async function addItemToInventoryRaw(tx, name, unit, quantity, purchaseId, purchaseNumber) {

  let invItem = await tx.inventoryItem.findUnique({ where: { name } });
  if (!invItem) {
    invItem = await tx.inventoryItem.create({
      data: { name, currentStock: quantity, unit, lowStockThreshold: 0 }
    });
  } else {
    const newStock = Number(invItem.currentStock) + quantity;
    await tx.inventoryItem.update({
      where: { id: invItem.id },
      data: { currentStock: Math.max(0, newStock) }
    });
  }

  await tx.inventoryTransaction.create({
    data: {
      inventoryItemId: invItem.id,
      type: 'PURCHASE',
      quantity,
      referenceId: purchaseId,
      notes: `Purchase ${purchaseNumber || purchaseId}`
    }
  });
}

async function adjustInventoryForPurchase(tx, name, unit, quantity, purchaseId, purchaseNumber, txType) {
  const invItem = await tx.inventoryItem.findUnique({ where: { name } });
  if (!invItem) {

    if (quantity < 0) return;

    await tx.inventoryItem.create({
      data: { name, currentStock: Math.max(0, quantity), unit, lowStockThreshold: 0 }
    });
    const created = await tx.inventoryItem.findUnique({ where: { name } });
    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId: created.id, type: txType, quantity,
        referenceId: purchaseId, notes: `Purchase ${txType === 'PURCHASE_REVERSAL' ? 'reversal' : 'adjustment'} - ${purchaseNumber || purchaseId}`
      }
    });
    return;
  }

  const newStock = Math.max(0, Number(invItem.currentStock) + quantity);
  await tx.inventoryItem.update({
    where: { id: invItem.id },
    data: { currentStock: newStock }
  });

  await tx.inventoryTransaction.create({
    data: {
      inventoryItemId: invItem.id, type: txType, quantity,
      referenceId: purchaseId, notes: `Purchase ${txType === 'PURCHASE_REVERSAL' ? 'reversal' : 'adjustment'} - ${purchaseNumber || purchaseId}`
    }
  });
}
