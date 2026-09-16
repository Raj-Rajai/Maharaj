import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  'DASHBOARD_VIEW', 'TABLE_VIEW', 'TABLE_CREATE', 'TABLE_EDIT', 'TABLE_DELETE',
  'MENU_AC_VIEW', 'MENU_AC_CREATE', 'MENU_AC_EDIT', 'MENU_AC_DELETE',
  'MENU_NON_AC_VIEW', 'MENU_NON_AC_CREATE', 'MENU_NON_AC_EDIT', 'MENU_NON_AC_DELETE',
  'MENU_SWIGGY_VIEW', 'MENU_SWIGGY_CREATE', 'MENU_SWIGGY_EDIT', 'MENU_SWIGGY_DELETE',
  'MENU_ZOMATO_VIEW', 'MENU_ZOMATO_CREATE', 'MENU_ZOMATO_EDIT', 'MENU_ZOMATO_DELETE',
  'MENU_BULK_ADD', 'ORDER_CREATE', 'ORDER_EDIT', 'ORDER_CANCEL',
  'KOT_CREATE', 'KOT_VIEW', 'KOT_EDIT', 'KOT_PRINT',
  'BILL_VIEW_DRAFT', 'BILL_EDIT', 'BILL_PRINT', 'BILL_FINALIZE', 'BILL_CANCEL', 'BILL_AMEND',
  'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_EDIT', 'PURCHASE_DELETE',
  'INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_EDIT', 'INVENTORY_ADJUST',
  'REPORT_VIEW', 'REPORT_PDF', 'REPORT_CSV',
  'USER_VIEW', 'USER_CREATE', 'USER_EDIT', 'USER_DELETE',
  'SETTINGS_VIEW', 'SETTINGS_EDIT',
  'ONLINE_ORDER_VIEW', 'ONLINE_ORDER_CREATE', 'ONLINE_ORDER_EDIT',
  'NOTIFICATION_KOT_AC', 'NOTIFICATION_KOT_NON_AC', 'NOTIFICATION_BILL_AC', 'NOTIFICATION_BILL_NON_AC'
];

