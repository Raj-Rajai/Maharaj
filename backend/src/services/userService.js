import crypto from 'node:crypto';
import prisma from '../utils/prisma.js';
import { hashPassword } from '../utils/password.js';
import { userAuthCache, tableCache } from '../utils/cache.js';
import { fetchUserPermissions, getDefaultPermissionsForRole } from '../utils/permissions.js';

export const updatePermissions = async (userId, permissions) => {
  // Atomic: delete old + create new in one transaction
  await prisma.$transaction(async (tx) => {
    try {
      await tx.userPermission.deleteMany({ where: { userId } });
    } catch {
      await tx.$queryRawUnsafe('DELETE FROM `UserPermission` WHERE `userId` = ?', userId).catch(() => {});
    }
    if (permissions && permissions.length > 0) {
      for (const p of permissions) {
        const id = crypto.randomUUID();
        const now = new Date();
        try {
          await tx.$queryRawUnsafe(
            'INSERT INTO `UserPermission` (`id`, `userId`, `permission`, `createdAt`) VALUES (?, ?, ?, ?)',
            id,
            userId,
            p,
            now
          );
        } catch {
          await tx.$queryRawUnsafe(
            'INSERT INTO `userpermission` (`id`, `userId`, `permission`, `createdAt`) VALUES (?, ?, ?, ?)',
            id,
            userId,
            p,
            now
          ).catch(e => console.error('[User] Insert permission fallback error:', e.message));
        }
      }
    }
  });
  userAuthCache.invalidate(userId);
};

export const getAll = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      active: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (users.length === 0) return [];

  let allPerms = [];
  try {
    allPerms = await prisma.$queryRawUnsafe(
      'SELECT `userId`, `permission` FROM `UserPermission`'
    );
  } catch {
    try {
      allPerms = await prisma.$queryRawUnsafe(
        'SELECT `userId`, `permission` FROM `userpermission`'
      );
    } catch (e) {
      console.warn('[User] Could not load permissions table via raw SQL:', e.message);
    }
  }

  const permsByUserId = {};
  for (const p of (allPerms || [])) {
    const uId = p.userId || p.USERID;
    const perm = p.permission || p.PERMISSION;
    if (uId && perm) {
      if (!permsByUserId[uId]) permsByUserId[uId] = [];
      permsByUserId[uId].push({ permission: perm });
    }
  }

  return users.map(u => ({
    ...u,
    permissions: permsByUserId[u.id] || getDefaultPermissionsForRole(u.role).map(p => ({ permission: p }))
  }));
};

export const getById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      active: true,
      createdAt: true
    }
  });

  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  const perms = await fetchUserPermissions(id, user.role);

  return {
    ...user,
    permissions: perms.map(p => ({ permission: p }))
  };
};

export const create = async (data) => {
  const existingUser = await prisma.user.findUnique({
    where: { username: data.username }
  });

  if (existingUser) {
    throw { status: 400, message: 'Username already exists' };
  }

  const hashedPassword = await hashPassword(data.password);
  const { permissions, ...userData } = data;

  // Atomic: create user + permissions in one transaction
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        ...userData,
        password: hashedPassword
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        createdAt: true
      }
    });

    if (permissions && permissions.length > 0) {
      for (const p of permissions) {
        const id = crypto.randomUUID();
        const now = new Date();
        try {
          await tx.$queryRawUnsafe(
            'INSERT INTO `UserPermission` (`id`, `userId`, `permission`, `createdAt`) VALUES (?, ?, ?, ?)',
            id,
            user.id,
            p,
            now
          );
        } catch {
          await tx.$queryRawUnsafe(
            'INSERT INTO `userpermission` (`id`, `userId`, `permission`, `createdAt`) VALUES (?, ?, ?, ?)',
            id,
            user.id,
            p,
            now
          ).catch(e => console.error('[User] Create permission fallback error:', e.message));
        }
      }
    }

    return user;
  });
};

export const update = async (id, data) => {
  const existingUser = await prisma.user.findUnique({ where: { id } });

  if (!existingUser) {
    throw { status: 404, message: 'User not found' };
  }

  const { permissions, ...updateData } = data;
  if (updateData.password) {
    updateData.password = await hashPassword(updateData.password);
  }

  // Atomic: update user + permissions in one transaction
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        createdAt: true
      }
    });

    if (permissions) {
      try {
        await tx.userPermission.deleteMany({ where: { userId: id } });
      } catch {
        await tx.$queryRawUnsafe('DELETE FROM `UserPermission` WHERE `userId` = ?', id).catch(() => {});
      }
      if (permissions.length > 0) {
        for (const p of permissions) {
          const permId = crypto.randomUUID();
          const now = new Date();
          try {
            await tx.$queryRawUnsafe(
              'INSERT INTO `UserPermission` (`id`, `userId`, `permission`, `createdAt`) VALUES (?, ?, ?, ?)',
              permId,
              id,
              p,
              now
            );
          } catch {
            await tx.$queryRawUnsafe(
              'INSERT INTO `userpermission` (`id`, `userId`, `permission`, `createdAt`) VALUES (?, ?, ?, ?)',
              permId,
              id,
              p,
              now
            ).catch(e => console.error('[User] Update permission fallback error:', e.message));
          }
        }
      }
    }

    userAuthCache.invalidate(id);
    tableCache.invalidate();
    return user;
  });
};

export const updateStatus = async (id, active) => {
  const existingUser = await prisma.user.findUnique({ where: { id } });

  if (!existingUser) {
    throw { status: 404, message: 'User not found' };
  }

  const user = await prisma.user.update({
    where: { id },
    data: { active },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      active: true,
      createdAt: true
    }
  });

  userAuthCache.invalidate(id);
  tableCache.invalidate();
  return user;
};

export const remove = async (id, currentUserId) => {
  if (id === currentUserId) {
    throw { status: 400, message: 'You cannot delete your own account' };
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }
  if (user.role === 'SUPER_ADMIN') {
    throw { status: 403, message: 'Super Admin accounts cannot be deleted' };
  }

  // Atomic: delete permissions + tokens + user in one transaction
  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { userId: id } });
    await tx.refreshToken.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });

  userAuthCache.invalidate(id);
  tableCache.invalidate();
  return { message: 'User deleted successfully' };
};
