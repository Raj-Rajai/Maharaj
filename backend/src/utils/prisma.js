import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

const basePrisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  transactionOptions: {
    maxWait: 15000,
    timeout: 60000,
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

// Auto-retry wrapper for transient Prisma connection errors (Supabase PgBouncer)
const MAX_RETRIES = 3;
const RETRY_DELAY = 800;
const RETRYABLE_CODES = new Set(['P1017', 'P1001', 'P1002', 'P2024']);

async function withRetry(fn, label) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = RETRYABLE_CODES.has(err?.code) ||
        err?.message?.includes('Server has closed the connection') ||
        err?.message?.includes("Can't reach database server") ||
        err?.message?.includes('Connection reset') ||
        err?.message?.includes('ECONNRESET');
      if (isRetryable && attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAY * (attempt + 1);
        console.warn(`[Prisma] ${err.code || 'CONN_ERR'} retry ${attempt + 1}/${MAX_RETRIES} for ${label} (wait ${delay}ms)`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// Create a proxy that wraps every Prisma model method + $transaction/$queryRaw with retry logic
function createRetryProxy(client) {
  return new Proxy(client, {
    get(target, prop) {
      const value = target[prop];

      // Wrap $transaction with retry
      if (prop === '$transaction') {
        return async function (...args) {
          return withRetry(() => value.apply(target, args), '$transaction');
        };
      }

      // Wrap $queryRaw / $executeRaw / $queryRawUnsafe / $executeRawUnsafe
      if (prop === '$queryRaw' || prop === '$executeRaw' || prop === '$queryRawUnsafe' || prop === '$executeRawUnsafe') {
        return function (...args) {
          // These return a PrismaPromise, need to wrap the execution
          return withRetry(() => value.apply(target, args), prop);
        };
      }

      // Pass through non-model properties
      if (typeof prop === 'symbol' || prop.startsWith('$') || prop.startsWith('_') || typeof value !== 'object' || value === null) {
        return value;
      }

      // Wrap model objects (user, bill, order, etc.)
      return new Proxy(value, {
        get(modelTarget, methodName) {
          const method = modelTarget[methodName];
          if (typeof method !== 'function') return method;

          return function (...args) {
            return withRetry(
              () => method.apply(modelTarget, args),
              `${String(prop)}.${String(methodName)}`
            );
          };
        },
      });
    },
  });
}

const prisma = createRetryProxy(basePrisma);

export default prisma;
