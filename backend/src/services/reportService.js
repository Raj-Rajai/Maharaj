import prisma, { rawQuery } from '../utils/prisma.js';
import { settingsCache, categoryCache } from '../utils/cache.js';
import { parseDateRange, getPrismaDateFilter } from '../utils/dateUtils.js';

const getDateRangeFilter = (startDate, endDate) => {
  return getPrismaDateFilter(startDate, endDate, 'createdAt');
};

const getCachedCategories = async () => {
  const cached = categoryCache.get();
  if (cached) return cached;
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { displayOrder: 'asc' },
    include: {
      _count: {
        select: { menuItems: { where: { active: true } } }
      }
    }
  });
  categoryCache.set(categories);
  return categories;
};

const getCachedSettings = async () => {
  const cached = settingsCache.get();
  if (cached) return cached;
  const s = await prisma.settings.findFirst();
  if (!s) return null;
  const formatted = {
    ...s,
    sgstPercent: s.sgstPercent !== undefined && s.sgstPercent !== null ? Number(s.sgstPercent).toFixed(2) : '2.50',
    cgstPercent: s.cgstPercent !== undefined && s.cgstPercent !== null ? Number(s.cgstPercent).toFixed(2) : '2.50',
  };
  settingsCache.set(formatted);
  return formatted;
};

const AGGREGATED_ITEMS_SQL = `
  SELECT COALESCE(NULLIF(oi.itemNameSnapshot, ''), m.name, 'Unknown Item') AS itemName,
         COALESCE(c.name, 'Other') AS categoryName,
         COALESCE(SUM(oi.quantity), 0) AS totalQuantity,
         COALESCE(SUM(oi.quantity * COALESCE(oi.priceSnapshot, m.price, 0)), 0) AS totalRevenue
  FROM \`Bill\` b
  INNER JOIN \`OrderItem\` oi ON oi.orderId = b.orderId
  LEFT JOIN \`MenuItem\` m ON m.id = oi.menuItemId
  LEFT JOIN \`Category\` c ON c.id = m.categoryId
  WHERE b.status = 'FINALIZED'
    AND b.createdAt >= ? AND b.createdAt <= ?
    AND oi.status != 'CANCELLED'
  GROUP BY COALESCE(NULLIF(oi.itemNameSnapshot, ''), m.name, 'Unknown Item'),
           COALESCE(c.name, 'Other')
`;

const SALES_BILLS_SQL = `
  SELECT b.id, b.orderId, b.total, b.sgstAmount, b.cgstAmount, b.createdAt,
         o.orderSource,
         COALESCE(st.type, ot.type) as tableType
  FROM \`Bill\` b
  LEFT JOIN \`Order\` o ON o.id = b.orderId
  LEFT JOIN \`Table\` ot ON ot.id = o.tableId
  LEFT JOIN \`TableSession\` s ON s.id = b.sessionId
  LEFT JOIN \`Table\` st ON st.id = s.tableId
  WHERE b.status = 'FINALIZED' AND b.createdAt >= ? AND b.createdAt <= ?
  ORDER BY b.createdAt ASC
`;

