const { Pool } = require('pg');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function fetchAll(table) {
  let all = [], offset = 0;
  while (true) {
    const url = `${supabaseUrl}/rest/v1/${table}?select=*&offset=${offset}&limit=1000`;
    const res = await fetch(url, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    if (!res.ok) { console.error(await res.text()); break; }
    const data = await res.json();
    if (!data.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function getLocalColumns(tableName) {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [tableName]
  );
  return new Set(res.rows.map(r => r.column_name));
}

// Column renames: { LocalTable: { supabase_col: local_col } }
const columnRenames = {
  'SystemNotification': { 'read': 'is_read' },
};

// Primary key for each table (for UPSERT)
const primaryKeys = {
  'User': 'id',
  'Task': 'id',
  'ChatSession': 'id',
  'AgentSession': 'id',
  'ChatMessage': 'id',
  'VisualAsset': 'id',
  'BotSession': 'telegram_id',
  'Session': 'id',
  'AuthRequest': 'token',
  'Transaction': 'id',
  'Receipt': 'id',
  'ProcessedPayment': 'order_id',
  'UsageLog': 'id',
  'PromoCode': 'id',
  'PromoUsage': 'id',
  'SystemConfig': 'key',
  'SystemNotification': 'id',
  'LatexError': 'id',
  'AgentUpload': 'id',
  'Space': 'id',
  'SpaceFile': 'id',
  'SpaceVersion': 'id',
  'SpaceCollaborator': 'id',
  'SpaceInvite': 'id',
};

const tableMapping = {
  'users': 'User',
  'tasks': 'Task',
  'chat_sessions': 'ChatSession',
  'agent_sessions': 'AgentSession',
  'chat_messages': 'ChatMessage',
  'visual_assets': 'VisualAsset',
  'bot_sessions': 'BotSession',
  'sessions': 'Session',
  'auth_requests': 'AuthRequest',
  'transactions': 'Transaction',
  'receipts': 'Receipt',
  'processed_payments': 'ProcessedPayment',
  'usage_logs': 'UsageLog',
  'promo_codes': 'PromoCode',
  'promo_usages': 'PromoUsage',
  'system_config': 'SystemConfig',
  'system_notifications': 'SystemNotification',
  'latex_errors': 'LatexError',
  'spaces': 'Space',
  'space_files': 'SpaceFile',
  'space_versions': 'SpaceVersion',
  'space_collaborators': 'SpaceCollaborator',
  'space_invites': 'SpaceInvite',
};

async function upsertTable(supabaseName, localName) {
  console.log(`\n=== ${supabaseName} -> ${localName} ===`);

  const localCols = await getLocalColumns(localName);
  const renames = columnRenames[localName] || {};
  const pk = primaryKeys[localName];

  const rows = await fetchAll(supabaseName);
  console.log(`  Supabase: ${rows.length} rows`);
  if (!rows.length) return;

  let upserted = 0, errors = 0;

  for (const row of rows) {
    // Build clean row: rename cols, filter to local-only cols
    const cleanRow = {};
    for (const [key, val] of Object.entries(row)) {
      const localKey = renames[key] || key;
      if (localCols.has(localKey)) {
        cleanRow[localKey] = (typeof val === 'object' && val !== null && !(val instanceof Date))
          ? JSON.stringify(val) : val;
      }
    }

    const keys = Object.keys(cleanRow);
    if (!keys.length) continue;

    const cols = keys.map(k => `"${k}"`).join(', ');
    const vals = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => cleanRow[k]);

    // Build UPDATE SET clause (all columns except PK)
    const updateCols = keys.filter(k => k !== pk);
    const updateSet = updateCols.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');

    const query = updateSet
      ? `INSERT INTO "${localName}" (${cols}) VALUES (${vals}) ON CONFLICT ("${pk}") DO UPDATE SET ${updateSet}`
      : `INSERT INTO "${localName}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING`;

    try {
      await pool.query(query, values);
      upserted++;
    } catch (e) {
      errors++;
      if (errors <= 3) console.error(`  Error: ${e.message}`);
    }
  }

  console.log(`  Result: ${upserted} upserted, ${errors} errors`);
}

async function run() {
  console.log('=== FULL UPSERT MIGRATION (overwrites stale data) ===\n');

  // Order matters: parents first, then children
  const orderedTables = [
    'users', 'tasks', 'chat_sessions', 'chat_messages', 'agent_sessions',
    'visual_assets', 'bot_sessions', 'sessions', 'auth_requests',
    'transactions', 'receipts', 'processed_payments', 'usage_logs',
    'promo_codes', 'promo_usages', 'system_config', 'system_notifications',
    'latex_errors', 'spaces', 'space_files', 'space_versions',
    'space_collaborators', 'space_invites',
  ];

  for (const supabaseName of orderedTables) {
    const localName = tableMapping[supabaseName];
    if (localName) await upsertTable(supabaseName, localName);
  }

  // Verification
  console.log('\n=== FINAL VERIFICATION ===');
  for (const localName of Object.values(tableMapping)) {
    const res = await pool.query(`SELECT count(*) FROM "${localName}"`);
    console.log(`  ${localName}: ${res.rows[0].count}`);
  }

  // Spot-check user #1
  const u1 = await pool.query('SELECT id, purchased_chars, plan_tier, account_tier FROM "User" WHERE id = 1');
  console.log('\n  User #1 check:', JSON.stringify(u1.rows[0]));

  console.log('\n🚀 FULL MIGRATION COMPLETE!');
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
