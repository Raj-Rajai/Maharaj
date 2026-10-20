import { verifyAccessToken } from '../utils/jwt.js';
import prisma from '../utils/prisma.js';
import { userAuthCache } from '../utils/cache.js';
import { fetchUserPermissions } from '../utils/permissions.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    // JWT verification failed (signature mismatch, expired) -> Genuine 401
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    // Check in-memory user cache first (avoids remote DB query on every request)
    let dbUser = userAuthCache.get(payload.id);
    if (!dbUser) {
      const userRecord = await prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          role: true,
          active: true,
        }
      });
      if (userRecord) {
        const permissionsList = await fetchUserPermissions(userRecord.id, userRecord.role);
        dbUser = {
          id: userRecord.id,
          role: userRecord.role,
          active: userRecord.active,
          permissions: permissionsList
        };
        userAuthCache.set(payload.id, dbUser);
      }
    }

    if (!dbUser) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!dbUser.active) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    req.user = {
      id: dbUser.id,
      role: dbUser.role,
      permissions: dbUser.permissions || []
    };
    next();
  } catch (error) {
    // Database connection error must NOT be returned as 401!
    // Returning 401 makes frontend erase localStorage and log user out.
    // Instead forward to errorHandler (returns 503 retryable).
    next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

// Granular permission check middleware
// SUPER_ADMIN automatically passes all permission checks
// Other roles must have the specific permission assigned in UserPermission table
export const requirePermission = (...permissions) => {
  return async (req, res, next) => {
    try {
      // SUPER_ADMIN bypasses all permission checks
      if (req.user?.role === 'SUPER_ADMIN') {
        return next();
      }

      // Check in-memory permissions attached by authenticate middleware (0 DB roundtrips)
      const userPermissions = req.user?.permissions;
      if (Array.isArray(userPermissions)) {
        const hasPermission = permissions.some(p => userPermissions.includes(p));
        if (hasPermission) {
          return next();
        }
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      // Safe fallback: If permissions array was not loaded on req.user, fetch safely
      const userPerms = await fetchUserPermissions(req.user.id, req.user.role);
      const hasPerm = permissions.some(p => userPerms.includes(p));

      if (!hasPerm) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
