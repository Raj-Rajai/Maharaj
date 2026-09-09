// Export all data from SQLite before migration
// Directly connects to SQLite using better-sqlite3 approach via Prisma
// Run: DATABASE_URL="file:./dev.db" node prisma/export_data.js

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

// Override DATABASE_URL to use SQLite for export
process.env.DATABASE_URL = 'file:./dev.db';

const prisma = new PrismaClient();

async function exportData() {
  console.log('Exporting all data from SQLite (dev.db)...');

  const data = {};

  // Export in dependency order (parents first)
  data.users = await prisma.user.findMany();
  data.userPermissions = await prisma.userPermission.findMany();
  data.refreshTokens = await prisma.refreshToken.findMany();
  data.settings = await prisma.settings.findMany();
  data.tables = await prisma.table.findMany();
  data.categories = await prisma.category.findMany();
  data.menuItems = await prisma.menuItem.findMany();
  data.tableSessions = await prisma.tableSession.findMany();
  data.orders = await prisma.order.findMany();
  data.orderItems = await prisma.orderItem.findMany();
  data.orderItemHistories = await prisma.orderItemHistory.findMany();
  data.kots = await prisma.kOT.findMany();
  data.bills = await prisma.bill.findMany();
  data.billAmendments = await prisma.billAmendment.findMany();
  data.payments = await prisma.payment.findMany();
  data.onlineOrders = await prisma.onlineOrder.findMany();
  data.suppliers = await prisma.supplier.findMany();
  data.purchaseEntries = await prisma.purchaseEntry.findMany();
  data.purchaseItems = await prisma.purchaseItem.findMany();
  data.inventoryItems = await prisma.inventoryItem.findMany();
  data.inventoryTransactions = await prisma.inventoryTransaction.findMany();
  data.auditLogs = await prisma.auditLog.findMany();

  // Print counts
  for (const [key, records] of Object.entries(data)) {
    console.log(`  ${key}: ${records.length} records`);
  }

  writeFileSync('prisma/sqlite_export.json', JSON.stringify(data, null, 2));
  console.log('\\nExported to prisma/sqlite_export.json');
}

exportData()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
