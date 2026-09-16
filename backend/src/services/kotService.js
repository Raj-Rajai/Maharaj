import prisma from '../utils/prisma.js';
import { emitKotCreated, emitKotUpdated } from '../utils/socket.js';

export const create = async (orderId, captainId, sessionId = null) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      table: true,
    },
  });
  if (!order) throw { status: 404, message: 'Order not found' };

  const pendingItems = order.items.filter((item) => item.status === 'PENDING');
  if (pendingItems.length === 0) {
    throw { status: 400, message: 'No pending items to generate KOT' };
  }

  const kot = await prisma.$transaction(async (tx) => {
    // Generate sequential kotNumber per day inside the transaction
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await tx.kOT.count({
      where: {
        createdAt: { gte: today },
      },
    });
    const kotNumber = count + 1;

    const createdKot = await tx.kOT.create({
      data: {
        kotNumber,
        orderId,
        sessionId,
        captainId,
      },
    });

    await tx.orderItem.updateMany({
      where: {
        id: { in: pendingItems.map((i) => i.id) },
      },
      data: {
        kotId: createdKot.id,
        status: 'SENT',
      },
    });

    return createdKot;
  });

  const result = await getById(kot.id);
  emitKotCreated(result);
  return result;
};

export const getAll = async (filters) => {
  const { status, startDate, endDate } = filters || {};
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('k.status = ?');
    params.push(status);
  }

  if (startDate || endDate) {
    if (startDate) {
      conditions.push('k.createdAt >= ?');
      params.push(new Date(startDate));
    }
    if (endDate) {
      conditions.push('k.createdAt <= ?');
      params.push(new Date(endDate));
    }
  } else if (!status) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    conditions.push('(k.status IN (\'NEW\', \'PREPARING\', \'READY\') OR k.createdAt >= ?)');
    params.push(today);
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    conditions.push('k.createdAt >= ?');
    params.push(today);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT k.id, k.kotNumber, k.orderId, k.sessionId, k.captainId, k.status, k.createdAt,
           o.id as order_id, o.orderSource, o.tableId,
           t.id as table_id, t.number as table_number, t.type as table_type
    FROM \`KOT\` k
    LEFT JOIN \`Order\` o ON o.id = k.orderId
    LEFT JOIN \`Table\` t ON t.id = o.tableId
    ${whereClause}
    ORDER BY k.createdAt DESC
  `;

  const rows = await prisma.$queryRawUnsafe(sql, ...params);
  if (!rows || rows.length === 0) return [];

  const kotIds = rows.map(r => r.id);
  const itemsPlaceholders = kotIds.map(() => '?').join(', ');
  const itemsSql = `
    SELECT id, orderId, menuItemId, itemNameSnapshot, priceSnapshot,
           quantity, originalQuantity, status, notes, kotId, createdAt
    FROM \`OrderItem\`
    WHERE kotId IN (${itemsPlaceholders})
  `;
  const items = await prisma.$queryRawUnsafe(itemsSql, ...kotIds);

  const itemsByKotId = {};
  for (const item of items) {
    if (!itemsByKotId[item.kotId]) {
      itemsByKotId[item.kotId] = [];
    }
    itemsByKotId[item.kotId].push({
      id: item.id,
      orderId: item.orderId,
      menuItemId: item.menuItemId,
      itemNameSnapshot: item.itemNameSnapshot,
      priceSnapshot: item.priceSnapshot,
      quantity: item.quantity,
      originalQuantity: item.originalQuantity,
      status: item.status,
      notes: item.notes,
      kotId: item.kotId,
      createdAt: item.createdAt,
    });
  }

  return rows.map(row => ({
    id: row.id,
    kotNumber: row.kotNumber,
    orderId: row.orderId,
    sessionId: row.sessionId,
    captainId: row.captainId,
    status: row.status,
    createdAt: row.createdAt,
    items: itemsByKotId[row.id] || [],
    order: row.order_id ? {
      id: row.order_id,
      orderSource: row.orderSource,
      tableId: row.tableId,
      table: row.table_id ? { id: row.table_id, number: row.table_number, type: row.table_type } : null
    } : null
  }));
};

export const getById = async (id) => {
  const kot = await prisma.kOT.findUnique({
    where: { id },
    include: {
      items: {
        include: { menuItem: true },
      },
      order: {
        select: {
          id: true,
          orderSource: true,
          tableId: true,
          table: { select: { id: true, number: true, type: true } },
        },
      },
    },
  });

  if (!kot) {
    throw { status: 404, message: 'KOT not found' };
  }

  return kot;
};

export const updateStatus = async (id, status) => {
  const kot = await prisma.kOT.findUnique({ where: { id } });
  if (!kot) {
    throw { status: 404, message: 'KOT not found' };
  }

  const updated = await prisma.kOT.update({
    where: { id },
    data: { status },
  });
  emitKotUpdated(updated);
  return updated;
};

