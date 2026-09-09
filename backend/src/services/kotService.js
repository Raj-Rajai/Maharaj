import prisma from '../utils/prisma.js';

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

  return getById(kot.id);
};

export const getAll = async (filters) => {
  const { status, startDate, endDate } = filters || {};
  const where = {};

  if (status) where.status = status;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  } else if (!status) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.OR = [
      { status: { in: ['NEW', 'PREPARING', 'READY'] } },
      { createdAt: { gte: today } }
    ];
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.createdAt = { gte: today };
  }

  return prisma.kOT.findMany({
    where,
    include: {
      items: true,
      order: {
        include: { table: true },
      },
      session: {
        include: { table: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getById = async (id) => {
  const kot = await prisma.kOT.findUnique({
    where: { id },
    include: {
      items: {
        include: { menuItem: true },
      },
      order: {
        include: { table: true },
      },
      session: {
        include: { table: true },
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
  return prisma.$transaction(async (tx) => {
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

  return prisma.$transaction(async (tx) => {

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
};

export const cancelItem = async (orderItemId, reason, userId) => {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true },
  });
  if (!orderItem) throw { status: 404, message: 'Order item not found' };
  if (orderItem.status === 'CANCELLED') throw { status: 400, message: 'Item already cancelled' };
  if (orderItem.status === 'SERVED') throw { status: 400, message: 'Cannot cancel served item' };

  return prisma.$transaction(async (tx) => {

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
};