export const salesSummary = async (startDate, endDate) => {
  const { start: dateStart, end: dateEnd, isSingleDay } = parseDateRange(startDate, endDate);
  const dateFilter = { createdAt: { gte: dateStart, lte: dateEnd } };

  const [bills, onlineOrders, groupedItems, allActiveCategories, settings] = await Promise.all([
    rawQuery(SALES_BILLS_SQL, dateStart, dateEnd),
    prisma.onlineOrder.findMany({
      where: { status: 'COMPLETED', ...dateFilter },
      select: { platform: true, total: true }
    }),
    rawQuery(AGGREGATED_ITEMS_SQL, dateStart, dateEnd),
    getCachedCategories(),
    getCachedSettings(),
  ]);

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
    const s = new Date(dateStart);
    const e = new Date(dateEnd);
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

  const itemMap = {};
  const catMap = {};

  // Pre-populate with all active DB categories so every category is available
  (allActiveCategories || []).forEach(c => {
    catMap[c.name] = { id: c.id, name: c.name, displayOrder: c.displayOrder, revenue: 0, quantity: 0 };
  });

  groupedItems.forEach(it => {
    const name = it.itemName || 'Unknown Item';
    const category = it.categoryName || 'Other';
    const qty = Number(it.totalQuantity || 0);
    const revenue = Number(it.totalRevenue || 0);

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
  const categorySales = Object.values(catMap);
  let purchaseCost = 0;
  let netSalesAfterPurchases = totalRevenue;

  if (settings?.includePurchasesInReports) {
    const purchaseDateFilter = { purchaseDate: { gte: dateStart, lte: dateEnd } };

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
    categorySales,
    categories: allActiveCategories.map(c => ({ id: c.id, name: c.name, displayOrder: c.displayOrder }))
  };
};

export const orderSummary = async (startDate, endDate) => {
  const { start, end } = parseDateRange(startDate, endDate);

  const [orderGroups, onlineGroups] = await Promise.all([
    rawQuery(
      `SELECT orderSource, status, (sessionId IS NOT NULL) AS hasSession, COUNT(*) AS cnt
       FROM \`Order\`
       WHERE createdAt >= ? AND createdAt <= ?
       GROUP BY orderSource, status, (sessionId IS NOT NULL)`,
      start,
      end
    ),
    rawQuery(
      `SELECT platform, status, COUNT(*) AS cnt
       FROM \`OnlineOrder\`
       WHERE createdAt >= ? AND createdAt <= ?
       GROUP BY platform, status`,
      start,
      end
    ),
  ]);

  let dineInTotal = 0;
  let takeAwayTotal = 0;
  let onlineTotal = 0;
  let selfPickupCount = 0;
  let swiggyCount = 0;
  let zomatoCount = 0;
  const dineInByStatus = {};
  const takeAwayByStatus = {};

  for (const row of orderGroups) {
    const count = Number(row.cnt || 0);
    const source = row.orderSource;
    const status = row.status;
    const hasSession = Boolean(row.hasSession);

    if (source === 'DINE_IN_AC' || source === 'DINE_IN_NON_AC' || (hasSession && !['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(source))) {
      dineInTotal += count;
      dineInByStatus[status] = (dineInByStatus[status] || 0) + count;
    }
    if (['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(source)) {
      takeAwayTotal += count;
      takeAwayByStatus[status] = (takeAwayByStatus[status] || 0) + count;
      if (source === 'SELF_PICKUP') selfPickupCount += count;
      if (source === 'SWIGGY') swiggyCount += count;
      if (source === 'ZOMATO') zomatoCount += count;
    }
  }

  for (const row of onlineGroups) {
    const count = Number(row.cnt || 0);
    onlineTotal += count;
    takeAwayByStatus[row.status] = (takeAwayByStatus[row.status] || 0) + count;
    if (row.platform === 'SWIGGY') swiggyCount += count;
    if (row.platform === 'ZOMATO') zomatoCount += count;
  }

  return {
    dineIn: {
      total: dineInTotal,
      byStatus: dineInByStatus
    },
    takeAway: {
      total: takeAwayTotal + onlineTotal,
      byStatus: takeAwayByStatus,
      selfPickup: selfPickupCount,
      swiggy: swiggyCount,
      zomato: zomatoCount,
    },
    online: {
      total: takeAwayTotal + onlineTotal,
      byStatus: takeAwayByStatus
    }
  };
};

export const paymentBreakdown = async (startDate, endDate) => {
  const { start, end } = parseDateRange(startDate, endDate);

  const rows = await rawQuery(
    `SELECT COALESCE(p.method, 'UNKNOWN') AS method,
            COALESCE(SUM(b.total), 0) AS total,
            COUNT(*) AS count
     FROM \`Bill\` b
     LEFT JOIN \`Payment\` p ON p.billId = b.id
     WHERE b.status = 'FINALIZED' AND b.createdAt >= ? AND b.createdAt <= ?
     GROUP BY COALESCE(p.method, 'UNKNOWN')`,
    start,
    end
  );

  const breakdown = {};
  for (const row of rows) {
    const method = row.method || 'UNKNOWN';
    breakdown[method] = {
      total: Number(row.total || 0),
      count: Number(row.count || 0),
    };
  }
  return breakdown;
};

export const tableSummary = async (startDate, endDate) => {
  const { start, end } = parseDateRange(startDate, endDate);

  const rows = await rawQuery(
    `SELECT COALESCE(st.id, ot.id) AS tableId,
            COALESCE(st.number, ot.number) AS tableNumber,
            COALESCE(st.type, ot.type) AS type,
            COALESCE(SUM(b.total), 0) AS revenue,
            COUNT(*) AS ordersCount
     FROM \`Bill\` b
     LEFT JOIN \`Order\` o ON o.id = b.orderId
     LEFT JOIN \`Table\` ot ON ot.id = o.tableId
     LEFT JOIN \`TableSession\` s ON s.id = b.sessionId
     LEFT JOIN \`Table\` st ON st.id = s.tableId
     WHERE b.status = 'FINALIZED'
       AND b.createdAt >= ? AND b.createdAt <= ?
       AND COALESCE(st.id, ot.id) IS NOT NULL
     GROUP BY COALESCE(st.id, ot.id), COALESCE(st.number, ot.number), COALESCE(st.type, ot.type)
     ORDER BY revenue DESC`,
    start,
    end
  );

  return rows.map(r => ({
    tableId: r.tableId,
    tableNumber: Number(r.tableNumber),
    type: r.type,
    revenue: Number(r.revenue || 0),
    ordersCount: Number(r.ordersCount || 0),
  }));
};

export const onlineOrderSummary = async (startDate, endDate) => {
  const { start, end } = parseDateRange(startDate, endDate);

  const [takeAwayGroups, onlineGroups] = await Promise.all([
    rawQuery(
      `SELECT o.orderSource AS source, COUNT(*) AS cnt, COALESCE(SUM(b.total), 0) AS total
       FROM \`Bill\` b
       INNER JOIN \`Order\` o ON o.id = b.orderId
       WHERE b.status = 'FINALIZED'
         AND b.createdAt >= ? AND b.createdAt <= ?
         AND o.orderSource IN ('SELF_PICKUP', 'SWIGGY', 'ZOMATO')
       GROUP BY o.orderSource`,
      start,
      end
    ),
    rawQuery(
      `SELECT platform, COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS total
       FROM \`OnlineOrder\`
       WHERE status = 'COMPLETED' AND createdAt >= ? AND createdAt <= ?
       GROUP BY platform`,
      start,
      end
    ),
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

  for (const row of takeAwayGroups) {
    const amount = Number(row.total || 0);
    const cnt = Number(row.cnt || 0);
    summary.totalTakeAwayRevenue += amount;
    if (row.source === 'SELF_PICKUP') {
      summary.selfPickupOrders += cnt;
      summary.selfPickupRevenue += amount;
    } else if (row.source === 'SWIGGY') {
      summary.swiggyOrders += cnt;
      summary.swiggyRevenue += amount;
    } else if (row.source === 'ZOMATO') {
      summary.zomatoOrders += cnt;
      summary.zomatoRevenue += amount;
    }
  }

  for (const row of onlineGroups) {
    const amount = Number(row.total || 0);
    const cnt = Number(row.cnt || 0);
    summary.totalTakeAwayRevenue += amount;
    if (row.platform === 'SWIGGY') {
      summary.swiggyOrders += cnt;
      summary.swiggyRevenue += amount;
    } else if (row.platform === 'ZOMATO') {
      summary.zomatoOrders += cnt;
      summary.zomatoRevenue += amount;
    }
  }

  summary.totalOnlineRevenue = summary.totalTakeAwayRevenue;
  return summary;
};

export const purchaseSummary = async (startDate, endDate) => {
  const { start, end } = parseDateRange(startDate, endDate);

  const rows = await rawQuery(
    `SELECT COALESCE(s.name, 'Unknown') AS supplierName,
            COALESCE(SUM(pe.totalAmount), 0) AS amount,
            COUNT(*) AS cnt
     FROM \`PurchaseEntry\` pe
     LEFT JOIN \`Supplier\` s ON s.id = pe.supplierId
     WHERE pe.status = 'ACTIVE' AND pe.purchaseDate >= ? AND pe.purchaseDate <= ?
     GROUP BY COALESCE(s.name, 'Unknown')`,
    start,
    end
  );

  const summary = {
    totalPurchaseAmount: 0,
    bySupplier: {}
  };

  for (const row of rows) {
    const amount = Number(row.amount || 0);
    const count = Number(row.cnt || 0);
    summary.totalPurchaseAmount += amount;
    summary.bySupplier[row.supplierName] = { amount, count };
  }

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
  const { start: sqlStartDate, end: sqlEndDate, isSingleDay } = parseDateRange(startDate, endDate);
  const dateFilter = { createdAt: { gte: sqlStartDate, lte: sqlEndDate } };
  const purchaseDateFilter = { purchaseDate: { gte: sqlStartDate, lte: sqlEndDate } };

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

  // Run all queries (including SQL-grouped order items, orders, online orders, purchases, categories, and settings) in a SINGLE parallel roundtrip
  const [bills, onlineGroups, orderGroups, purchaseGroups, groupedItems, allActiveCategories, settings] = await Promise.all([
    rawQuery(billsQuery, sqlStartDate, sqlEndDate),

    rawQuery(
      `SELECT platform, status, COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS total
       FROM \`OnlineOrder\`
       WHERE createdAt >= ? AND createdAt <= ?
       GROUP BY platform, status`,
      sqlStartDate,
      sqlEndDate
    ),

    rawQuery(
      `SELECT orderSource, status, (sessionId IS NOT NULL) AS hasSession, COUNT(*) AS cnt
       FROM \`Order\`
       WHERE createdAt >= ? AND createdAt <= ?
       GROUP BY orderSource, status, (sessionId IS NOT NULL)`,
      sqlStartDate,
      sqlEndDate
    ),

    rawQuery(
      `SELECT COALESCE(s.name, 'Unknown') AS supplierName,
              COALESCE(SUM(pe.totalAmount), 0) AS amount,
              COUNT(*) AS cnt
       FROM \`PurchaseEntry\` pe
       LEFT JOIN \`Supplier\` s ON s.id = pe.supplierId
       WHERE pe.status = 'ACTIVE' AND pe.purchaseDate >= ? AND pe.purchaseDate <= ?
       GROUP BY COALESCE(s.name, 'Unknown')`,
      sqlStartDate,
      sqlEndDate
    ),

    rawQuery(AGGREGATED_ITEMS_SQL, sqlStartDate, sqlEndDate),
    getCachedCategories(),
    getCachedSettings(),
  ]);

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

  let completedOnlineCount = 0;
  const completedOnlineGroups = onlineGroups.filter(o => o.status === 'COMPLETED');
  completedOnlineGroups.forEach(row => {
    const count = Number(row.cnt || 0);
    const total = Number(row.total || 0);
    completedOnlineCount += count;
    if (row.platform === 'SWIGGY') swiggyRevenue += total;
    if (row.platform === 'ZOMATO') zomatoRevenue += total;
  });

  const dineInRevenue = acSales + nonAcSales;
  const takeAwayRevenue = selfPickupSales + swiggyRevenue + zomatoRevenue;
  const totalRevenue = dineInRevenue + takeAwayRevenue;
  const totalOrders = bills.length + completedOnlineCount;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const taxCollected = bills.reduce((sum, b) => sum + Number(b.sgstAmount) + Number(b.cgstAmount), 0);

  const purchaseCost = purchaseGroups.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const netSalesAfterPurchases = totalRevenue - purchaseCost;

  const pad = (n) => String(n).padStart(2, '0');
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
    const s = new Date(sqlStartDate);
    const e = new Date(sqlEndDate);
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

  // Top Items & Category Sales (pre-aggregated in SQL)
  const itemMap = {};
  const catMap = {};

  // Pre-populate with all active DB categories so every category is available
  (allActiveCategories || []).forEach(c => {
    catMap[c.name] = { id: c.id, name: c.name, displayOrder: c.displayOrder, revenue: 0, quantity: 0 };
  });

  groupedItems.forEach(it => {
    const name = it.itemName || 'Unknown Item';
    const category = it.categoryName || 'Other';
    const qty = Number(it.totalQuantity || 0);
    const revenue = Number(it.totalRevenue || 0);

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
  const categorySales = Object.values(catMap);

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
    categorySales,
    categories: allActiveCategories.map(c => ({ id: c.id, name: c.name, displayOrder: c.displayOrder }))
  };

  // --- 2. ORDERS SUMMARY ---
  let dineInTotal = 0;
  let takeAwayTotal = 0;
  let onlineTotal = 0;
  let selfPickupOrderCount = 0;
  let swiggyOrderCount = 0;
  let zomatoOrderCount = 0;
  const dineInByStatus = {};
  const takeAwayByStatus = {};

  for (const row of orderGroups) {
    const count = Number(row.cnt || 0);
    const source = row.orderSource;
    const status = row.status;
    const hasSession = Boolean(row.hasSession);

    if (source === 'DINE_IN_AC' || source === 'DINE_IN_NON_AC' || (hasSession && !['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(source))) {
      dineInTotal += count;
      dineInByStatus[status] = (dineInByStatus[status] || 0) + count;
    }
    if (['SELF_PICKUP', 'SWIGGY', 'ZOMATO'].includes(source)) {
      takeAwayTotal += count;
      takeAwayByStatus[status] = (takeAwayByStatus[status] || 0) + count;
      if (source === 'SELF_PICKUP') selfPickupOrderCount += count;
      if (source === 'SWIGGY') swiggyOrderCount += count;
      if (source === 'ZOMATO') zomatoOrderCount += count;
    }
  }

  for (const row of onlineGroups) {
    const count = Number(row.cnt || 0);
    onlineTotal += count;
    takeAwayByStatus[row.status] = (takeAwayByStatus[row.status] || 0) + count;
    if (row.platform === 'SWIGGY') swiggyOrderCount += count;
    if (row.platform === 'ZOMATO') zomatoOrderCount += count;
  }

  const orders = {
    dineIn: { total: dineInTotal, byStatus: dineInByStatus },
    takeAway: {
      total: takeAwayTotal + onlineTotal,
      byStatus: takeAwayByStatus,
      selfPickup: selfPickupOrderCount,
      swiggy: swiggyOrderCount,
      zomato: zomatoOrderCount,
    },
    online: {
      total: takeAwayTotal + onlineTotal,
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

  completedOnlineGroups.forEach(row => {
    const amount = Number(row.total || 0);
    const count = Number(row.cnt || 0);
    onlineOrderReport.totalTakeAwayRevenue += amount;
    if (row.platform === 'SWIGGY') {
      onlineOrderReport.swiggyOrders += count;
      onlineOrderReport.swiggyRevenue += amount;
    } else if (row.platform === 'ZOMATO') {
      onlineOrderReport.zomatoOrders += count;
      onlineOrderReport.zomatoRevenue += amount;
    }
  });
  onlineOrderReport.totalOnlineRevenue = onlineOrderReport.totalTakeAwayRevenue;

  // --- 5. PURCHASES SUMMARY ---
  const purchaseReport = {
    totalPurchaseAmount: purchaseCost,
    bySupplier: {}
  };
  for (const row of purchaseGroups) {
    const supplierName = row.supplierName || 'Unknown';
    purchaseReport.bySupplier[supplierName] = {
      amount: Number(row.amount || 0),
      count: Number(row.cnt || 0),
    };
  }

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
