import prisma from '../utils/prisma.js';
import { emitKotCreated, emitKotUpdated } from '../utils/socket.js';

export const create = async (orderId, captainId) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { where: { status: 'PENDING' } } },
  });

  if (!order) {
    throw { status: 404, message: 'Order not found' };
  }
  if (order.status !== 'ACTIVE') {
    throw { status: 400, message: 'Order must be active to generate KOT' };
  }
  if (order.items.length === 0) {
    throw { status: 400, message: 'No pending items to generate KOT' };
  }

  // kotNumber computed INSIDE transaction to prevent race conditions
  const kot = await prisma.$transaction(async (tx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await tx.kOT.count({
      where: { createdAt: { gte: today } },
    });
    const kotNumber = count + 1;

    const newKot = await tx.kOT.create({
      data: {
        kotNumber,
        orderId,
        sessionId: order.sessionId || null,
        captainId,
        status: 'NEW',
      },
    });

    await tx.orderItem.updateMany({
      where: {
        orderId,
        status: 'PENDING',
      },
      data: {
        kotId: newKot.id,
        status: 'SENT',
      },
    });

    return newKot;
  });

  const result = await getById(kot.id);
  emitKotCreated(result);
  return result;
};

export const getAll = async (filters) => {
  const { status, startDate, endDate } = filters || {};
  let whereClause = '';
  const params = [];
  let paramCount = 1;

  if (status) {
    whereClause += ` WHERE k.status = $${paramCount}::"KotStatus"`;
    params.push(status);
    paramCount++;
  }

  if (startDate || endDate) {
    if (startDate) {
      whereClause += whereClause ? ` AND ` : ` WHERE `;
      whereClause += `k."createdAt" >= $${paramCount}`;
      params.push(new Date(startDate));
      paramCount++;
    }
    if (endDate) {
      whereClause += whereClause ? ` AND ` : ` WHERE `;
      whereClause += `k."createdAt" <= $${paramCount}`;
      params.push(new Date(endDate));
      paramCount++;
    }
  } else if (!status) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    whereClause += ` WHERE k.status IN ('NEW', 'PREPARING', 'READY') OR k."createdAt" >= $${paramCount}`;
    params.push(today);
    paramCount++;
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    whereClause += whereClause ? ` AND ` : ` WHERE `;
    whereClause += `k."createdAt" >= $${paramCount}`;
    params.push(today);
    paramCount++;
  }

  const sql = `
    SELECT k.id, k."kotNumber", k."orderId", k."sessionId", k."captainId", k.status, k."createdAt",
           o.id as "order_id", o."orderSource", o."tableId",
           t.id as "table_id", t.number as "table_number", t.type as "table_type",
           COALESCE(json_agg(
             json_build_object(
               'id', oi.id, 'orderId', oi."orderId", 'menuItemId', oi."menuItemId",
               'itemNameSnapshot', oi."itemNameSnapshot", 'priceSnapshot', oi."priceSnapshot",
               'quantity', oi.quantity, 'originalQuantity', oi."originalQuantity",
               'status', oi.status, 'notes', oi.notes, 'kotId', oi."kotId",
               'createdAt', oi."createdAt"
             )
           ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
    FROM "KOT" k
    LEFT JOIN "Order" o ON o.id = k."orderId"
    LEFT JOIN "Table" t ON t.id = o."tableId"
    LEFT JOIN "OrderItem" oi ON oi."kotId" = k.id
    ${whereClause}
    GROUP BY k.id, o.id, o."orderSource", o."tableId", t.id, t.number, t.type
    ORDER BY k."createdAt" DESC
  `;

  const rows = await prisma.$queryRawUnsafe(sql, ...params);

  return rows.map(row => ({
    id: row.id,
    kotNumber: row.kotNumber,
    orderId: row.orderId,
    sessionId: row.sessionId,
    captainId: row.captainId,
    status: row.status,
    createdAt: row.createdAt,
    items: row.items,
    order: {
      id: row.order_id,
      orderSource: row.orderSource,
      tableId: row.tableId,
      table: row.order_id ? { id: row.table_id, number: row.table_number, type: row.table_type } : null
    }
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

  return prisma.kOT.update({
    where: { id },
    data: { status },
  });
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

    const activeItems = allItems.filter(i => i.status !== 'CANCELLED');
    if (activeItems.length > 0) {
      if (activeItems.every(i => i.status === 'SERVED')) {
        await tx.kOT.update({
          where: { id: orderItem.kotId },
          data: { status: 'COMPLETED' }
        });
      } else if (activeItems.every(i => i.status === 'READY' || i.status === 'SERVED')) {
        await tx.kOT.update({
          where: { id: orderItem.kotId },
          data: { status: 'READY' }
        });
      } else if (activeItems.some(i => i.status === 'PREPARING')) {
        await tx.kOT.update({
          where: { id: orderItem.kotId },
          data: { status: 'PREPARING' }
        });
      }
    }

    return updatedItem;
  });

  emitKotUpdated({ itemId, status, kotId: orderItem.kotId });
  return result;
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

    if (orderItem.kotId) {
      const allItems = await tx.orderItem.findMany({
        where: { kotId: orderItem.kotId }
      });
      const activeItems = allItems.filter(i => i.status !== 'CANCELLED');
      if (activeItems.length === 0 || activeItems.every(i => i.status === 'SERVED')) {
        await tx.kOT.update({
          where: { id: orderItem.kotId },
          data: { status: 'COMPLETED' }
        });
      }
    }

    return updated;
  });

  emitKotUpdated({ itemId: orderItemId, status: 'CANCELLED', kotId: orderItem.kotId });
  return result;
};
