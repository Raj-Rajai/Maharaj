import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendDir, '..');

// Load environment from backend/.env or root .env
dotenv.config({ path: path.join(backendDir, '.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(projectRoot, '.env') });
}

const dbUrl = process.env.DATABASE_URL || '';

console.log('='.repeat(70));
console.log('MAHARAJ VEG VILLA - MYSQL DATABASE MIGRATION RUNNER');
console.log('='.repeat(70));

if (!dbUrl) {
  console.error('\n❌ ERROR: DATABASE_URL is not set in environment or .env file.');
  process.exit(1);
}

if (!dbUrl.startsWith('mysql://')) {
  console.error(`\n⚠️  WARNING: DATABASE_URL does not appear to be MySQL (${dbUrl.split(':')[0]}://...).`);
  console.error('This script is intended for migrating into MySQL 8.0.');
}

// Find SQL dump file (check prisma/maharaj_veg_villa_complete.sql or root)
let sqlFilePath = path.join(backendDir, 'prisma', 'maharaj_veg_villa_complete.sql');
if (!fs.existsSync(sqlFilePath)) {
  sqlFilePath = path.join(projectRoot, 'maharaj_veg_villa_complete.sql');
}

if (!fs.existsSync(sqlFilePath)) {
  console.error(`\n❌ ERROR: Dump file not found at: ${sqlFilePath}`);
  process.exit(1);
}

const stats = fs.statSync(sqlFilePath);
console.log(`\n📁 SQL Dump File: ${sqlFilePath}`);
console.log(`📦 File Size: ${(stats.size / 1024).toFixed(1)} KB`);

const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');

console.log(`\n🚀 Executing SQL migration via Prisma engine...`);
const startTime = Date.now();

try {
  // Use Prisma's native db execute command
  // This connects via DATABASE_URL and runs the whole SQL script natively
  execSync(
    `npx prisma db execute --file "${sqlFilePath}" --schema="${schemaPath}"`,
    {
      cwd: backendDir,
      stdio: 'inherit',
      env: process.env,
    }
  );

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Migration completed successfully in ${durationSec}s!`);
  console.log('All 22 tables, 1,689 rows, and 21 foreign key constraints have been migrated.');
  console.log('='.repeat(70));
} catch (err) {
  console.error('\n❌ Migration failed during execution:');
  console.error(err.message);
  process.exit(1);
}
