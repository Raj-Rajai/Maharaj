import prisma, { rawQuery } from '../utils/prisma.js';
import { settingsCache } from '../utils/cache.js';

const getDateRangeFilter = (startDate, endDate) => {
  const filter = {};
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.createdAt.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.lte = end;
    }
  } else {

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { gte: start, lte: end };
  }
  return filter;
};

export const salesSummary = async (startDate, endDate) => {
  const dateFilter = getDateRangeFilter(startDate, endDate);

  const [bills, onlineOrders] = await Promise.all([
    prisma.bill.findMany({
      where: { status: 'FINALIZED', ...dateFilter },
      select: {
        orderId: true,
        total: true,
        sgstAmount: true,
        cgstAmount: true,
        createdAt: true,
        order: {
          select: {
            orderSource: true,
            table: { select: { type: true } },
          }
        },
        session: {
          select: {
            table: { select: { type: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.onlineOrder.findMany({
      where: { status: 'COMPLETED', ...dateFilter },
      select: { platform: true, total: true }
    })
  ]);

  let acSales = 0;
  let nonAcSales = 0;
  let selfPickupSales = 0;
  let swiggyRevenue = 0;
  let zomatoRevenue = 0;

  bills.forEach(b => {
    const total = Number(b.total);
    const source = b.order?.orderSource;

    if (source === 'DINE_IN_AC') {
      acSales += total;
    } else if (source === 'DINE_IN_NON_AC') {
      nonAcSales += total;
    } else if (source === 'SELF_PICKUP') {
      selfPickupSales += total;
    } else if (source === 'SWIGGY') {
      swiggyRevenue += total;
    } else if (source === 'ZOMATO') {
      zomatoRevenue += total;
    } else {
      if (b.session?.table?.type === 'AC' || b.order?.table?.type === 'AC') {
        acSales += total;
      } else {
        nonAcSales += total;
      }
    }
  });

  onlineOrders.forEach(order => {
    if (order.platform === 'SWIGGY') swiggyRevenue += Number(order.total);
    if (order.platform === 'ZOMATO') zomatoRevenue += Number(order.total);
  });

  const dineInRevenue = acSales + nonAcSales;
  const takeAwayRevenue = selfPickupSales + swiggyRevenue + zomatoRevenue;
  const onlineRevenue = takeAwayRevenue;

  const taxCollected = bills.reduce((sum, b) => sum + Number(b.sgstAmount) + Number(b.cgstAmount), 0);

  const totalRevenue = dineInRevenue + takeAwayRevenue;
  const totalOrders = bills.length + onlineOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const pad = (n) => String(n).padStart(2, '0');
  const isSingleDay = Boolean(startDate && endDate && startDate === endDate);
  let timeline = [];

  if (isSingleDay) {
    const hourMap = {};
    for (let h = 8; h <= 23; h++) {
      const key = `${pad(h)}:00`;
      hourMap[key] = {
        label: key,
        time: key,
        acSales: 0,
        nonAcSales: 0,
        selfPickupSales: 0,
        swiggyRevenue: 0,
        zomatoRevenue: 0,
        dineIn: 0,
        takeAway: 0,
        total: 0,
        orders: 0
      };
    }

    bills.forEach(b => {
      const d = new Date(b.createdAt);
      const h = `${pad(d.getHours())}:00`;
      if (!hourMap[h]) {
        hourMap[h] = {
          label: h,
          time: h,
          acSales: 0,
          nonAcSales: 0,
          selfPickupSales: 0,
          swiggyRevenue: 0,
          zomatoRevenue: 0,
          dineIn: 0,
          takeAway: 0,
          total: 0,
          orders: 0
        };
      }
      const total = Number(b.total);
      const source = b.order?.orderSource;
      hourMap[h].orders += 1;
      hourMap[h].total += total;

      if (source === 'DINE_IN_AC') {
        hourMap[h].acSales += total;
        hourMap[h].dineIn += total;
      } else if (source === 'DINE_IN_NON_AC') {
        hourMap[h].nonAcSales += total;
        hourMap[h].dineIn += total;
      } else if (source === 'SELF_PICKUP') {
        hourMap[h].selfPickupSales += total;
        hourMap[h].takeAway += total;
      } else if (source === 'SWIGGY') {
        hourMap[h].swiggyRevenue += total;
        hourMap[h].takeAway += total;
      } else if (source === 'ZOMATO') {
        hourMap[h].zomatoRevenue += total;
        hourMap[h].takeAway += total;
      } else {
        if (b.session?.table?.type === 'AC' || b.order?.table?.type === 'AC') {
          hourMap[h].acSales += total;
          hourMap[h].dineIn += total;
        } else {
          hourMap[h].nonAcSales += total;
          hourMap[h].dineIn += total;
        }
      }
    });

    timeline = Object.keys(hourMap).sort().map(k => hourMap[k]);
  } else {
    const dateMap = {};
    const s = startDate ? new Date(startDate) : new Date(Date.now() - 6 * 86400000);
    const e = endDate ? new Date(endDate) : new Date();
    const cur = new Date(s);
    while (cur <= e) {
      const key = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      const dayName = cur.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      dateMap[key] = {
        date: key,
        label: dayName,
        acSales: 0,
        nonAcSales: 0,
        selfPickupSales: 0,
        swiggyRevenue: 0,
        zomatoRevenue: 0,
        dineIn: 0,
        takeAway: 0,
        total: 0,
        orders: 0
      };
      cur.setDate(cur.getDate() + 1);
    }

    bills.forEach(b => {
      const d = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (!dateMap[key]) {
        const dayName = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        dateMap[key] = {
          date: key,
          label: dayName,
          acSales: 0,
          nonAcSales: 0,
          selfPickupSales: 0,
          swiggyRevenue: 0,
          zomatoRevenue: 0,
          dineIn: 0,
          takeAway: 0,
          total: 0,
          orders: 0
        };
      }
      const total = Number(b.total);
      const source = b.order?.orderSource;
      dateMap[key].orders += 1;
      dateMap[key].total += total;

      if (source === 'DINE_IN_AC') {
        dateMap[key].acSales += total;
        dateMap[key].dineIn += total;
      } else if (source === 'DINE_IN_NON_AC') {
        dateMap[key].nonAcSales += total;
        dateMap[key].dineIn += total;
      } else if (source === 'SELF_PICKUP') {
        dateMap[key].selfPickupSales += total;
        dateMap[key].takeAway += total;
      } else if (source === 'SWIGGY') {
        dateMap[key].swiggyRevenue += total;
        dateMap[key].takeAway += total;
      } else if (source === 'ZOMATO') {
        dateMap[key].zomatoRevenue += total;
        dateMap[key].takeAway += total;
      } else {
        if (b.session?.table?.type === 'AC' || b.order?.table?.type === 'AC') {
          dateMap[key].acSales += total;
          dateMap[key].dineIn += total;
        } else {
          dateMap[key].nonAcSales += total;
          dateMap[key].dineIn += total;
        }
      }
    });

    timeline = Object.keys(dateMap).sort().map(k => dateMap[k]);
  }

  const orderIds = bills.map(b => b.orderId).filter(Boolean);
  const orderItems = orderIds.length > 0 ? await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      status: { not: 'CANCELLED' }
    },
    select: {
      itemNameSnapshot: true,
      priceSnapshot: true,
      quantity: true,
      menuItem: {
        select: {
          name: true,
          price: true,
          category: { select: { name: true } }
        }
      }
    }
  }) : [];

  const itemMap = {};
  const catMap = {};
  orderItems.forEach(it => {
    const name = it.itemNameSnapshot || it.menuItem?.name || 'Unknown Item';
    const category = it.menuItem?.category?.name || 'Other';
    const qty = Number(it.quantity || 1);
    const price = Number(it.priceSnapshot || it.menuItem?.price || 0);
    const revenue = qty * price;

    if (!itemMap[name]) {
      itemMap[name] = { name, category, quantity: 0, revenue: 0 };
    }
    itemMap[name].quantity += qty;
    itemMap[name].revenue += revenue;

    if (!catMap[category]) {
      catMap[category] = { name: category, revenue: 0, quantity: 0 };
    }
    catMap[category].quantity += qty;
    catMap[category].revenue += revenue;
  });

  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 100);
  const categorySales = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);

  const settings = settingsCache.get() || await prisma.settings.findFirst();
  let purchaseCost = 0;
  let netSalesAfterPurchases = totalRevenue;

  if (settings?.includePurchasesInReports) {
    const purchaseDateFilter = {};
    if (startDate || endDate) {
      purchaseDateFilter.purchaseDate = {};
      if (startDate) {
        const s = new Date(startDate); s.setHours(0, 0, 0, 0);
        purchaseDateFilter.purchaseDate.gte = s;
      }
      if (endDate) {
        const e = new Date(endDate); e.setHours(23, 59, 59, 999);
        purchaseDateFilter.purchaseDate.lte = e;
      }
    } else {
      const s = new Date(); s.setHours(0, 0, 0, 0);
      const e = new Date(); e.setHours(23, 59, 59, 999);
      purchaseDateFilter.purchaseDate = { gte: s, lte: e };
    }

    const purchaseAgg = await prisma.purchaseEntry.aggregate({
      where: { status: 'ACTIVE', ...purchaseDateFilter },
      _sum: { totalAmount: true }
    });
    purchaseCost = Number(purchaseAgg._sum.totalAmount || 0);
    netSalesAfterPurchases = totalRevenue - purchaseCost;
  }

  return {
    totalRevenue,
    dineInRevenue,
    acSales,
    nonAcSales,
    takeAwayRevenue,
    selfPickupSales,
    swiggyRevenue,
    zomatoRevenue,
    onlineRevenue,
    totalOrders,
    avgOrderValue,
    taxCollected,
    purchaseCost,
    netSalesAfterPurchases,
    includePurchasesInReports: !!settings?.includePurchasesInReports,
    timeline,
    topItems,
    categorySales
  };
};

export const orderSummary = async (startDate, endDate) => {
  const dateFilter = getDateRangeFilter(startDate, endDate);

  const [allOrders, onlineOrders] = await Promise.all([
    prisma.order.findMany({
      where: { ...dateFilter },
      select: {
        orderSource: true,
        status: true,
        sessionId: true,
      },
    }),
    prisma.onlineOrder.findMany({
      where: { ...dateFilter },
      select: {
        platform: true,
        status: true,
      },
    }),
  ]);

  const dineInOrders = allOrders.filter(
    o => o.orderSource === 'DINE_IN_AC' || o.orderSource === 'DINE_IN_NON_AC' || (o.sessionId && !['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(o.orderSource))
  );

  const takeAwayOrders = allOrders.filter(
    o => ['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(o.orderSource)
  );

  const dineInByStatus = dineInOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const takeAwayByStatus = takeAwayOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  onlineOrders.forEach(order => {
    takeAwayByStatus[order.status] = (takeAwayByStatus[order.status] || 0) + 1;
  });

  const selfPickupCount = takeAwayOrders.filter(o => o.orderSource === 'SELF_PICKUP').length;
  const swiggyCount = takeAwayOrders.filter(o => o.orderSource === 'SWIGGY').length + onlineOrders.filter(o => o.platform === 'SWIGGY').length;
  const zomatoCount = takeAwayOrders.filter(o => o.orderSource === 'ZOMATO').length + onlineOrders.filter(o => o.platform === 'ZOMATO').length;

  return {
    dineIn: {
      total: dineInOrders.length,
      byStatus: dineInByStatus
    },
    takeAway: {
      total: takeAwayOrders.length + onlineOrders.length,
      byStatus: takeAwayByStatus,
      selfPickup: selfPickupCount,
      swiggy: swiggyCount,
      zomato: zomatoCount,
    },
    online: {
      total: takeAwayOrders.length + onlineOrders.length,
      byStatus: takeAwayByStatus
    }
  };
};

export const paymentBreakdown = async (startDate, endDate) => {
  const dateFilter = getDateRangeFilter(startDate, endDate);

  const bills = await prisma.bill.findMany({
    where: { status: 'FINALIZED', ...dateFilter },
    select: {
      total: true,
      payment: { select: { method: true } },
    },
  });

  const breakdown = {};
  for (const bill of bills) {
    const method = bill.payment?.method || 'UNKNOWN';
    if (!breakdown[method]) breakdown[method] = { total: 0, count: 0 };
    breakdown[method].total += Number(bill.total);
    breakdown[method].count += 1;
  }
  return breakdown;
};

export const tableSummary = async (startDate, endDate) => {
  const dateFilter = getDateRangeFilter(startDate, endDate);

  const bills = await prisma.bill.findMany({
    where: { status: 'FINALIZED', ...dateFilter },
    select: {
      total: true,
      order: {
        select: {
          table: { select: { id: true, number: true, type: true } },
        },
      },
      session: {
        select: {
          table: { select: { id: true, number: true, type: true } },
        },
      },
    },
  });

  const summary = bills.reduce((acc, bill) => {
    const table = bill.session?.table || bill.order?.table;
    if (!table) return acc;

    const tableNo = table.number;
    if (!acc[tableNo]) {
      acc[tableNo] = {
        tableId: table.id,
        tableNumber: tableNo,
        type: table.type,
        revenue: 0,
        ordersCount: 0
      };
    }

    acc[tableNo].revenue += Number(bill.total);
    acc[tableNo].ordersCount += 1;
    return acc;
  }, {});

  return Object.values(summary).sort((a, b) => b.revenue - a.revenue);
};

export const onlineOrderSummary = async (startDate, endDate) => {
  const dateFilter = getDateRangeFilter(startDate, endDate);

  const [takeAwayBills, onlineOrders] = await Promise.all([
    prisma.bill.findMany({
      where: {
        status: 'FINALIZED',
        ...dateFilter,
        order: {
          orderSource: { in: ['SELF_PICKUP', 'SWIGGY', 'ZOMATO'] },
        },
      },
      select: {
        total: true,
        order: { select: { orderSource: true } },
      },
    }),
    prisma.onlineOrder.findMany({
      where: { status: 'COMPLETED', ...dateFilter },
      select: { platform: true, total: true },
    }),
  ]);

  const summary = {
    selfPickupOrders: 0,
    selfPickupRevenue: 0,
    swiggyOrders: 0,
    swiggyRevenue: 0,
    zomatoOrders: 0,
    zomatoRevenue: 0,
    totalTakeAwayRevenue: 0,
    totalOnlineRevenue: 0
  };

  takeAwayBills.forEach(b => {
    const amount = Number(b.total);
    summary.totalTakeAwayRevenue += amount;
    if (b.order?.orderSource === 'SELF_PICKUP') {
      summary.selfPickupOrders += 1;
      summary.selfPickupRevenue += amount;
    } else if (b.order?.orderSource === 'SWIGGY') {
      summary.swiggyOrders += 1;
      summary.swiggyRevenue += amount;
    } else if (b.order?.orderSource === 'ZOMATO') {
      summary.zomatoOrders += 1;
      summary.zomatoRevenue += amount;
    }
  });

  onlineOrders.forEach(order => {
    const amount = Number(order.total);
    summary.totalTakeAwayRevenue += amount;
    if (order.platform === 'SWIGGY') {
      summary.swiggyOrders += 1;
      summary.swiggyRevenue += amount;
    } else if (order.platform === 'ZOMATO') {
      summary.zomatoOrders += 1;
      summary.zomatoRevenue += amount;
    }
  });

  summary.totalOnlineRevenue = summary.totalTakeAwayRevenue;
  return summary;
};

export const purchaseSummary = async (startDate, endDate) => {

  const filter = {};
  if (startDate || endDate) {
    filter.purchaseDate = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.purchaseDate.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.purchaseDate.lte = end;
    }
  } else {

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    filter.purchaseDate = { gte: start, lte: end };
  }

  const purchases = await prisma.purchaseEntry.findMany({
    where: filter,
    select: {
      totalAmount: true,
      supplier: { select: { name: true } },
    },
  });

  const summary = {
    totalPurchaseAmount: 0,
    bySupplier: {}
  };

  purchases.forEach(purchase => {
    const amount = Number(purchase.totalAmount);
    summary.totalPurchaseAmount += amount;

    const supplierName = purchase.supplier.name;
    if (!summary.bySupplier[supplierName]) {
      summary.bySupplier[supplierName] = { amount: 0, count: 0 };
    }
    summary.bySupplier[supplierName].amount += amount;
    summary.bySupplier[supplierName].count += 1;
  });

  return summary;
};

export const inventoryStatus = async () => {
  const items = await prisma.inventoryItem.findMany({
    select: {
      id: true,
      name: true,
      currentStock: true,
      lowStockThreshold: true,
      unit: true,
    },
    orderBy: { name: 'asc' },
  });

  const status = {
    totalItems: items.length,
    lowStockCount: 0,
    lowStockItems: []
  };

  items.forEach(item => {
    if (item.currentStock <= item.lowStockThreshold) {
      status.lowStockCount += 1;
      status.lowStockItems.push({
        id: item.id,
        name: item.name,
        currentStock: item.currentStock,
        threshold: item.lowStockThreshold,
        unit: item.unit
      });
    }
  });

  return status;
};

export const getUnifiedDashboardMetrics = async (startDate, endDate) => {
  const dateFilter = getDateRangeFilter(startDate, endDate);
  const settings = settingsCache.get() || await prisma.settings.findFirst();

  const purchaseDateFilter = {};
  if (startDate || endDate) {
    purchaseDateFilter.purchaseDate = {};
    if (startDate) {
      const s = new Date(startDate); s.setHours(0, 0, 0, 0);
      purchaseDateFilter.purchaseDate.gte = s;
    }
    if (endDate) {
      const e = new Date(endDate); e.setHours(23, 59, 59, 999);
      purchaseDateFilter.purchaseDate.lte = e;
    }
  } else {
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    purchaseDateFilter.purchaseDate = { gte: s, lte: e };
  }

  // Get date strings or defaults for SQL params
  const sqlStartDate = startDate ? new Date(startDate) : new Date();
  if (!startDate) sqlStartDate.setHours(0, 0, 0, 0);
  const sqlEndDate = endDate ? new Date(endDate) : new Date();
  if (!endDate) sqlEndDate.setHours(23, 59, 59, 999);

  const billsQuery = `
    SELECT b.id, b.orderId, b.total, b.sgstAmount, b.cgstAmount, b.createdAt,
           b.tableId, b.sessionId,
           o.orderSource,
           COALESCE(st.type, ot.type) as tableType,
           COALESCE(st.id, ot.id) as resolvedTableId,
           COALESCE(st.number, ot.number) as resolvedTableNumber,
           p.method as payMethod, p.amount as payAmount
    FROM \`Bill\` b
    LEFT JOIN \`Order\` o ON o.id = b.orderId
    LEFT JOIN \`Table\` ot ON ot.id = o.tableId
    LEFT JOIN \`TableSession\` s ON s.id = b.sessionId
    LEFT JOIN \`Table\` st ON st.id = s.tableId
    LEFT JOIN \`Payment\` p ON p.billId = b.id
    WHERE b.status = 'FINALIZED' AND b.createdAt >= ? AND b.createdAt <= ?
    ORDER BY b.createdAt ASC
  `;

  // Run the 4 core queries in parallel ONCE
  const [bills, onlineOrders, allOrders, purchases] = await Promise.all([
    rawQuery(billsQuery, sqlStartDate, sqlEndDate),

    prisma.onlineOrder.findMany({
      where: { ...dateFilter },
      select: { id: true, platform: true, total: true, status: true, externalOrderId: true, createdAt: true }
    }),

    prisma.order.findMany({
      where: { ...dateFilter },
      select: { id: true, orderSource: true, sessionId: true, status: true }
    }),

    prisma.purchaseEntry.findMany({
      where: { status: 'ACTIVE', ...purchaseDateFilter },
      select: {
        totalAmount: true,
        supplier: { select: { name: true } }
      }
    })
  ]);

  // Fetch non-cancelled order items in a flat batch query to prevent connection resets and 5-level deep joins
  const orderIds = bills.map(b => b.orderId).filter(Boolean);
  const orderItems = orderIds.length > 0 ? await prisma.orderItem.findMany({
    where: {
      orderId: { in: orderIds },
      status: { not: 'CANCELLED' }
    },
    select: {
      itemNameSnapshot: true,
      priceSnapshot: true,
      quantity: true,
      menuItem: {
        select: { name: true, price: true, category: { select: { name: true } } }
      }
    }
  }) : [];

  // --- 1. SALES SUMMARY ---
  let acSales = 0;
  let nonAcSales = 0;
  let selfPickupSales = 0;
  let swiggyRevenue = 0;
  let zomatoRevenue = 0;

  bills.forEach(b => {
    const total = Number(b.total);
    const source = b.orderSource;

    if (source === 'DINE_IN_AC') {
      acSales += total;
    } else if (source === 'DINE_IN_NON_AC') {
      nonAcSales += total;
    } else if (source === 'SELF_PICKUP') {
      selfPickupSales += total;
    } else if (source === 'SWIGGY') {
      swiggyRevenue += total;
    } else if (source === 'ZOMATO') {
      zomatoRevenue += total;
    } else {
      if (b.tableType === 'AC') {
        acSales += total;
      } else {
        nonAcSales += total;
      }
    }
  });

  const completedOnlineOrders = onlineOrders.filter(o => o.status === 'COMPLETED');
  completedOnlineOrders.forEach(order => {
    if (order.platform === 'SWIGGY') swiggyRevenue += Number(order.total);
    if (order.platform === 'ZOMATO') zomatoRevenue += Number(order.total);
  });

  const dineInRevenue = acSales + nonAcSales;
  const takeAwayRevenue = selfPickupSales + swiggyRevenue + zomatoRevenue;
  const totalRevenue = dineInRevenue + takeAwayRevenue;
  const totalOrders = bills.length + completedOnlineOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const taxCollected = bills.reduce((sum, b) => sum + Number(b.sgstAmount) + Number(b.cgstAmount), 0);

  const purchaseCost = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
  const netSalesAfterPurchases = totalRevenue - purchaseCost;

  const pad = (n) => String(n).padStart(2, '0');
  const isSingleDay = Boolean(startDate && endDate && startDate === endDate);
  let timeline = [];

  if (isSingleDay) {
    const hourMap = {};
    for (let h = 8; h <= 23; h++) {
      const key = `${pad(h)}:00`;
      hourMap[key] = {
        label: key,
        time: key,
        acSales: 0,
        nonAcSales: 0,
        selfPickupSales: 0,
        swiggyRevenue: 0,
        zomatoRevenue: 0,
        dineIn: 0,
        takeAway: 0,
        total: 0,
        orders: 0
      };
    }

    bills.forEach(b => {
      const d = new Date(b.createdAt);
      const h = `${pad(d.getHours())}:00`;
      if (!hourMap[h]) {
        hourMap[h] = {
          label: h,
          time: h,
          acSales: 0,
          nonAcSales: 0,
          selfPickupSales: 0,
          swiggyRevenue: 0,
          zomatoRevenue: 0,
          dineIn: 0,
          takeAway: 0,
          total: 0,
          orders: 0
        };
      }
      const total = Number(b.total);
      const source = b.orderSource;
      hourMap[h].orders += 1;
      hourMap[h].total += total;

      if (source === 'DINE_IN_AC') {
        hourMap[h].acSales += total;
        hourMap[h].dineIn += total;
      } else if (source === 'DINE_IN_NON_AC') {
        hourMap[h].nonAcSales += total;
        hourMap[h].dineIn += total;
      } else if (source === 'SELF_PICKUP') {
        hourMap[h].selfPickupSales += total;
        hourMap[h].takeAway += total;
      } else if (source === 'SWIGGY') {
        hourMap[h].swiggyRevenue += total;
        hourMap[h].takeAway += total;
      } else if (source === 'ZOMATO') {
        hourMap[h].zomatoRevenue += total;
        hourMap[h].takeAway += total;
      } else {
        if (b.tableType === 'AC') {
          hourMap[h].acSales += total;
          hourMap[h].dineIn += total;
        } else {
          hourMap[h].nonAcSales += total;
          hourMap[h].dineIn += total;
        }
      }
    });

    timeline = Object.keys(hourMap).sort().map(k => hourMap[k]);
  } else {
    const dateMap = {};
    const s = startDate ? new Date(startDate) : new Date(Date.now() - 6 * 86400000);
    const e = endDate ? new Date(endDate) : new Date();
    const cur = new Date(s);
    while (cur <= e) {
      const key = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      const dayName = cur.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      dateMap[key] = {
        date: key,
        label: dayName,
        acSales: 0,
        nonAcSales: 0,
        selfPickupSales: 0,
        swiggyRevenue: 0,
        zomatoRevenue: 0,
        dineIn: 0,
        takeAway: 0,
        total: 0,
        orders: 0
      };
      cur.setDate(cur.getDate() + 1);
    }

    bills.forEach(b => {
      const d = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (!dateMap[key]) {
        const dayName = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        dateMap[key] = {
          date: key,
          label: dayName,
          acSales: 0,
          nonAcSales: 0,
          selfPickupSales: 0,
          swiggyRevenue: 0,
          zomatoRevenue: 0,
          dineIn: 0,
          takeAway: 0,
          total: 0,
          orders: 0
        };
      }
      const total = Number(b.total);
      const source = b.orderSource;
      dateMap[key].orders += 1;
      dateMap[key].total += total;

      if (source === 'DINE_IN_AC') {
        dateMap[key].acSales += total;
        dateMap[key].dineIn += total;
      } else if (source === 'DINE_IN_NON_AC') {
        dateMap[key].nonAcSales += total;
        dateMap[key].dineIn += total;
      } else if (source === 'SELF_PICKUP') {
        dateMap[key].selfPickupSales += total;
        dateMap[key].takeAway += total;
      } else if (source === 'SWIGGY') {
        dateMap[key].swiggyRevenue += total;
        dateMap[key].takeAway += total;
      } else if (source === 'ZOMATO') {
        dateMap[key].zomatoRevenue += total;
        dateMap[key].takeAway += total;
      } else {
        if (b.tableType === 'AC') {
          dateMap[key].acSales += total;
          dateMap[key].dineIn += total;
        } else {
          dateMap[key].nonAcSales += total;
          dateMap[key].dineIn += total;
        }
      }
    });

    timeline = Object.keys(dateMap).sort().map(k => dateMap[k]);
  }

  // Top Items & Category Sales
  const itemMap = {};
  const catMap = {};
  orderItems.forEach(it => {
    const name = it.itemNameSnapshot || it.menuItem?.name || 'Unknown Item';
    const category = it.menuItem?.category?.name || 'Other';
    const qty = Number(it.quantity || 1);
    const price = Number(it.priceSnapshot || it.menuItem?.price || 0);
    const revenue = qty * price;

    if (!itemMap[name]) {
      itemMap[name] = { name, category, quantity: 0, revenue: 0 };
    }
    itemMap[name].quantity += qty;
    itemMap[name].revenue += revenue;

    if (!catMap[category]) {
      catMap[category] = { name: category, revenue: 0, quantity: 0 };
    }
    catMap[category].quantity += qty;
    catMap[category].revenue += revenue;
  });

  const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 100);
  const categorySales = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);

  const sales = {
    totalRevenue,
    dineInRevenue,
    acSales,
    nonAcSales,
    takeAwayRevenue,
    selfPickupSales,
    swiggyRevenue,
    zomatoRevenue,
    onlineRevenue: takeAwayRevenue,
    totalOrders,
    avgOrderValue,
    taxCollected,
    purchaseCost,
    netSalesAfterPurchases,
    includePurchasesInReports: !!settings?.includePurchasesInReports,
    timeline,
    topItems,
    categorySales
  };

  // --- 2. ORDERS SUMMARY ---
  const dineInOrders = allOrders.filter(
    o => o.orderSource === 'DINE_IN_AC' || o.orderSource === 'DINE_IN_NON_AC' || (o.sessionId && !['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(o.orderSource))
  );
  const takeAwayOrders = allOrders.filter(
    o => ['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(o.orderSource)
  );

  const dineInByStatus = dineInOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  const takeAwayByStatus = takeAwayOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  onlineOrders.forEach(order => {
    takeAwayByStatus[order.status] = (takeAwayByStatus[order.status] || 0) + 1;
  });

  const orders = {
    dineIn: { total: dineInOrders.length, byStatus: dineInByStatus },
    takeAway: {
      total: takeAwayOrders.length + onlineOrders.length,
      byStatus: takeAwayByStatus,
      selfPickup: takeAwayOrders.filter(o => o.orderSource === 'SELF_PICKUP').length,
      swiggy: takeAwayOrders.filter(o => o.orderSource === 'SWIGGY').length + onlineOrders.filter(o => o.platform === 'SWIGGY').length,
      zomato: takeAwayOrders.filter(o => o.orderSource === 'ZOMATO').length + onlineOrders.filter(o => o.platform === 'ZOMATO').length,
    },
    online: {
      total: takeAwayOrders.length + onlineOrders.length,
      byStatus: takeAwayByStatus
    }
  };

  // --- 3. PAYMENTS BREAKDOWN ---
  const payments = {};
  bills.forEach(bill => {
    const method = bill.payMethod || 'UNKNOWN';
    if (!payments[method]) payments[method] = { total: 0, count: 0 };
    payments[method].total += Number(bill.total);
    payments[method].count += 1;
  });

  // --- 4. ONLINE ORDER SUMMARY ---
  const onlineOrderReport = {
    selfPickupOrders: 0,
    selfPickupRevenue: 0,
    swiggyOrders: 0,
    swiggyRevenue: 0,
    zomatoOrders: 0,
    zomatoRevenue: 0,
    totalTakeAwayRevenue: 0,
    totalOnlineRevenue: 0
  };

  bills.forEach(b => {
    const source = b.orderSource;
    if (['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(source)) {
      const amount = Number(b.total);
      onlineOrderReport.totalTakeAwayRevenue += amount;
      if (source === 'SELF_PICKUP') {
        onlineOrderReport.selfPickupOrders += 1;
        onlineOrderReport.selfPickupRevenue += amount;
      } else if (source === 'SWIGGY') {
        onlineOrderReport.swiggyOrders += 1;
        onlineOrderReport.swiggyRevenue += amount;
      } else if (source === 'ZOMATO') {
        onlineOrderReport.zomatoOrders += 1;
        onlineOrderReport.zomatoRevenue += amount;
      }
    }
  });

  completedOnlineOrders.forEach(order => {
    const amount = Number(order.total);
    onlineOrderReport.totalTakeAwayRevenue += amount;
    if (order.platform === 'SWIGGY') {
      onlineOrderReport.swiggyOrders += 1;
      onlineOrderReport.swiggyRevenue += amount;
    } else if (order.platform === 'ZOMATO') {
      onlineOrderReport.zomatoOrders += 1;
      onlineOrderReport.zomatoRevenue += amount;
    }
  });
  onlineOrderReport.totalOnlineRevenue = onlineOrderReport.totalTakeAwayRevenue;

  // --- 5. PURCHASES SUMMARY ---
  const purchaseReport = {
    totalPurchaseAmount: purchaseCost,
    bySupplier: {}
  };
  purchases.forEach(purchase => {
    const amount = Number(purchase.totalAmount);
    const supplierName = purchase.supplier?.name || 'Unknown';
    if (!purchaseReport.bySupplier[supplierName]) {
      purchaseReport.bySupplier[supplierName] = { amount: 0, count: 0 };
    }
    purchaseReport.bySupplier[supplierName].amount += amount;
    purchaseReport.bySupplier[supplierName].count += 1;
  });

  // --- 6. TABLES SUMMARY ---
  const tableSummaryMap = bills.reduce((acc, bill) => {
    const tableId = bill.resolvedTableId;
    if (!tableId) return acc;
    const tableNo = bill.resolvedTableNumber;
    if (!acc[tableNo]) {
      acc[tableNo] = {
        tableId: tableId,
        tableNumber: tableNo,
        type: bill.tableType,
        revenue: 0,
        ordersCount: 0
      };
    }
    acc[tableNo].revenue += Number(bill.total);
    acc[tableNo].ordersCount += 1;
    return acc;
  }, {});
  const tables = Object.values(tableSummaryMap).sort((a, b) => b.revenue - a.revenue);

  return { sales, orders, payments, onlineOrders: onlineOrderReport, purchases: purchaseReport, tables };
};