async function main() {
  console.log('Seeding database...');

  const usersToSeed = [
    { username: 'superadmin', passwordRaw: 'super123', name: 'Super Admin', role: 'SUPER_ADMIN' },
    { username: 'admin', passwordRaw: 'admin123', name: 'Admin', role: 'ADMIN' },
    { username: 'acmaster', passwordRaw: 'ac123', name: 'AC Master', role: 'AC_MASTER' },
    { username: 'nonacmaster', passwordRaw: 'nonac123', name: 'Non AC Master', role: 'NON_AC_MASTER' },
  ];

  const seededUsers = {};

  for (const u of usersToSeed) {
    const pw = await bcrypt.hash(u.passwordRaw, 10);
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { role: u.role, name: u.name },
      create: { username: u.username, password: pw, name: u.name, role: u.role },
    });
    seededUsers[u.username] = user;
  }

  console.log('Assigning permissions...');

  await prisma.userPermission.deleteMany({ where: { userId: seededUsers['superadmin'].id } });
  await prisma.userPermission.createMany({
    data: ALL_PERMISSIONS.map(p => ({ userId: seededUsers['superadmin'].id, permission: p }))
  });

  const adminPerms = ALL_PERMISSIONS.filter(p => !['USER_CREATE', 'USER_EDIT', 'USER_DELETE'].includes(p));
  await prisma.userPermission.deleteMany({ where: { userId: seededUsers['admin'].id } });
  await prisma.userPermission.createMany({
    data: adminPerms.map(p => ({ userId: seededUsers['admin'].id, permission: p }))
  });

  const acMasterPerms = [
    'TABLE_VIEW', 'MENU_AC_VIEW', 'ORDER_CREATE', 'ORDER_EDIT',
    'KOT_CREATE', 'KOT_VIEW', 'KOT_PRINT', 'BILL_VIEW_DRAFT',
    'NOTIFICATION_KOT_AC', 'NOTIFICATION_BILL_AC'
  ];
  await prisma.userPermission.deleteMany({ where: { userId: seededUsers['acmaster'].id } });
  await prisma.userPermission.createMany({
    data: acMasterPerms.map(p => ({ userId: seededUsers['acmaster'].id, permission: p }))
  });

  const nonAcMasterPerms = [
    'TABLE_VIEW', 'MENU_NON_AC_VIEW', 'ORDER_CREATE', 'ORDER_EDIT',
    'KOT_CREATE', 'KOT_VIEW', 'KOT_PRINT', 'BILL_VIEW_DRAFT',
    'NOTIFICATION_KOT_NON_AC', 'NOTIFICATION_BILL_NON_AC'
  ];
  await prisma.userPermission.deleteMany({ where: { userId: seededUsers['nonacmaster'].id } });
  await prisma.userPermission.createMany({
    data: nonAcMasterPerms.map(p => ({ userId: seededUsers['nonacmaster'].id, permission: p }))
  });

  const existingSettings = await prisma.settings.findFirst();
  if (!existingSettings) {
    await prisma.settings.create({
      data: {
        restaurantName: 'Maharaj Veg Villa',
        address: 'Paravdi bypass Triveni square, opp. Hotel maroon, Godhra',
        phone: '',
        gstin: '',
        sgstPercent: 2.5,
        cgstPercent: 2.5,
      },
    });
  }

  const tables = [
    { number: 1, capacity: 4, type: 'AC' },
    { number: 2, capacity: 4, type: 'AC' },
    { number: 3, capacity: 6, type: 'AC' },
    { number: 4, capacity: 2, type: 'NON_AC' },
    { number: 5, capacity: 4, type: 'NON_AC' },
    { number: 6, capacity: 6, type: 'NON_AC' },
    { number: 7, capacity: 8, type: 'NON_AC' },
  ];
  for (const t of tables) {
    await prisma.table.upsert({ where: { number: t.number }, update: {}, create: t });
  }

  const cats = [
    { name: 'Starters', displayOrder: 1 },
    { name: 'Main Course', displayOrder: 2 },
    { name: 'Breads', displayOrder: 3 },
    { name: 'Rice', displayOrder: 4 },
    { name: 'Beverages', displayOrder: 5 },
    { name: 'Desserts', displayOrder: 6 },
  ];
  const catMap = {};
  for (const c of cats) {
    const cat = await prisma.category.upsert({ where: { name: c.name }, update: {}, create: c });
    catMap[c.name] = cat.id;
  }

  const baseItems = [
    { name: 'Paneer Tikka', cat: 'Starters', nonAcPrice: 220, acPrice: 250, swiggyPrice: 280, zomatoPrice: 275 },
    { name: 'Veg Manchurian', cat: 'Starters', nonAcPrice: 180, acPrice: 210, swiggyPrice: 230, zomatoPrice: 225 },
    { name: 'Spring Roll', cat: 'Starters', nonAcPrice: 160, acPrice: 190, swiggyPrice: 210, zomatoPrice: 205 },
    { name: 'Hara Bhara Kebab', cat: 'Starters', nonAcPrice: 180, acPrice: 210, swiggyPrice: 230, zomatoPrice: 225 },
    { name: 'Paneer Butter Masala', cat: 'Main Course', nonAcPrice: 280, acPrice: 310, swiggyPrice: 330, zomatoPrice: 325 },
    { name: 'Dal Tadka', cat: 'Main Course', nonAcPrice: 180, acPrice: 210, swiggyPrice: 230, zomatoPrice: 225 },
    { name: 'Mix Veg', cat: 'Main Course', nonAcPrice: 200, acPrice: 230, swiggyPrice: 250, zomatoPrice: 245 },
    { name: 'Chole Bhature', cat: 'Main Course', nonAcPrice: 160, acPrice: 190, swiggyPrice: 210, zomatoPrice: 205 },
    { name: 'Shahi Paneer', cat: 'Main Course', nonAcPrice: 260, acPrice: 290, swiggyPrice: 310, zomatoPrice: 305 },
    { name: 'Malai Kofta', cat: 'Main Course', nonAcPrice: 240, acPrice: 270, swiggyPrice: 290, zomatoPrice: 285 },
    { name: 'Butter Naan', cat: 'Breads', nonAcPrice: 50, acPrice: 80, swiggyPrice: 100, zomatoPrice: 95 },
    { name: 'Roti', cat: 'Breads', nonAcPrice: 30, acPrice: 50, swiggyPrice: 70, zomatoPrice: 65 },
    { name: 'Garlic Naan', cat: 'Breads', nonAcPrice: 60, acPrice: 90, swiggyPrice: 110, zomatoPrice: 105 },
    { name: 'Tandoori Roti', cat: 'Breads', nonAcPrice: 40, acPrice: 60, swiggyPrice: 80, zomatoPrice: 75 },
    { name: 'Jeera Rice', cat: 'Rice', nonAcPrice: 150, acPrice: 180, swiggyPrice: 200, zomatoPrice: 195 },
    { name: 'Veg Biryani', cat: 'Rice', nonAcPrice: 220, acPrice: 250, swiggyPrice: 270, zomatoPrice: 265 },
    { name: 'Plain Rice', cat: 'Rice', nonAcPrice: 100, acPrice: 120, swiggyPrice: 140, zomatoPrice: 135 },
    { name: 'Masala Chaas', cat: 'Beverages', nonAcPrice: 50, acPrice: 70, swiggyPrice: 90, zomatoPrice: 85 },
    { name: 'Sweet Lassi', cat: 'Beverages', nonAcPrice: 70, acPrice: 90, swiggyPrice: 110, zomatoPrice: 105 },
    { name: 'Fresh Lime Soda', cat: 'Beverages', nonAcPrice: 60, acPrice: 80, swiggyPrice: 100, zomatoPrice: 95 },
    { name: 'Gulab Jamun', cat: 'Desserts', nonAcPrice: 80, acPrice: 100, swiggyPrice: 120, zomatoPrice: 115 },
    { name: 'Rasgulla', cat: 'Desserts', nonAcPrice: 70, acPrice: 90, swiggyPrice: 110, zomatoPrice: 105 },
    { name: 'Ice Cream', cat: 'Desserts', nonAcPrice: 90, acPrice: 120, swiggyPrice: 140, zomatoPrice: 135 },
  ];

  for (const item of baseItems) {
    const categoryId = catMap[item.cat];

    const variants = [
      { menuType: 'NON_AC', price: item.nonAcPrice },
      { menuType: 'AC', price: item.acPrice },
      { menuType: 'SWIGGY', price: item.swiggyPrice },
      { menuType: 'ZOMATO', price: item.zomatoPrice },
    ];

    for (const v of variants) {
      const existing = await prisma.menuItem.findFirst({
        where: { name: item.name, categoryId, menuType: v.menuType },
      });
      if (!existing) {
        await prisma.menuItem.create({
          data: { name: item.name, categoryId, menuType: v.menuType, price: v.price },
        });
      } else {
        await prisma.menuItem.update({
          where: { id: existing.id },
          data: { price: v.price },
        });
      }
    }
  }

  const purchaseTypes = [
    { name: 'Fruits & Vegetables' },
    { name: 'Groceries & Staples' },
    { name: 'Spices & Masalas' },
    { name: 'Dairy & Bakery' },
    { name: 'Cooking Essentials' },
    { name: 'Beverages' },
    { name: 'Packaged Foods' },
    { name: 'Utensils' },
    { name: 'Disposables' },
    { name: 'General Essentials' },
    { name: 'Others' },
  ];
  for (const s of purchaseTypes) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.supplier.create({ data: s });
    }
  }

  console.log(`Seed completed! (${baseItems.length * 4} menu items created across 4 platforms)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
