/**
 * Database diagnostics for the production server.
 *
 *   node scripts/db-diagnose.js      (run from the backend/ directory)
 *
 * The API flattens every connection-classified failure into a generic
 * "Database connection temporarily unavailable, please retry" 503, which hides
 * whether the real cause is a wrong-provider Prisma client, an exhausted
 * connection pool, a query killed by MySQL, or a genuine connection drop.
 * This script checks each of those directly.
 *
 * It never prints database credentials.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendDir, '.env') });

const line = () => console.log('-'.repeat(68));
const ok = (m) => console.log(`  [ OK ]  ${m}`);
const warn = (m) => console.log(`  [WARN]  ${m}`);
const bad = (m) => console.log(`  [FAIL]  ${m}`);

const num = (v) => (typeof v === 'bigint' ? Number(v) : v);

async function main() {
  let failures = 0;

  // ---------------------------------------------------------------- target --
  line();
  console.log('1. CONNECTION TARGET');
  line();
  const rawUrl = process.env.DATABASE_URL || '';
  if (!rawUrl) {
    bad('DATABASE_URL is not set. Is backend/.env present on this server?');
    process.exit(1);
  }
  let urlProtocol = rawUrl.split(':')[0];
  let connectionLimit = null;
  try {
    const u = new URL(rawUrl);
    urlProtocol = u.protocol.replace(':', '');
    connectionLimit = u.searchParams.get('connection_limit');
    // host/port/db only — never user:password
    console.log(`  protocol         : ${urlProtocol}`);
    console.log(`  host:port        : ${u.hostname}:${u.port || '(default)'}`);
    console.log(`  database         : ${u.pathname.replace('/', '')}`);
    console.log(`  connection_limit : ${connectionLimit || '(not set — Prisma default)'}`);
    console.log(`  pool_timeout     : ${u.searchParams.get('pool_timeout') || '(not set — default 10s)'}`);
  } catch {
    console.log(`  protocol         : ${urlProtocol}`);
  }
  const cpus = os.cpus()?.length || 1;
  const effectivePool = connectionLimit ? Number(connectionLimit) : cpus * 2 + 1;
  console.log(`  cpu cores        : ${cpus}`);
  console.log(`  expected pool    : ${effectivePool} connection(s)`);

  // -------------------------------------------------------------- provider --
  line();
  console.log('2. GENERATED PRISMA CLIENT vs DATABASE_URL');
  line();
  const generatedSchema = path.join(backendDir, 'node_modules', '.prisma', 'client', 'schema.prisma');
  let clientProvider = null;
  if (fs.existsSync(generatedSchema)) {
    const text = fs.readFileSync(generatedSchema, 'utf8');
    const dsBlock = text.match(/datasource\s+\w+\s*\{[^}]*\}/);
    const m = dsBlock && dsBlock[0].match(/provider\s*=\s*"([^"]+)"/);
    clientProvider = m ? m[1] : null;
  }
  const expectedProvider = urlProtocol.startsWith('mysql')
    ? 'mysql'
    : urlProtocol.startsWith('postgres')
      ? 'postgresql'
      : null;

  console.log(`  client built for : ${clientProvider || '(could not read generated client)'}`);
  console.log(`  url expects      : ${expectedProvider || '(unrecognised protocol)'}`);
  if (clientProvider && expectedProvider && clientProvider !== expectedProvider) {
    failures++;
    bad(`PROVIDER MISMATCH — the generated Prisma client speaks ${clientProvider} but`);
    bad(`         DATABASE_URL points at ${expectedProvider}. Every query will fail to`);
    bad('         connect. Fix: cd backend && node scripts/sync-provider.js && npx prisma generate');
    bad('         then restart the app (supervisorctl restart maharaj_backend).');
  } else if (clientProvider) {
    ok('client provider matches the connection URL');
  }

  // ------------------------------------------------------------ connectivity --
  line();
  console.log('3. CONNECTIVITY');
  line();
  const prisma = new PrismaClient({ log: ['error'] });
  let connected = false;
  try {
    const t0 = Date.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    ok(`SELECT 1 succeeded in ${Date.now() - t0}ms`);
    connected = true;
  } catch (err) {
    failures++;
    bad(`could not run SELECT 1 — code=${err.code || 'n/a'} ${String(err.message).split('\n').join(' ')}`);
  }

  if (!connected) {
    await prisma.$disconnect();
    line();
    console.log(`DONE — ${failures} problem(s) found. Could not reach the database at all.`);
    process.exit(1);
  }

  // ---------------------------------------------------------- server config --
  line();
  console.log('4. MYSQL SERVER CONFIGURATION');
  line();
  const showVar = async (name) => {
    try {
      const rows = await prisma.$queryRawUnsafe(`SHOW VARIABLES LIKE '${name}'`);
      return rows?.[0]?.Value ?? null;
    } catch {
      return null;
    }
  };
  const showStatus = async (name) => {
    try {
      const rows = await prisma.$queryRawUnsafe(`SHOW STATUS LIKE '${name}'`);
      return rows?.[0]?.Value ?? null;
    } catch {
      return null;
    }
  };

  const version = await showVar('version');
  const maxConnections = await showVar('max_connections');
  const threadsConnected = await showStatus('Threads_connected');
  const maxUsedConnections = await showStatus('Max_used_connections');
  const waitTimeout = await showVar('wait_timeout');
  const interactiveTimeout = await showVar('interactive_timeout');
  const maxExecTime = await showVar('max_execution_time');
  const tableDefCache = await showVar('table_definition_cache');
  const sqlMode = await showVar('sql_mode');
  const abortedClients = await showStatus('Aborted_clients');

  console.log(`  version               : ${version}`);
  console.log(`  max_connections       : ${maxConnections}`);
  console.log(`  threads_connected     : ${threadsConnected}`);
  console.log(`  max_used_connections  : ${maxUsedConnections}`);
  console.log(`  wait_timeout          : ${waitTimeout}s`);
  console.log(`  interactive_timeout   : ${interactiveTimeout}s`);
  console.log(`  max_execution_time    : ${maxExecTime}ms  (0 = unlimited)`);
  console.log(`  table_definition_cache: ${tableDefCache}`);
  console.log(`  aborted_clients       : ${abortedClients}`);
  console.log(`  sql_mode              : ${sqlMode}`);

  // The app pings every 3 minutes to keep pooled connections warm. If MySQL
  // closes idle connections sooner than that, pooled sockets are already dead
  // when reused — which surfaces as intermittent "connection unavailable".
  if (waitTimeout !== null && Number(waitTimeout) < 180) {
    failures++;
    bad(`wait_timeout is ${waitTimeout}s but the keep-alive ping runs every 180s —`);
    bad('         pooled connections die before the next ping. Raise wait_timeout above');
    bad('         300s, or lower the ping interval in src/utils/prisma.js.');
  } else if (waitTimeout !== null) {
    ok('wait_timeout is comfortably above the 180s keep-alive interval');
  }

  if (maxExecTime !== null && Number(maxExecTime) > 0) {
    warn(`max_execution_time is ${maxExecTime}ms — long report/dashboard queries will be`);
    warn('        killed by MySQL, and that surfaces as a retryable 503 in this app.');
  }

  if (maxConnections !== null && Number(maxConnections) < effectivePool * 2) {
    warn(`max_connections (${maxConnections}) leaves little headroom over the app pool (${effectivePool}).`);
  }

  // ------------------------------------------------------------- data shape --
  line();
  console.log('5. TABLE COUNTS');
  line();
  for (const table of ['User', 'UserPermission', 'Bill', 'KOT', 'Order', 'OrderItem']) {
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM \`${table}\``);
      console.log(`  ${table.padEnd(16)}: ${num(rows[0].c)} rows`);
    } catch (err) {
      failures++;
      bad(`${table}: ${String(err.message).split('\n').join(' ').slice(0, 160)}`);
    }
  }

  // ------------------------------------------------- representative queries --
  line();
  console.log('6. DASHBOARD-STYLE QUERY TIMINGS');
  line();
  const timed = async (label, sql, ...params) => {
    const t0 = Date.now();
    try {
      const rows = await prisma.$queryRawUnsafe(sql, ...params);
      const ms = Date.now() - t0;
      const flag = ms > 2000 ? '[SLOW]' : '[ OK ]';
      console.log(`  ${flag}  ${label.padEnd(28)} ${ms}ms  (${rows.length} row(s))`);
      if (ms > 2000) failures++;
    } catch (err) {
      failures++;
      bad(`${label}: code=${err.code || 'n/a'} ${String(err.message).split('\n').join(' ').slice(0, 200)}`);
    }
  };

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  await timed(
    'bills (30d)',
    'SELECT b.id, b.total, b.sgstAmount, b.cgstAmount, b.createdAt FROM `Bill` b WHERE b.createdAt >= ?',
    since
  );
  await timed(
    'kots (30d + joins)',
    'SELECT k.id, k.kotNumber, k.status, k.createdAt FROM `KOT` k LEFT JOIN `Order` o ON o.id = k.orderId LEFT JOIN `Table` t ON t.id = o.tableId WHERE k.createdAt >= ?',
    since
  );
  await timed(
    'orders (30d)',
    'SELECT o.id, o.status, o.createdAt FROM `Order` o WHERE o.createdAt >= ?',
    since
  );
  await timed(
    'purchases (30d)',
    'SELECT p.id, p.totalAmount FROM `PurchaseEntry` p WHERE p.purchaseDate >= ?',
    since
  );

  // ------------------------------------------------------ pool pressure test --
  line();
  console.log('7. CONNECTION POOL PRESSURE');
  line();
  console.log('  Firing 15 concurrent 0.5s queries to measure the real pool size.');
  console.log('  (The dashboard fires several queries in parallel via Promise.all.)');
  const BURST = 15;
  const HOLD = 0.5;
  const t0 = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: BURST }, () => prisma.$queryRawUnsafe(`SELECT SLEEP(${HOLD})`))
  );
  const elapsed = (Date.now() - t0) / 1000;
  const rejected = results.filter((r) => r.status === 'rejected');
  const measuredPool = Math.max(1, Math.round(BURST / Math.max(1, Math.round(elapsed / HOLD))));

  console.log(`  elapsed          : ${elapsed.toFixed(2)}s for ${BURST} x ${HOLD}s queries`);
  console.log(`  failed           : ${rejected.length}`);
  console.log(`  measured pool    : ~${measuredPool} concurrent connection(s)`);

  if (rejected.length > 0) {
    failures++;
    const first = rejected[0].reason;
    bad(`pool errors under load — code=${first?.code || 'n/a'} ${String(first?.message).split('\n').join(' ').slice(0, 200)}`);
    if (String(first?.code) === 'P2024' || String(first?.message).toLowerCase().includes('timed out fetching')) {
      bad('         This is the connection pool running dry. Add ?connection_limit=15 to');
      bad('         DATABASE_URL in nimbus.yml, redeploy, and restart the app.');
    }
  } else if (measuredPool < 5) {
    warn(`pool is small (~${measuredPool}). Parallel dashboard/report queries will queue behind`);
    warn('        each other. Consider ?connection_limit=15 on DATABASE_URL.');
  } else {
    ok('pool handled the burst without errors');
  }

  await prisma.$disconnect();

  line();
  if (failures === 0) {
    console.log('DONE — no problems detected from this machine.');
    console.log('If the API is still returning 503s, capture the new [DB 503] / [Prisma Fail]');
    console.log('lines from logs/backend.err.log — they now include the real error.');
  } else {
    console.log(`DONE — ${failures} problem(s) flagged above.`);
  }
  line();
}

main().catch((err) => {
  console.error('\ndb-diagnose crashed:', err?.message || err);
  if (err?.code) console.error('code:', err.code);
  process.exit(1);
});
