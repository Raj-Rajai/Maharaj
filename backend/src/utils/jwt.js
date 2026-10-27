import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// Secrets must come from the environment — never hardcode fallbacks here.
const PRIMARY_JWT_SECRET = process.env.JWT_SECRET;
const PRIMARY_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!PRIMARY_JWT_SECRET || !PRIMARY_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in the environment');
}

export const generateAccessToken = (payload) => {
  return jwt.sign(payload, PRIMARY_JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, PRIMARY_REFRESH_SECRET, { expiresIn: '7d' });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, PRIMARY_JWT_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, PRIMARY_REFRESH_SECRET);
};
