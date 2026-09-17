import prisma, { rawQuery } from '../utils/prisma.js';
import { settingsCache } from '../utils/cache.js';
import { emitKotCreated, emitBillCreated, emitOrderUpdated } from '../utils/socket.js';

const getSettings = async () => {
  const cached = settingsCache.get();
  if (cached) return cached;

  const settings = await prisma.settings.findFirst();
  const result = settings || {
    restaurantName: 'Maharaj Veg Villa',
    address: '',
    phone: '',
    gstin: '',
    sgstPercent: 2.5,
    cgstPercent: 2.5,
  };
  settingsCache.set(result);
  return result;
};

const MENU_TYPE_MAP = {
  DINE_IN_AC: 'AC',
  DINE_IN_NON_AC: 'NON_AC',
  SELF_PICKUP: 'NON_AC',
  SWIGGY: 'SWIGGY',
  ZOMATO: 'ZOMATO',
};

export const create = async (sessionOrData, captainId) => {
  const sessionId = typeof sessionOrData === 'string' ? sessionOrData : sessionOrData?.sessionId;
  const tableId = typeof sessionOrData === 'object' ? sessionOrData?.tableId : null;
  const items = typeof sessionOrData === 'object' ? sessionOrData?.items : null;
  const generateKot = typeof sessionOrData === 'object' && sessionOrData?.generateKot !== undefined
    ? sessionOrData.generateKot
    : true;

  // If items are provided, route through consolidated atomic order + KOT creation
  if (items && Array.isArray(items) && items.length > 0) {
    return sendKotOrder({ sessionId, tableId, items, generateKot }, captainId);
  }

  // Otherwise, create an empty order for the session (backward compatibility)
  let session = null;
  if (sessionId) {
    session = await prisma.tableSession.findUnique({
      where: { id: sessionId },
      include: { table: true },
    });
  } else if (tableId) {
    session = await prisma.tableSession.findFirst({
      where: { tableId, status: 'OPEN' },
      include: { table: true },
    });
  }

  if (!session) {
    throw { status: 404, message: 'Active session not found' };
  }
  if (session.status !== 'OPEN') {
    throw { status: 400, message: 'Session is not open' };
  }

  const existingOrder = await prisma.order.findFirst({
    where: { sessionId: session.id, status: 'ACTIVE' },
  });
  if (existingOrder) {
    throw { status: 400, message: 'Active order already exists for this session' };
  }

  const orderSource = session.table?.type === 'AC' ? 'DINE_IN_AC' : 'DINE_IN_NON_AC';

  return prisma.order.create({
    data: {
      sessionId: session.id,
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

  const settings = await getSettings();
  const sgstPercent = Number(Number(settings.sgstPercent ?? 2.5).toFixed(3));
  const cgstPercent = Number(Number(settings.cgstPercent ?? 2.5).toFixed(3));

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

  const result = await prisma.$transaction(async (tx) => {

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

  if (result.kot) emitKotCreated(result.kot);
  if (result.bill) emitBillCreated(result.bill);
  if (result.order) emitOrderUpdated(result.order);

  return result;
};

export const getAll = async (filters) => {
  const { sessionId, tableId, status, orderSource, startDate, endDate, from, to, limit, take, page } = filters || {};
  
  const params = [];
  const conditions = [];

  if (sessionId) {
    params.push(sessionId);
    conditions.push('o.sessionId = ?');
  }
  if (tableId) {
    params.push(tableId);
    conditions.push('o.tableId = ?');
  }
  if (status && status !== 'ALL') {
    params.push(status);
    conditions.push('o.status = ?');
  }
  if (orderSource && orderSource !== 'ALL') {
    params.push(orderSource);
    conditions.push('o.orderSource = ?');
  }

  // Support date range filtering
  const startParam = startDate || from;
  const endParam = endDate || to;
  if (startParam) {
    const s = new Date(startParam);
    s.setHours(0, 0, 0, 0);
    params.push(s);
    conditions.push('o.createdAt >= ?');
  }
  if (endParam) {
    const e = new Date(endParam);
    e.setHours(23, 59, 59, 999);
    params.push(e);
    conditions.push('o.createdAt <= ?');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const limitParam = limit || take;
  let limitValue = null;
  if (limitParam) {
    limitValue = Number(limitParam);
  } else if (!sessionId && !tableId && !status) {
    // If unbounded query without specific session/table/status, cap to recent 100
    limitValue = 100;
  }

  let offsetValue = 0;
  if (page && limitParam) {
    offsetValue = (Number(page) - 1) * Number(limitParam);
  }

  const limitClause = limitValue !== null ? `LIMIT ${limitValue}` : '';
  const offsetClause = offsetValue > 0 ? `OFFSET ${offsetValue}` : '';

  const sql = `
    SELECT o.id, o.orderSource, o.sessionId, o.tableId, o.captainId, o.status, o.createdAt, o.updatedAt,
           t.id as table_id, t.number as table_number, t.type as table_type, t.status as table_status,
           bi.id as bill_id, bi.billNumber as bill_number, bi.total as bill_total, bi.status as bill_status,
           u.id as captain_id, u.name as captain_name, u.role as captain_role
    FROM \`Order\` o
    LEFT JOIN \`Table\` t ON t.id = o.tableId
    LEFT JOIN \`Bill\` bi ON bi.orderId = o.id
    LEFT JOIN \`User\` u ON u.id = o.captainId
    ${whereClause}
    ORDER BY o.createdAt DESC
    ${limitClause}
    ${offsetClause}
  `;

  const orders = await rawQuery(sql, ...params);

  if (!orders || orders.length === 0) return [];

  const orderIds = orders.map(o => o.id);
  const itemsPlaceholders = orderIds.map(() => '?').join(', ');

  const itemsSql = `
    SELECT id, orderId, itemNameSnapshot, priceSnapshot, quantity, originalQuantity, status, notes, menuItemId, kotId, createdAt
    FROM \`OrderItem\`
    WHERE orderId IN (${itemsPlaceholders})
  `;
  const items = await rawQuery(itemsSql, ...orderIds);

  const itemsByOrderId = {};
  for (const item of items) {
    if (!itemsByOrderId[item.orderId]) {
      itemsByOrderId[item.orderId] = [];
    }
    itemsByOrderId[item.orderId].push(item);
  }

  return orders.map(row => ({
    id: row.id,
    orderSource: row.orderSource,
    sessionId: row.sessionId,
    tableId: row.tableId,
    captainId: row.captainId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    table: row.table_id ? { id: row.table_id, number: row.table_number, type: row.table_type, status: row.table_status } : null,
    bill: row.bill_id ? { id: row.bill_id, billNumber: row.bill_number, total: row.bill_total, status: row.bill_status } : null,
    captain: row.captain_id ? { id: row.captain_id, name: row.captain_name, role: row.captain_role } : null,
    items: itemsByOrderId[row.id] || [],
  }));
};

export const getById = async (id) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { menuItem: true },
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

export const addItems = async (orderId, items, generateKot = true, captainId = null) => {
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
  }

  // If generateKot is true (default), atomically create KOT and mark items as SENT
  if (generateKot) {
    const result = await prisma.$transaction(async (tx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = await tx.kOT.count({
        where: { createdAt: { gte: today } },
      });
      const kotNumber = count + 1;

      const newKot = await tx.kOT.create({
        data: {
          kotNumber,
          orderId: order.id,
          sessionId: order.sessionId || null,
          captainId: captainId || order.captainId,
          status: 'NEW',
        },
      });

      const orderItemsData = items.map((item) => {
        const menuItem = menuItemMap.get(item.menuItemId);
        const qty = parseInt(item.quantity, 10) || 1;
        return {
          orderId,
          menuItemId: item.menuItemId,
          itemNameSnapshot: menuItem.name,
          priceSnapshot: menuItem.price,
          quantity: qty,
          originalQuantity: qty,
          notes: item.notes || null,
          kotId: newKot.id,
          status: 'SENT',
        };
      });

      await tx.orderItem.createMany({
        data: orderItemsData,
      });

      const fullOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: { include: { menuItem: true } },
          kots: true,
          bill: true,
          table: true,
          captain: { select: { id: true, name: true, role: true } },
        },
      });

      return {
        order: fullOrder,
        kot: newKot,
        itemsCount: orderItemsData.length,
      };
    });

    if (result.kot) emitKotCreated(result.kot);
    if (result.order) emitOrderUpdated(result.order);
    return result;
  }

  // If generateKot is false, insert items as PENDING (legacy behavior)
  const orderItemsData = items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId);
    const qty = parseInt(item.quantity, 10) || 1;
    return {
      orderId,
      menuItemId: item.menuItemId,
      itemNameSnapshot: menuItem.name,
      priceSnapshot: menuItem.price,
      quantity: qty,
      originalQuantity: qty,
      notes: item.notes || null,
      status: 'PENDING',
    };
  });

  await prisma.orderItem.createMany({
    data: orderItemsData,
  });

  const updatedOrder = await getById(orderId);
  emitOrderUpdated(updatedOrder);
  return updatedOrder;
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

  const cancelled = await prisma.order.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  emitOrderUpdated(cancelled);
  return cancelled;
};

