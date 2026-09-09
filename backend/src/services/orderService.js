import prisma from '../utils/prisma.js';

const MENU_TYPE_MAP = {
  DINE_IN_AC: 'AC',
  DINE_IN_NON_AC: 'NON_AC',
  SELF_PICKUP: 'NON_AC',
  SWIGGY: 'SWIGGY',
  ZOMATO: 'ZOMATO',
};

export const create = async (sessionId, captainId) => {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: { table: true },
  });
  if (!session) {
    throw { status: 404, message: 'Session not found' };
  }
  if (session.status !== 'OPEN') {
    throw { status: 400, message: 'Session is not open' };
  }

  const existingOrder = await prisma.order.findFirst({
    where: { sessionId, status: 'ACTIVE' },
  });
  if (existingOrder) {
    throw { status: 400, message: 'Active order already exists for this session' };
  }

  const orderSource = session.table?.type === 'AC' ? 'DINE_IN_AC' : 'DINE_IN_NON_AC';

  return prisma.order.create({
    data: {
      sessionId,
      tableId: session.tableId,
      captainId,
      status: 'ACTIVE',
      orderSource,
    },
  });
};

export const createTakeAwayOrder = async (data, userId) => {
  const { orderSource, items, generateKot, customerNotes, customerName, customerPhone } = data;
  const captainId = data.captainId || userId;
  if (!captainId) {
    throw { status: 400, message: 'User ID (captainId) is required' };
  }
  const validSources = ['SELF_PICKUP', 'SWIGGY', 'ZOMATO'];
  if (!validSources.includes(orderSource)) {
    throw { status: 400, message: `Invalid take away order source: ${orderSource}` };
  }
  if (!items || items.length === 0) {
    throw { status: 400, message: 'At least one item is required' };
  }

  const expectedMenuType = MENU_TYPE_MAP[orderSource];

  // Batch fetch all menu items instead of N+1 queries
  const menuItemIds = items.map(i => i.menuItemId);
  const dbItemsList = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    include: { category: true },
  });

  // Build lookup map
  const dbItemMap = new Map(dbItemsList.map(m => [m.id, m]));

  // Validate all items
  const dbItems = [];
  for (const item of items) {
    const menuItem = dbItemMap.get(item.menuItemId);
    if (!menuItem) {
      throw { status: 404, message: `Menu item not found: ${item.menuItemId}` };
    }
    if (!menuItem.active) {
      throw { status: 400, message: `Menu item is inactive: ${menuItem.name}` };
    }
    if (menuItem.menuType !== expectedMenuType) {
      throw {
        status: 400,
        message: `Item "${menuItem.name}" belongs to ${menuItem.menuType} menu, but ${orderSource} requires ${expectedMenuType} menu`,
      };
    }
    dbItems.push(menuItem);
  }

  const settings = await prisma.settings.findFirst();
  const sgstPercent = settings ? Number(settings.sgstPercent) : 2.5;
  const cgstPercent = settings ? Number(settings.cgstPercent) : 2.5;

  // Calculate using DB prices — never trust client
  const subtotal = items.reduce(
    (sum, item, idx) => sum + (Number(dbItems[idx].price) * item.quantity),
    0
  );
  const taxableAmount = subtotal;
  const sgstAmount = taxableAmount * (sgstPercent / 100);
  const cgstAmount = taxableAmount * (cgstPercent / 100);
  const grandTotal = taxableAmount + sgstAmount + cgstAmount;
  const finalTotal = Math.round(grandTotal);
  const roundOff = Number((finalTotal - grandTotal).toFixed(2));

  return prisma.$transaction(async (tx) => {

    const newOrder = await tx.order.create({
      data: {
        orderSource,
        captainId,
        status: 'ACTIVE',
      },
    });

    const orderItemsData = items.map((item, idx) => ({
      orderId: newOrder.id,
      menuItemId: item.menuItemId,
      itemNameSnapshot: dbItems[idx].name,
      priceSnapshot: dbItems[idx].price, // DB price, not client price
      quantity: item.quantity,
      notes: item.notes || customerNotes || null,
      status: generateKot ? 'SENT' : 'PENDING',
    }));

    await tx.orderItem.createMany({
      data: orderItemsData,
    });

    let createdKot = null;
    if (generateKot) {
      // KOT number inside transaction to avoid race condition
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const count = await tx.kOT.count({
        where: { createdAt: { gte: today } },
      });
      const kotNumber = count + 1;

      createdKot = await tx.kOT.create({
        data: {
          kotNumber,
          orderId: newOrder.id,
          captainId,
          status: 'NEW',
        },
      });

      await tx.orderItem.updateMany({
        where: { orderId: newOrder.id },
        data: {
          kotId: createdKot.id,
          status: 'SENT',
        },
      });
    }

    // billNumber is autoincrement — do NOT pass it
    const createdBill = await tx.bill.create({
      data: {
        orderId: newOrder.id,
        customerName: customerName ? String(customerName).trim() : null,
        customerPhone: customerPhone ? String(customerPhone).trim() : null,
        subtotal,
        sgstPercent,
        cgstPercent,
        sgstAmount: Number(sgstAmount.toFixed(2)),
        cgstAmount: Number(cgstAmount.toFixed(2)),
        discount: 0,
        total: finalTotal,
        roundOff,
        status: 'DRAFT',
      },
    });

    const fullOrder = await tx.order.findUnique({
      where: { id: newOrder.id },
      include: {
        items: { include: { menuItem: true } },
        kots: true,
        bill: true,
        captain: { select: { id: true, name: true, role: true } },
      },
    });

    return {
      order: fullOrder,
      kot: createdKot ? { ...createdKot, orderSource: newOrder.orderSource, order: fullOrder } : null,
      bill: createdBill ? { ...createdBill, orderSource: newOrder.orderSource, order: fullOrder } : null,
    };
  });
};

