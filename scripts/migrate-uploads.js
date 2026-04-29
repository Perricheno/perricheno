const { Pool } = require('pg');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

const LIGHT_COLS = 'id,user_id,filename,char_count,image_count,page_count,ocr_used,storage_path,file_size,mime_type,created_at,expires_at';
const HEAVY_COLS = ['text_content', 'images_json'];

async function fetchSupabase(table, select, offset, limit) {
  const url = `${supabaseUrl}/rest/v1/${table}?select=${select}&offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  if (!res.ok) { console.error(`Fetch error: ${await res.text()}`); return []; }
  return res.json();
}

async function run() {
  console.log('=== Phase 1: Migrate agent_uploads metadata ===');
  
  let offset = 0, total = 0;
  while (true) {
    const rows = await fetchSupabase('agent_uploads', LIGHT_COLS, offset, 100);
    if (!rows.length) break;

    for (const row of rows) {
      const keys = Object.keys(row);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const vals = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map(k => row[k]);
      try {
        const r = await pool.query(`INSERT INTO "AgentUpload" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING`, values);
        if (r.rowCount > 0) total++;
      } catch (e) {
        console.error(`  Insert err: ${e.message}`);
      }
    }

    offset += rows.length;
    console.log(`  Fetched ${offset} rows so far...`);
    if (rows.length < 100) break;
  }

  console.log(`Phase 1 done: ${total} rows inserted.\n`);

  console.log('=== Phase 2: Backfill text_content & images_json ===');
  let updated = 0;

  // Get all IDs we inserted
  const ids = await pool.query('SELECT id FROM "AgentUpload"');
  
  for (const { id } of ids.rows) {
    for (const col of HEAVY_COLS) {
      try {
        const data = await fetchSupabase('agent_uploads', `${col}`, 0, 1);
        // Actually fetch by ID
        const url = `${supabaseUrl}/rest/v1/agent_uploads?select=${col}&id=eq.${id}`;
        const res = await fetch(url, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (!res.ok) continue;
        const rows = await res.json();
        if (!rows.length || rows[0][col] === null) continue;

        let val = rows[0][col];
        if (typeof val === 'object') val = JSON.stringify(val);

        await pool.query(`UPDATE "AgentUpload" SET "${col}" = $1 WHERE id = $2`, [val, id]);
        updated++;
      } catch (e) {
        // Skip - content might be too large or expired
      }
    }
  }

  console.log(`Phase 2 done: ${updated} fields updated.\n`);

  // Final count
  const count = await pool.query('SELECT count(*) FROM "AgentUpload"');
  console.log(`AgentUpload total: ${count.rows[0].count} rows`);

  // Also verify the 1 missing transaction
  const txCount = await pool.query('SELECT count(*) FROM "Transaction"');
  console.log(`Transaction total: ${txCount.rows[0].count} rows`);

  console.log('\n🚀 Fix migration complete!');
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