export const updateItemStatus = async (itemId, status) => {
  const orderItem = await prisma.orderItem.findUnique({ where: { id: itemId } });
  if (!orderItem) {
    throw { status: 404, message: 'Order item not found' };
  }
  if (!orderItem.kotId) {
    throw { status: 400, message: 'Order item does not belong to a KOT' };
  }

  const validTransitions = {
    'SENT': ['PREPARING'],
    'PREPARING': ['READY'],
    'READY': ['SERVED'],
    'SERVED': [],
    'PENDING': []
  };

  if (!validTransitions[orderItem.status].includes(status)) {
    throw { status: 400, message: `Invalid status transition from ${orderItem.status} to ${status}` };
  }

  // Wrap item update + KOT status sync in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.orderItem.update({
      where: { id: itemId },
      data: { status },
    });

    // Synchronize parent KOT's status based on all its items
    const allItems = await tx.orderItem.findMany({
      where: { kotId: orderItem.kotId }
    });

    let newKotStatus = null;
    const activeItems = allItems.filter(i => i.status !== 'CANCELLED');
    if (activeItems.length > 0) {
      if (activeItems.every(i => i.status === 'SERVED')) {
        newKotStatus = 'COMPLETED';
        await tx.kOT.update({
          where: { id: orderItem.kotId },
          data: { status: 'COMPLETED' }
        });
      } else if (activeItems.every(i => i.status === 'READY' || i.status === 'SERVED')) {
        newKotStatus = 'READY';
        await tx.kOT.update({
          where: { id: orderItem.kotId },
          data: { status: 'READY' }
        });
      } else if (activeItems.some(i => i.status === 'PREPARING')) {
        newKotStatus = 'PREPARING';
        await tx.kOT.update({
          where: { id: orderItem.kotId },
          data: { status: 'PREPARING' }
        });
      }
    }

    return { updatedItem, newKotStatus };
  });

  emitKotUpdated({ itemId, status, kotId: orderItem.kotId, kotStatus: result.newKotStatus });
  return result.updatedItem;
};

export const editItemQuantity = async (orderItemId, newQuantity, reason, userId) => {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true },
  });
  if (!orderItem) throw { status: 404, message: 'Order item not found' };
  if (orderItem.status === 'CANCELLED') throw { status: 400, message: 'Cannot edit cancelled item' };
  if (orderItem.status === 'SERVED') throw { status: 400, message: 'Cannot edit served item' };
  if (newQuantity < 1) throw { status: 400, message: 'Quantity must be at least 1' };

  const oldQuantity = orderItem.quantity;
  if (oldQuantity === newQuantity) return orderItem;

  const result = await prisma.$transaction(async (tx) => {
    await tx.orderItemHistory.create({
      data: {
        orderItemId,
        changeType: 'EDITED',
        oldQuantity,
        newQuantity,
        reason: reason || `Quantity changed from ${oldQuantity} to ${newQuantity}`,
        changedBy: userId,
      },
    });

    const updated = await tx.orderItem.update({
      where: { id: orderItemId },
      data: {
        quantity: newQuantity,
        originalQuantity: orderItem.originalQuantity || oldQuantity,
      },
    });

    return updated;
  });

  emitKotUpdated({ itemId: orderItemId, quantity: newQuantity, kotId: orderItem.kotId });
  return result;
};

export const cancelItem = async (orderItemId, reason, userId) => {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true },
  });
  if (!orderItem) throw { status: 404, message: 'Order item not found' };
  if (orderItem.status === 'CANCELLED') throw { status: 400, message: 'Item already cancelled' };
  if (orderItem.status === 'SERVED') throw { status: 400, message: 'Cannot cancel served item' };

  const result = await prisma.$transaction(async (tx) => {

    await tx.orderItemHistory.create({
      data: {
        orderItemId,
        changeType: 'CANCELLED',
        oldQuantity: orderItem.quantity,
        newQuantity: 0,
        reason: reason || 'Item cancelled',
        changedBy: userId,
      },
    });

    const updated = await tx.orderItem.update({
      where: { id: orderItemId },
      data: { status: 'CANCELLED', originalQuantity: orderItem.originalQuantity || orderItem.quantity },
    });

    let newKotStatus = null;
    if (orderItem.kotId) {
      const allItems = await tx.orderItem.findMany({
        where: { kotId: orderItem.kotId }
      });
      const activeItems = allItems.filter(i => i.status !== 'CANCELLED');
      if (activeItems.length === 0 || activeItems.every(i => i.status === 'SERVED')) {
        newKotStatus = 'COMPLETED';
        await tx.kOT.update({
          where: { id: orderItem.kotId },
          data: { status: 'COMPLETED' }
        });
      }
    }

    return { updated, newKotStatus };
  });

  emitKotUpdated({ itemId: orderItemId, status: 'CANCELLED', kotId: orderItem.kotId, kotStatus: result.newKotStatus });
  return result.updated;
};
