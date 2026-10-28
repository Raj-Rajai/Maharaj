/**
 * One-off: give existing users a permission that a release added to their role's defaults.
 *
 * prisma/seed.js never changes existing users' permissions, so after a deploy that adds a
 * permission to ROLE_DEFAULT_PERMISSIONS (src/utils/permissions.js):
 *   - SUPER_ADMIN users already have it (they get every permission at runtime);
 *   - users with no permission rows already have it (they follow their role's defaults);
 *   - users with explicit permissions do not, until it is ticked for them in User
 *     Management or granted here.
 *
 * For each permission given, this adds it to every user whose role has it by default and
 * who has explicit permission rows without it. It only inserts rows, never removes one.
 * Users without rows are left alone: a single row would replace all of their role
 * defaults with just that permission. Run it once, right after the deploy that adds the
 * permission; a later run would re-grant it to anyone an admin has since taken it from.
 *
 * Usage, from the repo root (dry run unless --apply is given):
 *   node backend/scripts/grant-permission.js TABLE_CHANGE
 *   node backend/scripts/grant-permission.js TABLE_CHANGE --apply
 */
import prisma, { rawQuery } from '../src/utils/prisma.js';
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '../src/utils/permissions.js';

async function grantPermissions() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const permissions = args.filter((a) => !a.startsWith('--'));

  if (permissions.length === 0) {
    throw new Error('Usage: node backend/scripts/grant-permission.js <PERMISSION> [<PERMISSION>...] [--apply]');
  }
  const unknown = permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
  if (unknown.length > 0) {
    throw new Error(`Unknown permission(s): ${unknown.join(', ')}`);
  }

  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true },
    orderBy: { username: 'asc' },
  });

  // Raw SQL like fetchUserPermissions, so the read never trips Prisma's enum validation
  const permsByUserId = new Map();
  for (const row of await rawQuery('SELECT `userId`, `permission` FROM `UserPermission`')) {
    if (!permsByUserId.has(row.userId)) permsByUserId.set(row.userId, new Set());
    permsByUserId.get(row.userId).add(row.permission);
  }

  const toCreate = [];
  for (const permission of permissions) {
    const grant = [];
    const alreadyHas = [];
    const usesRoleDefaults = [];
    for (const user of users) {
      if (!ROLE_DEFAULT_PERMISSIONS[user.role]?.includes(permission)) continue;
      const own = permsByUserId.get(user.id);
      if (!own) {
        usesRoleDefaults.push(user.username);
      } else if (own.has(permission)) {
        alreadyHas.push(user.username);
      } else {
        grant.push(user.username);
        toCreate.push({ userId: user.id, permission });
      }
    }
    console.log(`${permission}`);
    console.log(`  grant to:                    ${grant.join(', ') || '-'}`);
    console.log(`  already have it:             ${alreadyHas.join(', ') || '-'}`);
    console.log(`  skipped, use role defaults:  ${usesRoleDefaults.join(', ') || '-'}`);
  }

  if (!apply) {
    console.log('\nDry run: nothing written. Re-run with --apply to grant.');
    return;
  }
  if (toCreate.length === 0) {
    console.log('\nNothing to grant.');
    return;
  }

  const { count } = await prisma.userPermission.createMany({ data: toCreate, skipDuplicates: true });
  console.log(`\nGranted ${count} permission(s). Users get them on their next page load (the server caches permissions for up to 30s).`);
}

grantPermissions()
  .catch((e) => {
    console.error('Error granting permissions:', e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
