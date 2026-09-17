import prisma from '../utils/prisma.js';
import { hashPassword } from '../utils/password.js';
import { userAuthCache, tableCache } from '../utils/cache.js';

export const updatePermissions = async (userId, permissions) => {
  // Atomic: delete old + create new in one transaction
  await prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { userId } });
    if (permissions && permissions.length > 0) {
      for (const p of permissions) {
        await tx.$queryRawUnsafe(
          'INSERT INTO `UserPermission` (`id`, `userId`, `permission`, `createdAt`) VALUES (UUID(), ?, ?, NOW(3))',
          userId,
          p
        );
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

  const allPerms = await prisma.$queryRawUnsafe(
    'SELECT `userId`, `permission` FROM `UserPermission`'
  );

  const permsByUserId = {};
  for (const p of (allPerms || [])) {
    if (!permsByUserId[p.userId]) permsByUserId[p.userId] = [];
    permsByUserId[p.userId].push({ permission: p.permission });
  }

  return users.map(u => ({
    ...u,
    permissions: permsByUserId[u.id] || []
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

  const permRows = await prisma.$queryRawUnsafe(
    'SELECT `permission` FROM `UserPermission` WHERE `userId` = ?',
    id
  );

  return {
    ...user,
    permissions: (permRows || []).map(p => ({ permission: p.permission }))
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
        await tx.$queryRawUnsafe(
          'INSERT INTO `UserPermission` (`id`, `userId`, `permission`, `createdAt`) VALUES (UUID(), ?, ?, NOW(3))',
          user.id,
          p
        );
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
      await tx.userPermission.deleteMany({ where: { userId: id } });
      if (permissions.length > 0) {
        for (const p of permissions) {
          await tx.$queryRawUnsafe(
            'INSERT INTO `UserPermission` (`id`, `userId`, `permission`, `createdAt`) VALUES (UUID(), ?, ?, NOW(3))',
            id,
            p
          );
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