export const getAll = async (filters) => {
  const { sessionId, tableId, status, orderSource } = filters || {};
  const where = {};
  if (sessionId) where.sessionId = sessionId;
  if (tableId) where.tableId = tableId;
  if (status) where.status = status;
  if (orderSource) where.orderSource = orderSource;

  return prisma.order.findMany({
    where,
    include: {
      items: true,
      table: true,
      bill: true,
      captain: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getById = async (id) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { menuItem: true, history: true },
      },
      kots: true,
      bill: true,
      table: true,
      captain: { select: { id: true, name: true, role: true } },
    },
  });

  if (!order) {
    throw { status: 404, message: 'Order not found' };
  }

  return order;
};

export const addItems = async (orderId, items) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw { status: 404, message: 'Order not found' };
  }
  if (order.status !== 'ACTIVE') {
    throw { status: 400, message: 'Can only add items to an active order' };
  }

  // Batch fetch all menu items — eliminates N+1 queries
  const menuItemIds = items.map(i => i.menuItemId);
  const dbMenuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });
  const menuItemMap = new Map(dbMenuItems.map(m => [m.id, m]));

  // Determine expected menu type based on order source
  const expectedMenuType = MENU_TYPE_MAP[order.orderSource];

  const orderItemsData = [];
  for (const item of items) {
    const menuItem = menuItemMap.get(item.menuItemId);

    if (!menuItem) {
      throw { status: 404, message: `Menu item not found: ${item.menuItemId}` };
    }
    if (!menuItem.active) {
      throw { status: 400, message: `Menu item not active: ${menuItem.name}` };
    }

    // Validate menuType matches order source
    if (expectedMenuType && menuItem.menuType !== expectedMenuType) {
      throw {
        status: 400,
        message: `Item "${menuItem.name}" belongs to ${menuItem.menuType} menu, but this order requires ${expectedMenuType} menu`,
      };
    }

    orderItemsData.push({
      orderId,
      menuItemId: item.menuItemId,
      itemNameSnapshot: menuItem.name,
      priceSnapshot: menuItem.price, // DB price, never client price
      quantity: item.quantity,
      notes: item.notes,
      status: 'PENDING',
    });
  }

  await prisma.orderItem.createMany({
    data: orderItemsData,
  });

  return getById(orderId);
};

export const cancel = async (id) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { bill: true },
  });

  if (!order) {
    throw { status: 404, message: 'Order not found' };
  }
  if (order.status !== 'ACTIVE') {
    throw { status: 400, message: 'Only active orders can be cancelled' };
  }
  if (order.bill && order.bill.status === 'FINALIZED') {
    throw { status: 400, message: 'Cannot cancel order with a finalized bill' };
  }

  return prisma.order.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
};
