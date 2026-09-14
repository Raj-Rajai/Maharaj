import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('ERROR: No DIRECT_URL or DATABASE_URL found in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000
});

async function queryWithRetry(sql, params = [], retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  [Notice] Network retry ${attempt}/${retries}...`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

// Helper to escape values for MySQL SQL syntax
function escapeMySQLValue(val, colType) {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? '1' : '0';
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : 'NULL';
  }
  if (val instanceof Date) {
    const d = new Date(val);
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const Y = d.getUTCFullYear();
    const M = pad(d.getUTCMonth() + 1);
    const D = pad(d.getUTCDate());
    const h = pad(d.getUTCHours());
    const m = pad(d.getUTCMinutes());
    const s = pad(d.getUTCSeconds());
    const ms = pad(d.getUTCMilliseconds(), 3);
    return `'${Y}-${M}-${D} ${h}:${m}:${s}.${ms}'`;
  }
  if (typeof val === 'object') {
    if (val !== null && typeof val.toString === 'function' && !Array.isArray(val) && val.constructor.name !== 'Object') {
      const s = val.toString();
      if (!isNaN(Number(s))) {
        return s;
      }
    }
    const jsonStr = JSON.stringify(val);
    return `'${escapeMySQLString(jsonStr)}'`;
  }
  return `'${escapeMySQLString(String(val))}'`;
}

function escapeMySQLString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// Convert PostgreSQL data type to MySQL data type with structural safety
function pgTypeToMySQL(col, isPk, isUnique) {
  const type = col.data_type.toLowerCase();
  const colName = col.column_name.toLowerCase();

  if (type === 'boolean') return 'TINYINT(1)';
  if (type === 'smallint') return 'SMALLINT';
  if (type === 'integer') return 'INT';
  if (type === 'bigint') return 'BIGINT';
  if (type === 'numeric' || type === 'decimal') {
    const precision = col.numeric_precision || 10;
    const scale = col.numeric_scale !== null ? col.numeric_scale : 2;
    return `DECIMAL(${precision}, ${scale})`;
  }
  if (type === 'real') return 'FLOAT';
  if (type === 'double precision') return 'DOUBLE';
  if (type.includes('timestamp')) return 'DATETIME(3)';
  if (type === 'date') return 'DATE';
  if (type === 'time') return 'TIME';
  if (type === 'json' || type === 'jsonb') return 'JSON';

  // Genuine unbounded text columns
  const textColumns = ['notes', 'description', 'address', 'reason'];
  if (textColumns.includes(colName) && !isPk && !isUnique) {
    return 'TEXT';
  }

  // All primary keys, foreign keys, codes, tokens, usernames, names, enums
  return 'VARCHAR(191)';
}

async function runExport() {
  console.log('Connecting to Live Supabase PostgreSQL Database...');
  
  // 1. Fetch all tables
  const tablesRes = await queryWithRetry(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != '_prisma_migrations'
    ORDER BY table_name;
  `);

  const allTables = tablesRes.rows.map(r => r.table_name);
  console.log(`Found ${allTables.length} tables in Supabase.`);

  // 2. Fetch all column definitions across all tables at once
  console.log('Fetching database schema and constraints...');
  const allColsRes = await queryWithRetry(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
           character_maximum_length, numeric_precision, numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name != '_prisma_migrations'
    ORDER BY table_name, ordinal_position;
  `);

  const columnsByTable = {};
  for (const c of allColsRes.rows) {
    if (!columnsByTable[c.table_name]) columnsByTable[c.table_name] = [];
    columnsByTable[c.table_name].push(c);
  }

  // 3. Fetch all primary keys at once
  const pkRes = await queryWithRetry(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.ordinal_position;
  `);

  const pkByTable = {};
  for (const r of pkRes.rows) {
    if (!pkByTable[r.table_name]) pkByTable[r.table_name] = [];
    pkByTable[r.table_name].push(r.column_name);
  }

  // 4. Fetch all unique indexes and regular indexes at once
  const indexRes = await queryWithRetry(`
    SELECT
      t.relname AS table_name,
      i.relname AS index_name,
      a.attname AS column_name,
      ix.indisunique AS is_unique,
      ix.indisprimary AS is_primary
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.relname, i.relname, a.attnum;
  `);

  const uniqueMap = {};
  const indexMap = {};
  for (const row of indexRes.rows) {
    if (row.is_primary) continue;
    if (row.is_unique) {
      if (!uniqueMap[row.table_name]) uniqueMap[row.table_name] = {};
      if (!uniqueMap[row.table_name][row.index_name]) uniqueMap[row.table_name][row.index_name] = [];
      uniqueMap[row.table_name][row.index_name].push(row.column_name);
    } else {
      if (!indexMap[row.table_name]) indexMap[row.table_name] = {};
      if (!indexMap[row.table_name][row.index_name]) indexMap[row.table_name][row.index_name] = [];
      indexMap[row.table_name][row.index_name].push(row.column_name);
    }
  }

  // 5. Fetch all foreign keys at once
  const fkRes = await queryWithRetry(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
  `);

  const fkMap = {};
  for (const row of fkRes.rows) {
    if (!fkMap[row.table_name]) fkMap[row.table_name] = [];
    fkMap[row.table_name].push(row);
  }

  // Dependency order so parents are created & populated before children
  const priorityOrder = [
    'User',
    'UserPermission',
    'RefreshToken',
    'Table',
    'Category',
    'MenuItem',
    'TableSession',
    'Order',
    'KOT',
    'OrderItem',
    'OrderItemHistory',
    'Bill',
    'BillAmendment',
    'Payment',
    'Supplier',
    'PurchaseEntry',
    'PurchaseItem',
    'InventoryItem',
    'InventoryTransaction',
    'OnlineOrder',
    'Settings',
    'AuditLog'
  ];

  const sortedTables = [
    ...priorityOrder.filter(t => allTables.includes(t)),
    ...allTables.filter(t => !priorityOrder.includes(t))
  ];

  let sqlOutput = '';
  sqlOutput += `-- =====================================================================\n`;
  sqlOutput += `-- Maharaj Veg Villa - Production MySQL Database Export\n`;
  sqlOutput += `-- Source: Live Supabase PostgreSQL Database\n`;
  sqlOutput += `-- Target: MySQL 8.0+ / MariaDB\n`;
  sqlOutput += `-- Generated on: ${new Date().toISOString()}\n`;
  sqlOutput += `-- Tables: ${sortedTables.length}\n`;
  sqlOutput += `-- =====================================================================\n\n`;

  sqlOutput += `SET NAMES utf8mb4 COLLATE utf8mb4_bin;\n`;
  sqlOutput += `SET FOREIGN_KEY_CHECKS = 0;\n`;
  sqlOutput += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`;
  sqlOutput += `SET AUTOCOMMIT = 0;\n`;
  sqlOutput += `START TRANSACTION;\n\n`;

  const summary = [];

  for (const tableName of sortedTables) {
    const columns = columnsByTable[tableName] || [];
    if (columns.length === 0) continue;

    const pkColumns = pkByTable[tableName] || [];
    const tableUniques = uniqueMap[tableName] || {};
    const allUniqueCols = Object.values(tableUniques).flat();

    sqlOutput += `-- ---------------------------------------------------------------------\n`;
    sqlOutput += `-- Table structure for \`${tableName}\`\n`;
    sqlOutput += `-- ---------------------------------------------------------------------\n`;
    sqlOutput += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    sqlOutput += `CREATE TABLE \`${tableName}\` (\n`;

    const definitions = [];

    // Column definitions
    for (const c of columns) {
      const isPk = pkColumns.includes(c.column_name);
      const isUniq = allUniqueCols.includes(c.column_name);
      const colName = `\`${c.column_name}\``;
      const myType = pgTypeToMySQL(c, isPk, isUniq);
      const isNull = c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';

      let colDef = `${colName} ${myType} ${isNull}`;

      if (c.column_default && c.column_default.includes('nextval')) {
        colDef += ' AUTO_INCREMENT';
      } else if (c.column_default && !c.column_default.includes('gen_random_uuid') && !c.column_default.includes('uuid_generate')) {
        let cleanDefault = c.column_default;
        if (cleanDefault.includes('::')) {
          cleanDefault = cleanDefault.split('::')[0];
        }
        if (cleanDefault.toLowerCase() === 'now()' || cleanDefault.toLowerCase().includes('current_timestamp')) {
          colDef += ' DEFAULT CURRENT_TIMESTAMP(3)';
        } else if (cleanDefault === 'true') {
          colDef += ' DEFAULT 1';
        } else if (cleanDefault === 'false') {
          colDef += ' DEFAULT 0';
        } else if (!isNaN(Number(cleanDefault))) {
          colDef += ` DEFAULT ${cleanDefault}`;
        } else {
          colDef += ` DEFAULT ${cleanDefault}`;
        }
      }

      definitions.push(`  ${colDef}`);
    }

    // Primary Key
    if (pkColumns.length > 0) {
      definitions.push(`  PRIMARY KEY (${pkColumns.map(p => `\`${p}\``).join(', ')})`);
    }

    // Unique Keys
    for (const [cName, uCols] of Object.entries(tableUniques)) {
      definitions.push(`  UNIQUE KEY \`${cName}\` (${uCols.map(c => `\`${c}\``).join(', ')})`);
    }

    // Regular Indexes
    const tableIdxs = indexMap[tableName] || {};
    for (const [idxName, idxCols] of Object.entries(tableIdxs)) {
      definitions.push(`  KEY \`${idxName}\` (${idxCols.map(c => `\`${c}\``).join(', ')})`);
    }

    // Foreign Keys
    const tableFks = fkMap[tableName] || [];
    for (const fk of tableFks) {
      const onDel = fk.delete_rule && fk.delete_rule !== 'NO ACTION' ? ` ON DELETE ${fk.delete_rule}` : '';
      const onUpd = fk.update_rule && fk.update_rule !== 'NO ACTION' ? ` ON UPDATE ${fk.update_rule}` : '';
      definitions.push(`  CONSTRAINT \`${fk.constraint_name}\` FOREIGN KEY (\`${fk.column_name}\`) REFERENCES \`${fk.foreign_table_name}\` (\`${fk.foreign_column_name}\`)${onDel}${onUpd}`);
    }

    sqlOutput += definitions.join(',\n');
    sqlOutput += `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;\n\n`;

    // Fetch data rows from Supabase
    const dataRes = await queryWithRetry(`SELECT * FROM "${tableName}"`);
    const rows = dataRes.rows;
    summary.push({ table: tableName, rowCount: rows.length });

    sqlOutput += `-- Data for table \`${tableName}\` (${rows.length} rows)\n`;

    if (rows.length === 0) {
      sqlOutput += `-- (0 rows)\n\n`;
      console.log(`✓ ${tableName.padEnd(24)} : 0 rows (structure created)`);
      continue;
    }

    const colNamesList = columns.map(c => `\`${c.column_name}\``).join(', ');

    // Write in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const valuesList = chunk.map(row => {
        const rowVals = columns.map(c => {
          const val = row[c.column_name];
          return escapeMySQLValue(val, c.data_type);
        });
        return `(${rowVals.join(', ')})`;
      });

      sqlOutput += `INSERT IGNORE INTO \`${tableName}\` (${colNamesList}) VALUES\n`;
      sqlOutput += valuesList.join(',\n') + ';\n';
    }
    sqlOutput += `\n`;
    console.log(`✓ ${tableName.padEnd(24)} : ${rows.length} rows exported`);
  }

  sqlOutput += `-- =====================================================================\n`;
  sqlOutput += `COMMIT;\n`;
  sqlOutput += `SET FOREIGN_KEY_CHECKS = 1;\n`;
  sqlOutput += `-- =====================================================================\n`;
  sqlOutput += `-- End of Maharaj Veg Villa Production MySQL Export\n`;
  sqlOutput += `-- Total tables: ${sortedTables.length} | Total records: ${summary.reduce((s, r) => s + r.rowCount, 0)}\n`;
  sqlOutput += `-- =====================================================================\n`;

  const rootFilePath = path.join(__dirname, '../../maharaj_mysql_dump.sql');
  const prismaFilePath = path.join(__dirname, '../prisma/maharaj_mysql_dump.sql');

  fs.writeFileSync(rootFilePath, sqlOutput, 'utf8');
  fs.writeFileSync(prismaFilePath, sqlOutput, 'utf8');

  console.log(`\n=====================================================================`);
  console.log(`SUCCESS: Full production-grade MySQL .sql file generated!`);
  console.log(`Location: ${rootFilePath}`);
  console.log(`File size: ${(fs.statSync(rootFilePath).size / 1024).toFixed(1)} KB`);
  console.log(`=====================================================================`);

  await pool.end();
}

runExport().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
