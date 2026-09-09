import prisma from '../utils/prisma.js';

export const getAll = async (filters = {}) => {
  const where = {};
  if (filters.platform) where.platform = filters.platform;
  if (filters.status) where.status = filters.status;
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
  }
  return prisma.onlineOrder.findMany({ where, orderBy: { createdAt: 'desc' } });
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
  await getById(id);
  // Only allow updating non-financial fields and status
  const { customerName, notes, status, paymentStatus } = data;
  const updateData = {};
  if (customerName !== undefined) updateData.customerName = customerName;
  if (notes !== undefined) updateData.notes = notes;
  if (status !== undefined) updateData.status = status;
  if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
  return prisma.onlineOrder.update({ where: { id }, data: updateData });
};

export const updateStatus = async (id, status) => {
  await getById(id);
  return prisma.onlineOrder.update({ where: { id }, data: { status } });
};
