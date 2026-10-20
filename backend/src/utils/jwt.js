import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const PRIMARY_JWT_SECRET = process.env.JWT_SECRET || 'REMOVED_SECRET';
const PRIMARY_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'REMOVED_SECRET';

const JWT_SECRETS = Array.from(new Set([
  process.env.JWT_SECRET,
  'REMOVED_SECRET',
  'REMOVED_SECRET'
].filter(Boolean)));

const REFRESH_SECRETS = Array.from(new Set([
  process.env.JWT_REFRESH_SECRET,
  'REMOVED_SECRET',
  'REMOVED_SECRET'
].filter(Boolean)));

export const generateAccessToken = (payload) => {
  return jwt.sign(payload, PRIMARY_JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, PRIMARY_REFRESH_SECRET, { expiresIn: '7d' });
};

export const verifyAccessToken = (token) => {
  for (const secret of JWT_SECRETS) {
    try {
      return jwt.verify(token, secret);
    } catch (e) {
      if (e.name !== 'JsonWebTokenError') throw e;
    }
  }
  return jwt.verify(token, PRIMARY_JWT_SECRET);
};

export const verifyRefreshToken = (token) => {
  for (const secret of REFRESH_SECRETS) {
    try {
      return jwt.verify(token, secret);
    } catch (e) {
      if (e.name !== 'JsonWebTokenError') throw e;
    }
  }
  return jwt.verify(token, PRIMARY_REFRESH_SECRET);
};
