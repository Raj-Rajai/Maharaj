import prisma from './prisma.js';

export const ALL_PERMISSIONS = [
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

export const ROLE_DEFAULT_PERMISSIONS = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS.filter(p => !['USER_CREATE', 'USER_EDIT', 'USER_DELETE'].includes(p)),
  AC_MASTER: [
    'TABLE_VIEW', 'MENU_AC_VIEW', 'ORDER_CREATE', 'ORDER_EDIT',
    'KOT_CREATE', 'KOT_VIEW', 'KOT_PRINT', 'BILL_VIEW_DRAFT',
    'NOTIFICATION_KOT_AC', 'NOTIFICATION_BILL_AC'
  ],
  NON_AC_MASTER: [
    'TABLE_VIEW', 'MENU_NON_AC_VIEW', 'ORDER_CREATE', 'ORDER_EDIT',
    'KOT_CREATE', 'KOT_VIEW', 'KOT_PRINT', 'BILL_VIEW_DRAFT',
    'NOTIFICATION_KOT_NON_AC', 'NOTIFICATION_BILL_NON_AC'
  ],
};

export function getDefaultPermissionsForRole(role) {
  return ROLE_DEFAULT_PERMISSIONS[role] || [];
}

/**
 * Safely fetches a user's permissions:
 * 1. SUPER_ADMIN always gets ALL_PERMISSIONS without DB lookup.
 * 2. Attempts raw SQL SELECT from UserPermission to avoid Prisma client-side enum validation.
 * 3. Falls back to lowercase table name if needed for Linux MySQL compatibility.
 * 4. Falls back to default permissions for the user's role on any error or empty result.
 * 5. NEVER throws an exception.
 */
export async function fetchUserPermissions(userId, role) {
  if (role === 'SUPER_ADMIN') {
    return ALL_PERMISSIONS;
  }

  if (!userId) {
    return getDefaultPermissionsForRole(role);
  }

  try {
    const permRows = await prisma.$queryRawUnsafe(
      'SELECT `permission` FROM `UserPermission` WHERE `userId` = ?',
      userId
    );
    if (Array.isArray(permRows) && permRows.length > 0) {
      const perms = permRows.map(p => p.permission || p.PERMISSION).filter(Boolean);
      if (perms.length > 0) return perms;
    }
  } catch (err1) {
    try {
      const permRows = await prisma.$queryRawUnsafe(
        'SELECT `permission` FROM `userpermission` WHERE `userId` = ?',
        userId
      );
      if (Array.isArray(permRows) && permRows.length > 0) {
        const perms = permRows.map(p => p.permission || p.PERMISSION).filter(Boolean);
        if (perms.length > 0) return perms;
      }
    } catch (err2) {
      console.warn('[Permissions] Fallback raw query failed:', err2.message);
    }
  }

  return getDefaultPermissionsForRole(role);
}
