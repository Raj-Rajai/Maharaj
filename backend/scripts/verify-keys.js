import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.join(__dirname, '../../maharaj_mysql_dump.sql');
const content = fs.readFileSync(sqlPath, 'utf8');

// Match every CREATE TABLE statement
const tableRegex = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\) ENGINE=InnoDB/g;
let match;
let count = 0;

console.log('='.repeat(75));
console.log('DATABASE SCHEMA AUDIT: PRIMARY KEYS & FOREIGN KEYS VERIFICATION');
console.log('='.repeat(75));

while ((match = tableRegex.exec(content)) !== null) {
  count++;
  const tableName = match[1];
  const tableBody = match[2];

  const pkMatch = tableBody.match(/PRIMARY KEY \(([^)]+)\)/);
  const uqMatches = [...tableBody.matchAll(/UNIQUE KEY `([^`]+)` \(([^)]+)\)/g)];
  const fkMatches = [...tableBody.matchAll(/CONSTRAINT `([^`]+)` FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)` \(`([^`]+)`\)([^,\n]*)/g)];

  console.log(`\n${count}. Table: \x1b[1m\`${tableName}\`\x1b[0m`);
  console.log(`   🔑 Primary Key: ${pkMatch ? pkMatch[1] : 'NONE'}`);
  
  if (uqMatches.length > 0) {
    console.log(`   🔒 Unique Keys (${uqMatches.length}):`);
    uqMatches.forEach(u => console.log(`      - \`${u[1]}\`: (${u[2]})`));
  } else {
    console.log(`   🔒 Unique Keys: 0`);
  }

  if (fkMatches.length > 0) {
    console.log(`   🔗 Foreign Keys (${fkMatches.length}):`);
    fkMatches.forEach(f => {
      const action = f[5] ? f[5].trim() : '';
      console.log(`      - \`${f[2]}\` ➜ \`${f[3]}\`(\`${f[4]}\`) ${action}`);
    });
  } else {
    console.log(`   🔗 Foreign Keys: 0`);
  }
}

console.log('\n' + '='.repeat(75));
console.log(`Audited ${count} tables successfully.`);
console.log('='.repeat(75));
