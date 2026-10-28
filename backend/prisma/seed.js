/**
 * First-time setup for an EMPTY database.
 *
 * The deploy build runs this after `prisma db push` on every deploy, so it must be
 * safe against the live, populated database: it only ever inserts, and only into an
 * empty database. It never updates or deletes a row — once menu items, prices,
 * tables, categories, suppliers, users or permissions exist, they belong to the
 * restaurant and are changed in the app, not here.
 *
 *   - Settings: a default row is created when the Settings table is empty.
 *   - Everything else (demo users with their role's default permissions, sample
 *     tables, categories, menu and purchase types) is created only when there are no
 *     users at all, i.e. on a brand-new database. It is written in one transaction, so
 *     a failed first run leaves nothing behind and the next run starts over. Each
 *     sample block is also skipped if its table already has rows.
 *
 * New permissions do NOT reach existing users through this script:
 *   - SUPER_ADMIN users get every permission at runtime (src/utils/permissions.js).
 *   - Users with no permission rows fall back to their role's defaults
 *     (ROLE_DEFAULT_PERMISSIONS), so they pick up new defaults automatically.
 *   - Users with explicit permissions keep exactly what User Management saved. Give
 *     them a new permission in User Management, or for everyone whose role has it by
 *     default, once after the deploy that adds it:
 *       node backend/scripts/grant-permission.js <PERMISSION> --apply
 */
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prisma.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../src/utils/permissions.js';

const DEFAULT_SETTINGS = {
  restaurantName: 'Maharaj Veg Villa',
  address: 'Paravdi bypass Triveni square, opp. Hotel maroon, Godhra',
  phone: '',
  gstin: '',
  sgstPercent: 2.5,
  cgstPercent: 2.5,
};

const DEMO_USERS = [
  { username: 'superadmin', passwordRaw: 'super123', name: 'Super Admin', role: 'SUPER_ADMIN' },
  { username: 'admin', passwordRaw: 'admin123', name: 'Admin', role: 'ADMIN' },
  { username: 'acmaster', passwordRaw: 'ac123', name: 'AC Master', role: 'AC_MASTER' },
  { username: 'nonacmaster', passwordRaw: 'nonac123', name: 'Non AC Master', role: 'NON_AC_MASTER' },
];

const SAMPLE_TABLES = [
  { number: 1, capacity: 4, type: 'AC' },
  { number: 2, capacity: 4, type: 'AC' },
  { number: 3, capacity: 6, type: 'AC' },
  { number: 4, capacity: 2, type: 'NON_AC' },
  { number: 5, capacity: 4, type: 'NON_AC' },
  { number: 6, capacity: 6, type: 'NON_AC' },
  { number: 7, capacity: 8, type: 'NON_AC' },
];

const SAMPLE_CATEGORIES = [
  { name: 'Starters', displayOrder: 1 },
  { name: 'Main Course', displayOrder: 2 },
  { name: 'Breads', displayOrder: 3 },
  { name: 'Rice', displayOrder: 4 },
  { name: 'Beverages', displayOrder: 5 },
  { name: 'Desserts', displayOrder: 6 },
];

const SAMPLE_MENU = [
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

const SAMPLE_PURCHASE_TYPES = [
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

async function main() {
  console.log('Seeding database (first-time setup only; existing rows are never changed)...');

  if (await prisma.settings.count() === 0) {
    await prisma.settings.create({ data: DEFAULT_SETTINGS });
    console.log('Created default settings.');
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`Database already has ${userCount} user(s); nothing else to seed.`);
    return;
  }

  console.log('No users found: creating first-time setup...');

  // Hash outside the transaction so it only holds the connection for the inserts.
  const users = await Promise.all(DEMO_USERS.map(async (u) => ({
    username: u.username,
    password: await bcrypt.hash(u.passwordRaw, 10),
    name: u.name,
    role: u.role,
  })));

  const created = await prisma.$transaction(async (tx) => {
    const summary = [];

    for (const u of users) {
      await tx.user.create({
        data: {
          ...u,
          permissions: {
            createMany: { data: ROLE_DEFAULT_PERMISSIONS[u.role].map((permission) => ({ permission })) },
          },
        },
      });
    }
    summary.push(`users ${users.map((u) => u.username).join(', ')} (change their default passwords after first login)`);

    if (await tx.table.count() === 0) {
      await tx.table.createMany({ data: SAMPLE_TABLES });
      summary.push(`${SAMPLE_TABLES.length} sample tables`);
    }

    if (await tx.menuItem.count() === 0) {
      const categoryIds = {};
      for (const c of SAMPLE_CATEGORIES) {
        const category = await tx.category.findUnique({ where: { name: c.name } })
          ?? await tx.category.create({ data: c });
        categoryIds[c.name] = category.id;
      }

      const items = [];
      for (const item of SAMPLE_MENU) {
        const categoryId = categoryIds[item.cat];
        items.push(
          { name: item.name, categoryId, menuType: 'NON_AC', price: item.nonAcPrice },
          { name: item.name, categoryId, menuType: 'AC', price: item.acPrice },
          { name: item.name, categoryId, menuType: 'SWIGGY', price: item.swiggyPrice },
          { name: item.name, categoryId, menuType: 'ZOMATO', price: item.zomatoPrice },
        );
      }
      await tx.menuItem.createMany({ data: items });
      summary.push(`${items.length} sample menu items across 4 menus`);
    }

    if (await tx.supplier.count() === 0) {
      await tx.supplier.createMany({ data: SAMPLE_PURCHASE_TYPES });
      summary.push(`${SAMPLE_PURCHASE_TYPES.length} purchase types`);
    }

    return summary;
  }, { timeout: 60000 });

  for (const line of created) console.log(`Created ${line}.`);
  console.log('Seed completed!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
