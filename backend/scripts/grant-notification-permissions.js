import prisma from '../src/utils/prisma.js';

async function grantPermissions() {
  console.log('Granting notification permissions to existing users...\n');

  // 1. Admin & Super Admin -> all 4 notification permissions
  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true, username: true, role: true },
  });

  const allNotificationPerms = [
    'NOTIFICATION_KOT_AC',
    'NOTIFICATION_KOT_NON_AC',
    'NOTIFICATION_BILL_AC',
    'NOTIFICATION_BILL_NON_AC',
  ];

  for (const user of adminUsers) {
    for (const perm of allNotificationPerms) {
      await prisma.userPermission.upsert({
        where: {
          userId_permission: { userId: user.id, permission: perm },
        },
        create: { userId: user.id, permission: perm },
        update: {},
      }).catch(() => {});
    }
    console.log(`  ✓ Granted all 4 notification permissions to ${user.username} (${user.role})`);
  }

  // 2. AC Master users -> AC KOT + AC Bill permissions
  const acMasters = await prisma.user.findMany({
    where: { role: 'AC_MASTER' },
    select: { id: true, username: true },
  });
  for (const user of acMasters) {
    for (const perm of ['NOTIFICATION_KOT_AC', 'NOTIFICATION_BILL_AC']) {
      await prisma.userPermission.upsert({
        where: {
          userId_permission: { userId: user.id, permission: perm },
        },
        create: { userId: user.id, permission: perm },
        update: {},
      }).catch(() => {});
    }
    console.log(`  ✓ Granted AC notification permissions to ${user.username}`);
  }

  // 3. Non-AC Master users -> Non-AC KOT + Non-AC Bill permissions
  const nonAcMasters = await prisma.user.findMany({
    where: { role: 'NON_AC_MASTER' },
    select: { id: true, username: true },
  });
  for (const user of nonAcMasters) {
    for (const perm of ['NOTIFICATION_KOT_NON_AC', 'NOTIFICATION_BILL_NON_AC']) {
      await prisma.userPermission.upsert({
        where: {
          userId_permission: { userId: user.id, permission: perm },
        },
        create: { userId: user.id, permission: perm },
        update: {},
      }).catch(() => {});
    }
    console.log(`  ✓ Granted Non-AC notification permissions to ${user.username}`);
  }

  console.log('\nAll notification permissions updated successfully!');
}

grantPermissions()
  .catch((e) => {
    console.error('Error granting permissions:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
