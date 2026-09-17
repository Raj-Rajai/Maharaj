import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { requestTimingStorage } from '../middleware/requestTiming.js';

const globalForPrisma = globalThis;

// Transaction context to distinguish standalone queries from interactive transactions
const txStorage = new AsyncLocalStorage();

// DIAGNOSTIC: log any single DB query slower than this, regardless of request.
// Helps tell "the database itself is slow" apart from "the host is slow".
const SLOW_QUERY_MS = 150;


function getOptimalDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL || '';
  if (!rawUrl || rawUrl.startsWith('mysql')) {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl);
    // If connecting to Supabase pooler, preserve user-selected mode (5432 = session, 6543 = transaction)
    if (url.hostname.includes('pooler.supabase.com')) {
      if (url.port === '6543') {
        url.searchParams.set('pgbouncer', 'true');
      }
      const currentLimit = parseInt(url.searchParams.get('connection_limit') || '10', 10);
      if (currentLimit > 5) {
        url.searchParams.set('connection_limit', '5');
      }
      return url.toString();
    }

    if (url.protocol.startsWith('postgres')) {
      const currentLimit = parseInt(url.searchParams.get('connection_limit') || '10', 10);
      if (currentLimit > 5) {
        url.searchParams.set('connection_limit', '5');
      }
      return url.toString();
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

const optimalDbUrl = getOptimalDatabaseUrl();

const basePrisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: optimalDbUrl ? {
    db: {
      url: optimalDbUrl,
    },
  } : undefined,
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

// Retryable error codes across Prisma, PostgreSQL, MySQL, and connection pools
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
  '1213', 'ER_LOCK_DEADLOCK', // MySQL deadlock detected
  '1205', 'ER_LOCK_WAIT_TIMEOUT', // MySQL lock wait timeout
  'PROTOCOL_CONNECTION_LOST', // MySQL connection dropped
  'ECONNREFUSED',
]);

const RETRYABLE_MESSAGES = [
  'emaxconnsession',
  'max clients reached',
  'pool_size',
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
  'deadlock found when trying to get lock',
  'lock wait timeout exceeded',
  'could not serialize access',
  'timed out fetching a new connection',
  'prepared statement',
  'query execution was interrupted',
];

export function isConnectionError(err) {
  if (!err) return false;
  const code = String(err.code || err.meta?.code || '');
  if (code && RETRYABLE_CODES.has(code)) return true;
  const msg = (err.message || '').toLowerCase();
  return RETRYABLE_MESSAGES.some((m) => msg.includes(m));
}

export const isMySQL = () => (process.env.DATABASE_URL || '').startsWith('mysql');

/**
 * Flatten a Prisma/driver error into one log-friendly line.
 * Retry and error-handler logs previously printed only `err.code`, which is
 * undefined for most driver-level errors — hiding whether a failure was a real
 * connection drop, a pool timeout, or a query rejected by the database.
 */
export function describeDbError(err) {
  if (!err) return 'unknown error';
  const parts = [];
  if (err.code) parts.push(`code=${err.code}`);
  if (err.name) parts.push(`name=${err.name}`);
  if (err.errno !== undefined) parts.push(`errno=${err.errno}`);
  if (err.meta) {
    try {
      parts.push(`meta=${JSON.stringify(err.meta)}`);
    } catch {
      // not serializable — keep the rest of the line
    }
  }
  if (err.message) {
    parts.push(`message=${String(err.message).replace(/\s+/g, ' ').trim()}`);
  }
  return parts.length > 0 ? parts.join(' ') : String(err);
}

export function translateQueryForDialect(sql, params = []) {
  if (isMySQL()) {
    const mysqlParams = params.map((p) => (p instanceof Date ? p.toISOString().slice(0, 19).replace('T', ' ') : p));
    return { sql, params: mysqlParams };
  }

  let pgSql = sql;

  // 1. Cast enum comparisons for PostgreSQL:
  pgSql = pgSql.replace(/([a-zA-Z_0-9.]+)\.status\s*=\s*\?/g, '$1.status::text = ?');
  pgSql = pgSql.replace(/([a-zA-Z_0-9.]+)\.status\s+IN\s*\(([^)]+)\)/g, '$1.status::text IN ($2)');

  // 2. Replace backticks `Word` with "Word"
  pgSql = pgSql.replace(/`([^`]+)`/g, '"$1"');

  // 3. List of camelCase identifiers that must be quoted in double quotes in Postgres:
  const camelCaseIdentifiers = [
    'kotNumber', 'orderId', 'sessionId', 'captainId', 'createdAt', 'updatedAt',
    'orderSource', 'tableId', 'itemNameSnapshot', 'priceSnapshot', 'originalQuantity',
    'menuItemId', 'kotId', 'sgstAmount', 'cgstAmount', 'sgstPercent', 'cgstPercent',
    'finalizedAt', 'customerName', 'customerPhone', 'roundOff', 'lowStockThreshold',
    'currentStock', 'inventoryItemId', 'billNumber', 'billId', 'paidAt', 'userId'
  ];

  for (const id of camelCaseIdentifiers) {
    const regex = new RegExp(`(?<!")\\b${id}\\b(?!")`, 'g');
    pgSql = pgSql.replace(regex, `"${id}"`);
  }

  // 4. Replace ? with $1, $2, $3...
  let paramIndex = 1;
  pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

  return { sql: pgSql, params };
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
          `[Prisma Retry] attempt ${attempt + 1}/${MAX_RETRIES} for "${label}": ${describeDbError(err)}. Retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // Out of retries, or not retryable: log the real error here, because the
      // error handler flattens connection-classified errors into a generic 503.
      console.error(
        `[Prisma Fail] "${label}" after ${attempt + 1} attempt(s): ${describeDbError(err)}`
      );
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
        const label = `${model}.${operation}`;
        const start = process.hrtime.bigint();
        try {
          // If inside an interactive transaction, do NOT perform single-query retry.
          // Let the error bubble up to $transaction so the entire transaction can retry cleanly.
          if (inTx) {
            return await query(args);
          }
          // Standalone query: retry on transient connection drops
          return await withRetry(() => query(args), label);
        } finally {
          // DIAGNOSTIC TIMING — attribute this query's duration to the in-flight
          // HTTP request (if any) so requestTiming.js can report db-time vs total-time,
          // and flag any individually slow query for direct comparison against Supabase's
          // own dashboard timings.
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          const reqStore = requestTimingStorage.getStore();
          if (reqStore) {
            reqStore.dbTimeMs += durationMs;
            reqStore.dbQueryCount += 1;
          }
          if (durationMs > SLOW_QUERY_MS) {
            console.log(`[DB Timing] ${label} took ${durationMs.toFixed(1)}ms`);
          }
        }
      },
    },
  },
  client: {
    async $queryRawUnsafe(sql, ...params) {
      const translated = translateQueryForDialect(sql, params);
      return withRetry(() => basePrisma.$queryRawUnsafe(translated.sql, ...translated.params), '$queryRawUnsafe');
    },
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
            return basePrisma.$transaction(async (tx) => {
              const txProxy = new Proxy(tx, {
                get(target, prop, receiver) {
                  if (prop === '$queryRawUnsafe') {
                    return (sql, ...params) => {
                      const translated = translateQueryForDialect(sql, params);
                      return target.$queryRawUnsafe(translated.sql, ...translated.params);
                    };
                  }
                  return Reflect.get(target, prop, receiver);
                },
              });
              return arg1(txProxy);
            }, arg2);
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
