// Import data from SQLite export into PostgreSQL (Supabase)
// Resilient version: uses createMany where possible, batches operations, handles connection drops
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Retry wrapper for Supabase connection drops
async function withRetry(fn, label, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e.code === 'P1017' && i < retries - 1) {
        console.log(`  ⚠ Connection dropped during ${label}, retrying (${i + 1}/${retries})...`);
        await delay(2000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
}

// Batch insert helper — splits into chunks to avoid timeouts
async function batchCreate(model, records, label, chunkSize = 20) {
  if (!records?.length) return;
  console.log(`Importing ${records.length} ${label}...`);
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    await withRetry(
      () => prisma[model].createMany({ data: chunk, skipDuplicates: true }),
      `${label} [${i}-${i + chunk.length}]`
    );
    if (i + chunkSize < records.length) await delay(200);
  }
}

const toDate = (s) => s ? new Date(s) : null;
const toDecimal = (v) => v !== null && v !== undefined ? parseFloat(v) : 0;

async function importData() {
  const raw = readFileSync('prisma/postgres_dump.json', 'utf-8');
  const data = JSON.parse(raw);
  console.log('Importing data to PostgreSQL (Supabase)...\n');

  // 1. Users
  await batchCreate('user', data.users?.map(u => ({
    id: u.id, username: u.username, password: u.password, name: u.name,
    role: u.role, active: u.active, createdAt: toDate(u.createdAt), updatedAt: toDate(u.updatedAt),
  })), 'users');

  // 2. UserPermissions
  await batchCreate('userPermission', data.userPermissions?.map(p => ({
    id: p.id, userId: p.userId, permission: p.permission, createdAt: toDate(p.createdAt),
  })), 'user permissions', 30);

  // 3. Settings
  await batchCreate('settings', data.settings?.map(s => ({
    id: s.id, restaurantName: s.restaurantName, address: s.address, phone: s.phone,
    gstin: s.gstin, sgstPercent: toDecimal(s.sgstPercent), cgstPercent: toDecimal(s.cgstPercent),
    includePurchasesInReports: s.includePurchasesInReports, updatedAt: toDate(s.updatedAt),
  })), 'settings');

  // 4. Tables
  await batchCreate('table', data.tables?.map(t => ({
    id: t.id, number: t.number, capacity: t.capacity, type: t.type,
    status: t.status, active: t.active, createdAt: toDate(t.createdAt),
  })), 'tables');

  // 5. Categories
  await batchCreate('category', data.categories?.map(c => ({
    id: c.id, name: c.name, displayOrder: c.displayOrder,
    active: c.active, createdAt: toDate(c.createdAt),
  })), 'categories');

  // 6. MenuItems
  await batchCreate('menuItem', data.menuItems?.map(m => ({
    id: m.id, name: m.name, categoryId: m.categoryId, menuType: m.menuType,
    price: toDecimal(m.price), description: m.description, active: m.active,
    createdAt: toDate(m.createdAt), updatedAt: toDate(m.updatedAt),
  })), 'menu items', 15);

  // 7. Suppliers
  await batchCreate('supplier', data.suppliers?.map(s => ({
    id: s.id, name: s.name, phone: s.phone, address: s.address,
    active: s.active, createdAt: toDate(s.createdAt),
  })), 'suppliers');

  // 8. TableSessions
  await batchCreate('tableSession', data.tableSessions?.map(ts => ({
    id: ts.id, tableId: ts.tableId, captainId: ts.captainId,
    guestCount: ts.guestCount, status: ts.status,
    openedAt: toDate(ts.openedAt), closedAt: toDate(ts.closedAt),
  })), 'table sessions');

  // 9. Orders
  await batchCreate('order', data.orders?.map(o => ({
    id: o.id, orderSource: o.orderSource, sessionId: o.sessionId,
    tableId: o.tableId, captainId: o.captainId, status: o.status,
    createdAt: toDate(o.createdAt), updatedAt: toDate(o.updatedAt),
  })), 'orders');

  // 10. KOTs (before OrderItems since OrderItem has kotId FK)
  await batchCreate('kOT', data.kots?.map(k => ({
    id: k.id, kotNumber: k.kotNumber, orderId: k.orderId,
    sessionId: k.sessionId, captainId: k.captainId,
    status: k.status, createdAt: toDate(k.createdAt),
  })), 'KOTs');

  // 11. OrderItems
  await batchCreate('orderItem', data.orderItems?.map(oi => ({
    id: oi.id, orderId: oi.orderId, menuItemId: oi.menuItemId,
    itemNameSnapshot: oi.itemNameSnapshot, priceSnapshot: toDecimal(oi.priceSnapshot),
    quantity: oi.quantity, originalQuantity: oi.originalQuantity,
    notes: oi.notes, kotId: oi.kotId, status: oi.status,
    createdAt: toDate(oi.createdAt),
  })), 'order items');

  // 12. OrderItemHistories
  await batchCreate('orderItemHistory', data.orderItemHistories?.map(h => ({
    id: h.id, orderItemId: h.orderItemId, changeType: h.changeType,
    oldQuantity: h.oldQuantity, newQuantity: h.newQuantity,
    reason: h.reason, changedBy: h.changedBy, createdAt: toDate(h.createdAt),
  })), 'order item histories');

  // 13. Bills — use raw SQL for autoincrement billNumber
  if (data.bills?.length) {
    console.log(`Importing ${data.bills.length} bills...`);
    const sortedBills = [...data.bills].sort((a, b) => a.billNumber - b.billNumber);
    for (let i = 0; i < sortedBills.length; i += 10) {
      const chunk = sortedBills.slice(i, i + 10);
      for (const b of chunk) {
        await withRetry(async () => {
          await prisma.$executeRawUnsafe(`
            INSERT INTO "Bill" (id, "billNumber", "orderId", "sessionId", "tableId", "customerName", "customerPhone",
              subtotal, "sgstPercent", "cgstPercent", "sgstAmount", "cgstAmount", discount, total, "roundOff",
              version, status, "createdAt", "finalizedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::\"BillStatus\", $18, $19)
            ON CONFLICT (id) DO NOTHING`,
            b.id, b.billNumber, b.orderId, b.sessionId || null, b.tableId || null,
            b.customerName || null, b.customerPhone || null,
            toDecimal(b.subtotal), toDecimal(b.sgstPercent), toDecimal(b.cgstPercent),
            toDecimal(b.sgstAmount), toDecimal(b.cgstAmount), toDecimal(b.discount),
            toDecimal(b.total), toDecimal(b.roundOff),
            b.version, b.status, toDate(b.createdAt), toDate(b.finalizedAt)
          );
        }, `bill ${b.billNumber}`);
      }
      if (i + 10 < sortedBills.length) await delay(300);
    }
    // Reset autoincrement sequence
    const maxBillNum = Math.max(...data.bills.map(b => b.billNumber));
    await withRetry(
      () => prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Bill"', 'billNumber'), $1)`, maxBillNum),
      'bill sequence reset'
    );
  }

  // 14. BillAmendments
  await batchCreate('billAmendment', data.billAmendments?.map(ba => ({
    id: ba.id, billId: ba.billId, version: ba.version, changes: ba.changes,
    reason: ba.reason, modifiedBy: ba.modifiedBy,
    originalTotal: toDecimal(ba.originalTotal), newSubtotal: toDecimal(ba.newSubtotal),
    newSgstAmount: toDecimal(ba.newSgstAmount), newCgstAmount: toDecimal(ba.newCgstAmount),
    newDiscount: toDecimal(ba.newDiscount), newTotal: toDecimal(ba.newTotal),
    difference: toDecimal(ba.difference), paymentStatus: ba.paymentStatus,
    createdAt: toDate(ba.createdAt),
  })), 'bill amendments');

  // 15. Payments
  await batchCreate('payment', data.payments?.map(p => ({
    id: p.id, billId: p.billId, method: p.method,
    amount: toDecimal(p.amount), status: p.status, paidAt: toDate(p.paidAt),
  })), 'payments');

  // 16. OnlineOrders
  await batchCreate('onlineOrder', data.onlineOrders?.map(oo => ({
    id: oo.id, platform: oo.platform, externalOrderId: oo.externalOrderId,
    customerName: oo.customerName, items: oo.items,
    subtotal: toDecimal(oo.subtotal), discount: toDecimal(oo.discount),
    charges: toDecimal(oo.charges), total: toDecimal(oo.total),
    paymentStatus: oo.paymentStatus, status: oo.status, notes: oo.notes,
    createdAt: toDate(oo.createdAt), updatedAt: toDate(oo.updatedAt),
  })), 'online orders');

  // 17. PurchaseEntries
  await batchCreate('purchaseEntry', data.purchaseEntries?.map(pe => ({
    id: pe.id, supplierId: pe.supplierId, purchaseNumber: pe.purchaseNumber,
    totalAmount: toDecimal(pe.totalAmount), purchaseDate: toDate(pe.purchaseDate),
    addToInventory: pe.addToInventory, status: pe.status, createdAt: toDate(pe.createdAt),
  })), 'purchase entries');

  // 18. PurchaseItems
  await batchCreate('purchaseItem', data.purchaseItems?.map(pi => ({
    id: pi.id, purchaseId: pi.purchaseId, name: pi.name,
    quantity: toDecimal(pi.quantity), unit: pi.unit,
    rate: toDecimal(pi.rate), amount: toDecimal(pi.amount),
  })), 'purchase items');

  // 19. InventoryItems
  await batchCreate('inventoryItem', data.inventoryItems?.map(ii => ({
    id: ii.id, name: ii.name, currentStock: toDecimal(ii.currentStock),
    unit: ii.unit, lowStockThreshold: toDecimal(ii.lowStockThreshold),
    updatedAt: toDate(ii.updatedAt),
  })), 'inventory items');

  // 20. InventoryTransactions
  await batchCreate('inventoryTransaction', data.inventoryTransactions?.map(it => ({
    id: it.id, inventoryItemId: it.inventoryItemId, type: it.type,
    quantity: toDecimal(it.quantity), referenceId: it.referenceId,
    notes: it.notes, createdAt: toDate(it.createdAt),
  })), 'inventory transactions');

  // 21. AuditLogs
  await batchCreate('auditLog', data.auditLogs?.map(al => ({
    id: al.id, userId: al.userId, action: al.action,
    entity: al.entity, entityId: al.entityId,
    before: al.before, after: al.after, reason: al.reason,
    createdAt: toDate(al.createdAt),
  })), 'audit logs');

  console.log('\n✅ Data import completed successfully!');
}

importData()
  .catch(e => { console.error('Import failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
