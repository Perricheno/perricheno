const fs = require('fs');
const envPath = require('path').join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').filter(Boolean).forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
});
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'perricheno_real.db');
let sqlite;
try {
    sqlite = new Database(dbPath);
} catch(e) {
    console.error("Could not open sqlite database. Path:", dbPath);
    process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env keys.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateTable(tableName, orderByCol = 'id') {
    process.stdout.write(`Migrating ${tableName}... `);
    let rows;
    try {
        rows = sqlite.prepare(`SELECT * FROM ${tableName} ORDER BY ${orderByCol}`).all();
    } catch (e) {
        if (e.message.includes("no such table")) {
           console.log(`Table missing in SQLite, skipping.`);
           return;
        }
        throw e;
    }
            
    if (rows.length === 0) {
        console.log(`No data.`);
        return;
    }
    
    // SQLite uses 0/1 for booleans. Supabase PostgreSQL expects TRUE/FALSE.
    const booleanColumns = ['is_positive', 'read', 'is_banned', 'is_admin', 'is_deleted', 'is_active'];
    
    const processedRows = rows.map(row => {
        const newRow = { ...row };
        for (const key in newRow) {
            if (booleanColumns.includes(key)) {
                if (newRow[key] === 0) newRow[key] = false;
                if (newRow[key] === 1) newRow[key] = true;
            }
        }
        return newRow;
    });

    // Insert in chunks of 50 to avoid payload limits
    const chunkSize = 50;
    let successCount = 0;
    for (let i = 0; i < processedRows.length; i += chunkSize) {
        const chunk = processedRows.slice(i, i + chunkSize);
        const { error } = await supabase.from(tableName).insert(chunk);
        if (error) {
            console.error(`\nError inserting into ${tableName}:`, error.message);
        } else {
            successCount += chunk.length;
        }
    }
    console.log(`Done (${successCount}/${rows.length} rows)`);
}

async function run() {
    console.log("Checking connection to Supabase...");
    const { data: test, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
        console.error("\n❌ CONNECTION ERROR: Supabase tables not found!");
        console.error("Did you forget to copy and run 'scripts/supabase-schema.sql' inside the Supabase SQL Editor?");
        console.error("Error Details:", error.message);
        process.exit(1);
    }
    
    console.log("✅ Supabase Tables verified! Starting data migration...\n");

    try {
        await migrateTable('users');
        await migrateTable('tasks');
        await migrateTable('chat_sessions', 'created_at');
        await migrateTable('agent_sessions', 'created_at');
        await migrateTable('chat_messages', 'created_at');
        await migrateTable('visual_assets', 'created_at');
        await migrateTable('bot_sessions', 'updated_at');
        await migrateTable('sessions', 'created_at');
        await migrateTable('auth_requests', 'created_at');
        await migrateTable('transactions');
        await migrateTable('receipts', 'created_at');
        await migrateTable('processed_payments', 'created_at');
        await migrateTable('usage_logs');
        await migrateTable('promo_codes');
        await migrateTable('promo_usages');
        await migrateTable('system_config', 'updated_at');
        await migrateTable('system_notifications');
        await migrateTable('latex_errors');

        console.log("\n🚀 MIGRATION COMPLETELY FINISHED!");
    } catch (err) {
        console.error("\n⚠️ Fatal error during migration:", err);
    }
}

run();
