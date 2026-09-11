import prisma from '../utils/prisma.js';

export const getAll = async (filters = {}) => {
  const { platform, status, startDate, endDate, from, to, limit, take, page, all } = filters || {};
  const where = {};
  if (platform && platform !== 'ALL') where.platform = platform;
  if (status && status !== 'ALL') where.status = status;

  const startParam = startDate || from;
  const endParam = endDate || to;
  if (startParam || endParam) {
    where.createdAt = {};
    if (startParam) {
      const s = new Date(startParam);
      s.setHours(0, 0, 0, 0);
      where.createdAt.gte = s;
    }
    if (endParam) {
      const e = new Date(endParam);
      e.setHours(23, 59, 59, 999);
      where.createdAt.lte = e;
    }
  }

  const queryOptions = {
    where,
    orderBy: { createdAt: 'desc' },
  };

  const limitParam = limit || take;
  if (limitParam) {
    queryOptions.take = Number(limitParam);
  } else if (all !== true && all !== 'true') {
    // Default safe bound to prevent unbounded historical memory spikes
    queryOptions.take = 100;
  }

  if (page && limitParam) {
    queryOptions.skip = (Number(page) - 1) * Number(limitParam);
  }

  return prisma.onlineOrder.findMany(queryOptions);
};

export const getById = async (id) => {
  const order = await prisma.onlineOrder.findUnique({ where: { id } });
  if (!order) throw { status: 404, message: 'Online order not found' };
  return order;
};

export const create = async (data) => {
  // Validate items and calculate prices from DB — never trust client prices
  const { platform, externalOrderId, customerName, items, notes } = data;

  if (!platform || !['SWIGGY', 'ZOMATO'].includes(platform)) {
    throw { status: 400, message: 'Platform must be SWIGGY or ZOMATO' };
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: 'At least one item is required' };
  }

  // Determine expected menu type based on platform
  const expectedMenuType = platform; // SWIGGY or ZOMATO

  // If items have menuItemId, validate against DB prices
  const hasMenuItemIds = items.some(i => i.menuItemId);

  let subtotal = 0;
  let validatedItems = items;

  if (hasMenuItemIds) {
    const menuItemIds = items.filter(i => i.menuItemId).map(i => i.menuItemId);
    const dbItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });
    const dbMap = new Map(dbItems.map(m => [m.id, m]));

    validatedItems = items.map(item => {
      if (item.menuItemId) {
        const dbItem = dbMap.get(item.menuItemId);
        if (!dbItem) throw { status: 404, message: `Menu item not found: ${item.menuItemId}` };
        if (!dbItem.active) throw { status: 400, message: `Menu item inactive: ${dbItem.name}` };
        if (dbItem.menuType !== expectedMenuType) {
          throw { status: 400, message: `Item "${dbItem.name}" is ${dbItem.menuType} menu, not ${expectedMenuType}` };
        }
        const qty = item.quantity || 1;
        const price = Number(dbItem.price); // DB price, not client price
        subtotal += qty * price;
        return { name: dbItem.name, quantity: qty, price, total: qty * price };
      }
      // Items without menuItemId (manual entry) — use provided data
      const qty = item.quantity || 1;
      const price = Number(item.price || 0);
      subtotal += qty * price;
      return { name: item.name, quantity: qty, price, total: qty * price };
    });
  } else {
    // No menuItemIds — manual entry, compute from provided data
    subtotal = items.reduce((sum, i) => sum + (Number(i.price || 0) * (i.quantity || 1)), 0);
  }

  const discount = Number(data.discount || 0);
  const charges = Number(data.charges || 0);
  const total = subtotal - discount + charges;

  return prisma.onlineOrder.create({
    data: {
      platform,
      externalOrderId: externalOrderId || `${platform}-${Date.now()}`,
      customerName: customerName || null,
      items: validatedItems,
      subtotal,
      discount,
      charges,
      total,
      paymentStatus: data.paymentStatus || 'PAID',
      status: data.status || 'NEW',
      notes: notes || null,
    },
  });
};

export const update = async (id, data) => {
  // Only allow updating non-financial fields and status
  const { customerName, notes, status, paymentStatus } = data;
  const updateData = {};
  if (customerName !== undefined) updateData.customerName = customerName;
  if (notes !== undefined) updateData.notes = notes;
  if (status !== undefined) updateData.status = status;
  if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
  try {
    return await prisma.onlineOrder.update({ where: { id }, data: updateData });
  } catch (error) {
    if (error.code === 'P2025') throw { status: 404, message: 'Online order not found' };
    throw error;
  }
};

export const updateStatus = async (id, status) => {
  try {
    return await prisma.onlineOrder.update({ where: { id }, data: { status } });
  } catch (error) {
    if (error.code === 'P2025') throw { status: 404, message: 'Online order not found' };
    throw error;
  }
};
