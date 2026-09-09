import { verifyAccessToken } from '../utils/jwt.js';
import prisma from '../utils/prisma.js';
import { userAuthCache } from '../utils/cache.js';

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
      dbUser = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, role: true, active: true }
      });
      if (dbUser) {
        userAuthCache.set(payload.id, dbUser);
      }
    }

    if (!dbUser) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!dbUser.active) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    req.user = { id: dbUser.id, role: dbUser.role };
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
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Check if user has ANY of the required permissions
      const userPermission = await prisma.userPermission.findFirst({
        where: {
          userId: req.user.id,
          permission: { in: permissions }
        }
      });

      if (!userPermission) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
