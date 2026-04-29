const { Pool } = require('pg');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

// Mapping: [Supabase Table Name]: [Local Prisma Table Name]
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
  'agent_uploads': 'AgentUpload',
  'spaces': 'Space',
  'space_files': 'SpaceFile',
  'space_versions': 'SpaceVersion',
  'space_collaborators': 'SpaceCollaborator',
  'space_invites': 'SpaceInvite',
  'citations': 'Citation',
  'citation_collections': 'CitationCollection',
  'citation_collection_items': 'CitationCollectionItem'
};

async function migrateTable(supabaseName, localName) {
  console.log(`\nMigrating ${supabaseName} -> ${localName}...`);
  let allRows = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${supabaseUrl}/rest/v1/${supabaseName}?select=*&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      if (text.includes('relation') && text.includes('does not exist')) {
         // Try PascalCase if lowercase failed, or vice versa
         console.log(`Supabase table ${supabaseName} not found, trying ${localName}...`);
         if (supabaseName !== localName) {
             return migrateTable(localName, localName);
         }
      }
      console.error(`Error fetching ${supabaseName}:`, text);
      break;
    }

    const data = await res.json();
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  console.log(`Found ${allRows.length} rows in Supabase for ${supabaseName}.`);
  if (allRows.length === 0) return;
  
  // Custom column mappings: [Local Column Name]: [Supabase Column Name]
  const columnMapping = {
    'SystemNotification': {
      'is_read': 'read'
    }
  };

  for (const row of allRows) {
    const keys = Object.keys(row);
    // If we have a custom mapping for this table, we need to map the keys
    const mappedRow = { ...row };
    if (columnMapping[localName]) {
      for (const [localCol, supabaseCol] of Object.entries(columnMapping[localName])) {
        if (row[supabaseCol] !== undefined) {
          mappedRow[localCol] = row[supabaseCol];
          // We don't delete the old key because it might be needed for the insert if it's not in keys
        }
      }
    }

    const finalKeys = [];
    for (const [localCol, supabaseCol] of Object.entries(columnMapping[localName] || {})) {
      if (row[supabaseCol] !== undefined) {
        mappedRow[localCol] = row[supabaseCol];
        finalKeys.push(localCol);
      }
    }
    
    for (const k of keys) {
      // If this key is being mapped FROM, skip it
      const isMappedFrom = Object.values(columnMapping[localName] || {}).includes(k);
      if (!isMappedFrom && !finalKeys.includes(k)) {
        finalKeys.push(k);
      }
    }

    const cols = finalKeys.map(k => `"${k}"`).join(', ');
    const vals = finalKeys.map((_, i) => `$${i + 1}`).join(', ');
    const valuesArray = finalKeys.map(k => {
      let val = mappedRow[k];
      if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
        return JSON.stringify(val);
      }
      return val;
    });

    const query = `INSERT INTO "${localName}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING`;
    
    try {
      await pool.query(query, valuesArray);
    } catch (e) {
      if (!e.message.includes('ON CONFLICT') && !e.message.includes('foreign key constraint')) {
        console.error(`Error inserting into ${localName}:`, e.message);
      }
    }
  }

  console.log(`Finished inserting into ${localName}.`);
}

async function run() {
  console.log('Checking connection to Supabase...');
  try {
    for (const [supabaseName, localName] of Object.entries(tableMapping)) {
      await migrateTable(supabaseName, localName);
    }
    console.log('\n🚀 MIGRATION COMPLETELY FINISHED!');
  } catch (err) {
    console.error('\n⚠️ Fatal error during migration:', err);
  } finally {
    await pool.end();
  }
}

run();
