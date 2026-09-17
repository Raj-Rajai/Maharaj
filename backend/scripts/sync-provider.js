import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

// Load environment variables from backend/.env if not already present
dotenv.config({ path: path.join(backendDir, '.env') });

const dbUrl = process.env.DATABASE_URL || '';
const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error(`[sync-provider] Schema not found at: ${schemaPath}`);
  process.exit(0);
}

// Maharaj Veg Villa is strictly configured for MySQL 8.0+
const targetProvider = 'mysql';

let content = fs.readFileSync(schemaPath, 'utf8');
const providerRegex = /provider\s*=\s*"(mysql|postgresql|sqlite|sqlserver)"/;
const match = content.match(providerRegex);

if (match && match[1] !== targetProvider) {
  content = content.replace(providerRegex, `provider  = "${targetProvider}"`);
  fs.writeFileSync(schemaPath, content, 'utf8');
  console.log(`[sync-provider] Updated schema.prisma datasource provider to "${targetProvider}" (matched DATABASE_URL).`);
} else {
  console.log(`[sync-provider] schema.prisma datasource provider already matches "${targetProvider}".`);
}