export const sendKotOrder = async (data, captainId) => {
  const { sessionId, tableId, items, generateKot = true, customerNotes } = data;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: 'At least one item is required' };
  }
  if (!sessionId && !tableId) {
    throw { status: 400, message: 'Session ID or Table ID is required' };
  }

  // Batch fetch all menu items in one query
  const menuItemIds = items.map((i) => i.menuItemId);
  const dbMenuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
  });
  const menuItemMap = new Map(dbMenuItems.map((m) => [m.id, m]));

  for (const it of items) {
    const m = menuItemMap.get(it.menuItemId);
    if (!m) throw { status: 404, message: `Menu item not found: ${it.menuItemId}` };
    if (!m.active) throw { status: 400, message: `Menu item inactive: ${m.name}` };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Resolve session & table
    let session = null;
    if (sessionId) {
      session = await tx.tableSession.findUnique({
        where: { id: sessionId },
        include: { table: true },
      });
    } else if (tableId) {
      session = await tx.tableSession.findFirst({
        where: { tableId, status: 'OPEN' },
        include: { table: true },
      });
    }

    if (!session) throw { status: 404, message: 'Active session not found' };
    if (session.status !== 'OPEN') throw { status: 400, message: 'Session is not open' };

    const resolvedTableId = session.tableId;
    const orderSource = session.table?.type === 'AC' ? 'DINE_IN_AC' : 'DINE_IN_NON_AC';

    // Find or create active order for this session
    let order = await tx.order.findFirst({
      where: { sessionId: session.id, status: 'ACTIVE' },
    });

    if (!order) {
      order = await tx.order.create({
        data: {
          sessionId: session.id,
          tableId: resolvedTableId,
          captainId,
          status: 'ACTIVE',
          orderSource,
        },
      });
    }

    let newKot = null;
    if (generateKot) {
      // Calculate kotNumber inside transaction
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = await tx.kOT.count({
        where: { createdAt: { gte: today } },
      });
      const kotNumber = count + 1;

      newKot = await tx.kOT.create({
        data: {
          kotNumber,
          orderId: order.id,
          sessionId: session.id,
          captainId,
          status: 'NEW',
        },
      });
    }

    // Create OrderItems directly linked to this KOT with status 'SENT' (or 'PENDING' if no KOT)
    const orderItemsData = items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);
      const qty = parseInt(item.quantity, 10) || 1;
      const finalNote = item.notes
        ? (customerNotes && !item.notes.includes(customerNotes) ? `${item.notes} (${customerNotes})` : item.notes)
        : (customerNotes || null);
      return {
        orderId: order.id,
        menuItemId: item.menuItemId,
        itemNameSnapshot: menuItem.name,
        priceSnapshot: menuItem.price,
        quantity: qty,
        originalQuantity: qty,
        notes: finalNote || null,
        kotId: newKot ? newKot.id : null,
        status: newKot ? 'SENT' : 'PENDING',
      };
    });

    await tx.orderItem.createMany({
      data: orderItemsData,
    });

    // Return the fresh full order with items, table, captain, and bill
    const fullOrder = await tx.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: { menuItem: true },
        },
        kots: true,
        bill: true,
        table: true,
        captain: { select: { id: true, name: true, role: true } },
      },
    });

    return {
      order: fullOrder,
      kot: newKot,
      itemsCount: orderItemsData.length,
    };
  });

  if (result.kot) {
    const enrichedKot = {
      ...result.kot,
      order: result.order,
      items: result.order?.items?.filter((i) => i.kotId === result.kot.id) || [],
      itemsCount: result.itemsCount,
    };
    emitKotCreated(enrichedKot);
  }
  if (result.order) emitOrderUpdated(result.order);

  return result;
};
