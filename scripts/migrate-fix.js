const { Pool } = require('pg');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

// Tables that need re-migration (incomplete or failed)
const tableMapping = {
  'agent_sessions': 'AgentSession',
  'agent_uploads': 'AgentUpload',
  'transactions': 'Transaction',
  'system_notifications': 'SystemNotification',
};

// Column renames: supabase_col -> local_col
const columnRenames = {
  'SystemNotification': { 'read': 'is_read' },
};

async function getLocalColumns(tableName) {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName]
  );
  return new Set(res.rows.map(r => r.column_name));
}

async function fetchAllFromSupabase(tableName) {
  let allRows = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const url = `${supabaseUrl}/rest/v1/${tableName}?select=*&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`  Error fetching ${tableName}: ${text}`);
      return allRows;
    }

    const data = await res.json();
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return allRows;
}

async function migrateTable(supabaseName, localName) {
  console.log(`\n=== ${supabaseName} -> ${localName} ===`);

  const localCols = await getLocalColumns(localName);
  console.log(`  Local columns: ${[...localCols].join(', ')}`);

  const renames = columnRenames[localName] || {};

  const rows = await fetchAllFromSupabase(supabaseName);
  console.log(`  Supabase rows: ${rows.length}`);
  if (rows.length === 0) return;

  let inserted = 0, skipped = 0, errors = 0;

  for (const row of rows) {
    // Build a clean row with only columns that exist locally
    const cleanRow = {};
    for (const [key, val] of Object.entries(row)) {
      // Check if this column is renamed
      const localKey = renames[key] || key;
      // Only include if local table has this column
      if (localCols.has(localKey)) {
        cleanRow[localKey] = val;
      }
    }

    const keys = Object.keys(cleanRow);
    if (keys.length === 0) continue;

    const cols = keys.map(k => `"${k}"`).join(', ');
    const vals = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => {
      const v = cleanRow[k];
      if (typeof v === 'object' && v !== null && !(v instanceof Date)) {
        return JSON.stringify(v);
      }
      return v;
    });

    const query = `INSERT INTO "${localName}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING`;

    try {
      const result = await pool.query(query, values);
      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (e) {
      errors++;
      if (errors <= 3) {
        console.error(`  Insert error: ${e.message}`);
      }
    }
  }

  console.log(`  Result: ${inserted} inserted, ${skipped} skipped (duplicates), ${errors} errors`);
}

async function run() {
  console.log('Starting targeted re-migration...\n');

  for (const [supabaseName, localName] of Object.entries(tableMapping)) {
    await migrateTable(supabaseName, localName);
  }

  // Verify final counts
  console.log('\n=== VERIFICATION ===');
  for (const localName of Object.values(tableMapping)) {
    const res = await pool.query(`SELECT count(*) FROM "${localName}"`);
    console.log(`  ${localName}: ${res.rows[0].count} rows`);
  }

  console.log('\n🚀 Re-migration complete!');
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
