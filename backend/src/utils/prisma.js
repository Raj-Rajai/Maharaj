import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

const globalForPrisma = globalThis;

// Transaction context to distinguish standalone queries from interactive transactions
const txStorage = new AsyncLocalStorage();

// Check for PgBouncer transaction mode warning if port 6543 is configured without pgbouncer=true
const dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.includes(':6543') && !dbUrl.includes('pgbouncer=true')) {
  console.warn(
    '[Prisma Warning] DATABASE_URL connects via port 6543 (PgBouncer transaction mode) but is missing ?pgbouncer=true. ' +
    'Prepared statements may fail without this flag.'
  );
}

const basePrisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  transactionOptions: {
    maxWait: 4000,
    timeout: 15000,
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

// Retry configuration
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 150;
const MAX_RETRY_DELAY = 1500;

// Retryable error codes across Prisma, PostgreSQL, and connection pools
const RETRYABLE_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server reached but timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection (PgBouncer idle drop)
  'P2024', // Timed out fetching a new connection from the connection pool
  'P2028', // Transaction API error (transaction expired/closed)
  'P2034', // Transaction failed due to write conflict or deadlock
  '40001', // PostgreSQL serialization_failure
  '40P01', // PostgreSQL deadlock_detected
  '57P01', // PostgreSQL admin_shutdown
  '57P02', // PostgreSQL crash_shutdown
  '57P03', // PostgreSQL cannot_connect_now
  '08000', '08001', '08003', '08004', '08006', // PostgreSQL connection exceptions
]);

const RETRYABLE_MESSAGES = [
  'server has closed the connection',
  "can't reach database server",
  'connection reset',
  'econnreset',
  'connection terminated unexpectedly',
  'connection lost',
  'socket hang up',
  'etimedout',
  'epipe',
  'deadlock detected',
  'could not serialize access',
  'timed out fetching a new connection',
  'prepared statement',
];

export function isConnectionError(err) {
  if (!err) return false;
  const code = String(err.code || err.meta?.code || '');
  if (code && RETRYABLE_CODES.has(code)) return true;
  const msg = (err.message || '').toLowerCase();
  return RETRYABLE_MESSAGES.some((m) => msg.includes(m));
}

function computeBackoff(attempt) {
  // Full jitter exponential backoff: delay in [50, min(MAX_DELAY, BASE_DELAY * 2^attempt)]
  const maxWait = Math.min(MAX_RETRY_DELAY, BASE_RETRY_DELAY * Math.pow(2, attempt));
  return Math.floor(Math.random() * maxWait) + 50;
}

async function withRetry(fn, label) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isConnectionError(err) && attempt < MAX_RETRIES - 1) {
        const delay = computeBackoff(attempt);
        console.warn(
          `[Prisma Retry] ${err.code || 'CONN_ERR'} on attempt ${attempt + 1}/${MAX_RETRIES} for "${label}". Retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Official Prisma 6 Client Extension ($extends)
// Replaces fragile JavaScript Proxy to preserve PrismaPromise and array transactions
const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const inTx = txStorage.getStore()?.inTransaction;
        // If inside an interactive transaction, do NOT perform single-query retry.
        // Let the error bubble up to $transaction so the entire transaction can retry cleanly.
        if (inTx) {
          return query(args);
        }
        // Standalone query: retry on transient connection drops
        return withRetry(() => query(args), `${model}.${operation}`);
      },
    },
  },
  client: {
    async $transaction(...args) {
      const [arg1, arg2] = args;
      // Array transaction: prisma.$transaction([ op1, op2 ])
      if (Array.isArray(arg1)) {
        return withRetry(() => basePrisma.$transaction(arg1, arg2), '$transaction[array]');
      }
      // Interactive transaction: prisma.$transaction(async (tx) => { ... })
      if (typeof arg1 === 'function') {
        return withRetry(() => {
          return txStorage.run({ inTransaction: true }, () => {
            return basePrisma.$transaction(arg1, arg2);
          });
        }, '$transaction(interactive)');
      }
      return basePrisma.$transaction(...args);
    },
  },
});

// Periodic keep-alive ping every 3 minutes to prevent PgBouncer / Supabase dropping idle TCP connections
// .unref() ensures this timer does not prevent process termination
const keepAliveInterval = setInterval(async () => {
  try {
    await basePrisma.$queryRaw`SELECT 1`;
  } catch {
    // Silently ignore ping blip - next user request will reconnect or retry cleanly
  }
}, 3 * 60 * 1000);
keepAliveInterval.unref();

// Graceful shutdown: close database connections cleanly on process exit signals
const gracefulShutdown = async (signal) => {
  clearInterval(keepAliveInterval);
  try {
    await basePrisma.$disconnect();
  } catch {}
};
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default prisma;
