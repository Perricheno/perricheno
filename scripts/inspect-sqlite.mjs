import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'perricheno_real.db');

console.log('Opening:', dbPath);
const db = new Database(dbPath, { readonly: true });

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('\n=== TABLES ===');
tables.forEach(t => {
    const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
    const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
    console.log(`\n📦 ${t.name} (${count.c} rows)`);
    cols.forEach(col => {
        console.log(`   - ${col.name} (${col.type}${col.pk ? ' PK' : ''}${col.notnull ? ' NOT NULL' : ''})`);
    });
});

db.close();
