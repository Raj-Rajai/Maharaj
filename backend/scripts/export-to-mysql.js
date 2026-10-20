import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

console.log('Connecting to Supabase PostgreSQL...');
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log('Connected successfully!');

const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;`);
console.log('Tables found:', res.rows.map(r => r.table_name));

await client.end();
