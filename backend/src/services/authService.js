import prisma from '../utils/prisma.js';
import { comparePassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { userAuthCache } from '../utils/cache.js';

export const login = async (username, password) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { permissions: { select: { permission: true } } }
  });
  if (!user) {
    throw { status: 401, message: 'Invalid credentials' };
  }

  if (!user.active) {
    throw { status: 403, message: 'Account is inactive' };
  }

  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    throw { status: 401, message: 'Invalid credentials' };
  }

  const accessToken = generateAccessToken({ id: user.id, role: user.role });
  const refreshToken = generateRefreshToken({ id: user.id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt
    }
  });

  const permissionsList = user.permissions.map(p => p.permission);
  userAuthCache.set(user.id, {
    id: user.id,
    role: user.role,
    active: user.active,
    permissions: permissionsList,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions: permissionsList,
    }
  };
};

export const refreshAccessToken = async (token) => {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token }
  });

  if (!storedToken) {
    throw { status: 401, message: 'Invalid refresh token' };
  }

  if (new Date() > storedToken.expiresAt) {
    await prisma.refreshToken.delete({ where: { token } });
    throw { status: 401, message: 'Refresh token expired' };
  }

  const decoded = verifyRefreshToken(token);
  if (!decoded) {
    throw { status: 401, message: 'Invalid refresh token' };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, role: true, active: true }
  });
  if (!user || !user.active) {
    throw { status: 401, message: 'Invalid user or inactive' };
  }

  const accessToken = generateAccessToken({ id: user.id, role: user.role });
  return { accessToken };
};

export const logout = async (token, userId) => {
  if (token) {
    try {
      await prisma.refreshToken.delete({ where: { token } });
    } catch (e) {

    }
  }
  if (userId) {
    userAuthCache.invalidate(userId);
  }
};

export const getProfile = async (userId) => {
  const cached = userAuthCache.getProfile(userId);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      active: true,
      permissions: { select: { permission: true } }
    }
  });

  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  const profile = {
    ...user,
    permissions: user.permissions.map(p => p.permission)
  };
  userAuthCache.setProfile(userId, profile);
  return profile;
};
