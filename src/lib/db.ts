import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// For Next.js development, we need to ensure we don't create multiple connections
// but better-sqlite3 handles this well as long as we reuse the instance or rely on Next.js clearing cache.
// However, in dev mode, module might reload. We can use globalThis pattern.

// Use a writable path in production (Docker volume), otherwise local project root
const dbPath = process.env.NODE_ENV === 'production' 
    ? path.join('/app/db', 'perricheno.db') 
    : path.join(process.cwd(), 'perricheno.db');

// Declare global type for db
declare global {
    var db: ReturnType<typeof Database> | undefined;
    var taskSchedulerActive: boolean | undefined;
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = globalThis.db || new Database(dbPath);

if (process.env.NODE_ENV !== 'production') {
    globalThis.db = db;
}

// Initialize tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id TEXT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        photo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_text TEXT NOT NULL,
        remind_at DATETIME NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        doc_type TEXT DEFAULT 'research',
        settings_json TEXT,
        main_tex TEXT,
        references_bib TEXT,
        visuals_json TEXT,
        share_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        metadata_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS visual_assets (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        session_id TEXT,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        source_code TEXT,
        prompt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS bot_sessions (
        telegram_id TEXT PRIMARY KEY,
        session_data TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        user_agent TEXT,
        ip TEXT,
        location TEXT,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);

// Migration: Ensure bot_sessions uses telegram_id instead of user_id
try {
    const tableInfo = db.prepare("PRAGMA table_info(bot_sessions)").all() as any[];
    const hasUserId = tableInfo.some(col => col.name === 'user_id');
    if (hasUserId) {
        console.log("🔄 Migrating bot_sessions table (Legacy user_id detected)...");
        db.exec("DROP TABLE bot_sessions");
        db.exec(`
            CREATE TABLE bot_sessions (
                telegram_id TEXT PRIMARY KEY,
                session_data TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
} catch (e) {
    console.error("⚠️ Failed to migrate bot_sessions:", e);
}
try { db.exec("ALTER TABLE agent_sessions ADD COLUMN status TEXT DEFAULT 'done'"); } catch (e) {}
try { db.exec("ALTER TABLE agent_sessions ADD COLUMN error_msg TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE agent_sessions ADD COLUMN stream_text TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE agent_sessions RENAME COLUMN r_images_json TO visuals_json"); } catch (e) {}
try { db.exec("ALTER TABLE agent_sessions ADD COLUMN tg_message_id INTEGER"); } catch (e) {}

// Strict Limits Migrations
try { db.exec("ALTER TABLE users ADD COLUMN daily_chars_used INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN purchased_chars INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN daily_visuals_used INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN purchased_visuals INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN daily_reports_used INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN purchased_reports INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN last_reset_date TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN account_tier TEXT DEFAULT 'free'"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN plan_tier TEXT DEFAULT 'free'"); } catch (e) {} // newly added
try { db.exec("ALTER TABLE users ADD COLUMN weekly_chars_used INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN monthly_chars_used INTEGER DEFAULT 0"); } catch (e) {} // newly added
try { db.exec("ALTER TABLE users ADD COLUMN last_week_reset TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT 0"); } catch (e) {}

// Super Admin IDs (Hardcoded for total reliability)
const SUPER_ADMINS = ['1153844209', '5934503762']; // Added multiple IDs to be safe

try {
    for (const adminId of SUPER_ADMINS) {
        db.prepare("UPDATE users SET is_admin = 1 WHERE telegram_id = ?").run(adminId);
    }
    console.log("🛡️ Super-admins promoted successfully.");
} catch (e) {
    console.error("⚠️ Failed to promote super-admins:", e);
}

// Deep Link Auth requests table
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS auth_requests (
            token TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'pending',
            tg_user_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
} catch (e) {}

// Logging tracking tables
try { 
    db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            topic TEXT NOT NULL,
            amount_text TEXT NOT NULL,
            is_positive BOOLEAN NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
} catch (e) {}

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            pack_name TEXT NOT NULL,
            amount_text TEXT NOT NULL,
            pdf_base64 TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);
} catch (e) {}

// Idempotency: Processed Payments to prevent replay attacks
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS processed_payments (
            order_id TEXT PRIMARY KEY,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
} catch (e) {}

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS usage_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tokens INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
} catch (e) {}

// OVERSEER Advanced Tables
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS promo_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            uses INTEGER DEFAULT 0,
            max_uses INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
} catch (e) {}

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS promo_usages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            promo_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(promo_id, user_id)
        )
    `);
} catch (e) {}

// Migration: Add is_active column to promo_codes
try { db.exec("ALTER TABLE promo_codes ADD COLUMN is_active BOOLEAN DEFAULT 1"); } catch (e) {}

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
} catch (e) {}

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS system_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            read BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
} catch (e) {}

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS latex_errors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            error_text TEXT NOT NULL,
            session_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
} catch (e) {}

// Referral Tracking
try { db.exec("ALTER TABLE users ADD COLUMN referred_by INTEGER"); } catch (e) {}

export function getReferralStats(userId: number) {
    const row = db.prepare('SELECT COUNT(*) as count FROM users WHERE referred_by = ?').get(userId) as any;
    const invitedCount = row ? row.count : 0;
    
    // Sum tokens from transaction history for "Referral Bonus"
    const bonusRow = db.prepare(`SELECT SUM(CAST(REPLACE(REPLACE(amount_text, '+', ''), ' chars', '') AS INTEGER)) as total FROM transactions WHERE user_id = ? AND topic = 'Referral Bonus'`).get(userId) as any;
    const totalBonus = bonusRow ? (bonusRow.total || 0) : 0;
    
    return { invitedCount, totalBonus };
}

export default db;

export interface User {
    id: number;
    telegram_id: string;
    username: string | null;
    first_name: string | null;
    photo_url: string | null;
    created_at: string;
    
    // Usage limits
    plan_tier?: string;
    daily_chars_used: number;
    weekly_chars_used: number;
    monthly_chars_used?: number;
    purchased_chars: number;
    daily_visuals_used: number;
    purchased_visuals: number;
    daily_reports_used: number;
    purchased_reports: number;

    last_reset_date: string | null;
    last_week_reset: string | null;
    is_banned: number;
    is_admin: number;
    referred_by: number | null;
}

export function getUserByTelegramId(telegramId: string): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    return stmt.get(telegramId) as User | undefined;
}

export function getUserById(id: number): User | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
}

export function upsertUser(data: { telegram_id: string; username?: string; first_name?: string; photo_url?: string }): User {
    const { telegram_id, username, first_name, photo_url } = data;

    // Check if exists (including deleted ones to prevent limit reset abuse)
    const existing = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id) as User | undefined;

    if (existing) {
        // Update and Revive (clear is_deleted flag)
        const stmt = db.prepare(`
            UPDATE users 
            SET username = ?, first_name = ?, photo_url = ?, is_deleted = 0
            WHERE telegram_id = ?
        `);
        stmt.run(username || null, first_name || null, photo_url || null, telegram_id);
        return getUserByTelegramId(telegram_id)!;
    } else {
        // Insert new
        const stmt = db.prepare(`
            INSERT INTO users (telegram_id, username, first_name, photo_url, last_reset_date, is_deleted)
            VALUES (?, ?, ?, ?, ?, 0)
        `);
        const today = new Date().toISOString().split('T')[0];
        stmt.run(telegram_id, username || null, first_name || null, photo_url || null, today);
        return getUserByTelegramId(telegram_id)!;
    }
}

export function deleteUser(id: number) {
    // ANTI-ABUSE: Clear identity data but keep the row and limits
    const stmt = db.prepare('UPDATE users SET is_deleted = 1, username = NULL, first_name = NULL, photo_url = NULL WHERE id = ?');
    stmt.run(id);
}

// --- Strict Usage Tracking ---

export const PLAN_LIMITS: Record<string, { weekly_chars: number, monthly_chars: number }> = {
    free: { weekly_chars: 50000, monthly_chars: 150000 },
    plus: { weekly_chars: 150000, monthly_chars: 450000 },
    pro: { weekly_chars: 250000, monthly_chars: 800000 },
    ultra: { weekly_chars: 800000, monthly_chars: 3000000 }
};

function getWeekNumber(d: Date): string {
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - start.getTime();
    const oneWeek = 604800000;
    return `${d.getFullYear()}-W${Math.ceil((diff / oneWeek) + 1)}`;
}

export function checkAndDeductUsage(
    userId: number, 
    type: 'chars' | 'visuals' | 'reports', 
    amount: number = 1
): { success: boolean; remaining: number } {
    let user = getUserById(userId);
    if (!user) return { success: false, remaining: 0 };

    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekNumber(new Date());
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Reset daily limits if it's a new day
    if (user.last_reset_date !== today) {
        db.prepare(`
            UPDATE users 
            SET daily_chars_used = 0, daily_visuals_used = 0, daily_reports_used = 0, last_reset_date = ?
            WHERE id = ?
        `).run(today, userId);
        
        db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Daily quota reset", "Reset", 1);
        user = getUserById(userId)!;
    }

    // Reset weekly limits if it's a new week
    if (user.last_week_reset !== currentWeek) {
        db.prepare(`
            UPDATE users SET weekly_chars_used = 0, last_week_reset = ? WHERE id = ?
        `).run(currentWeek, userId);
        user = getUserById(userId)!;
    }

    // Reset monthly limits manually based on whether 30 days passed? The db has no monthly reset yet.
    // For simplicity, let's assume we don't implicitly reset monthly limits inside this function if it's subscription-based.
    // Actually, subscriptions are monthly, so let's reset it if they renew! Since we don't have a next_billing_date yet, 
    // let's just make it reset on the 1st of the month for now.
    // To do this, let's add last_month_reset logically. Wait, the user db doesn't have last_month_reset column.
    // Let's just track `monthly_chars_used` and only reset it via webhook when they renew.
    // The instructions say: "месячный лимит имеется ввиду доступный баланс на месяц... ждать след мес."
    // So the webhook sets it to 0 when they buy/renew. No automatic reset here unless we have a specific cron job.

    // Visuals have NO quota limit — they just count chars
    if (type === 'visuals') {
        db.prepare(`UPDATE users SET daily_visuals_used = daily_visuals_used + ? WHERE id = ?`).run(amount, userId);
        db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Visual generation", `-${amount} chars`, 0);
        db.prepare(`INSERT INTO usage_logs (user_id, tokens) VALUES (?, ?)`).run(userId, amount);
        return { success: true, remaining: 999999 };
    }

    const planId = user.plan_tier || 'free';
    const limits = PLAN_LIMITS[planId] || PLAN_LIMITS['free'];

    if (type === 'chars') {
        const weeklyMax = limits.weekly_chars;
        const monthlyMax = limits.monthly_chars;
        const purchased = user.purchased_chars;

        const remainingWeekly = Math.max(0, weeklyMax - user.weekly_chars_used);
        const remainingMonthly = Math.max(0, monthlyMax - (user.monthly_chars_used || 0));
        
        // The max they can use right now is whichever is smaller: remainingWeekly or remainingMonthly
        const freeAvailable = Math.min(remainingWeekly, remainingMonthly);
        const totalAvailable = freeAvailable + purchased;

        if (totalAvailable < amount) return { success: false, remaining: totalAvailable };

        const fromFree = Math.min(freeAvailable, amount);
        const fromPurchased = amount - fromFree;

        db.prepare(`
            UPDATE users 
            SET daily_chars_used = daily_chars_used + ?,
                weekly_chars_used = weekly_chars_used + ?,
                monthly_chars_used = COALESCE(monthly_chars_used, 0) + ?,
                purchased_chars = purchased_chars - ?
            WHERE id = ?
        `).run(fromFree, fromFree, fromFree, fromPurchased, userId);

        if (amount > 0) {
            db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Agent generation", `-${amount.toLocaleString()} chars`, 0);
            db.prepare(`INSERT INTO usage_logs (user_id, tokens) VALUES (?, ?)`).run(userId, amount);
        }

        return { success: true, remaining: totalAvailable - amount };
    }

    // Reports are not actively restricted by new limits, use fallback 999 
    // unless they purchased specific packages. Let's just track it loosely.
    return { success: true, remaining: 999 };
}

export function addPurchasedTokens(userId: number, type: 'chars' | 'visuals' | 'reports', amount: number) {
    db.prepare(`UPDATE users SET purchased_${type} = purchased_${type} + ? WHERE id = ?`).run(amount, userId);
    
    let typeName = type === 'chars' ? 'chars' : type === 'reports' ? 'reports' : 'visuals';
    if (amount > 0) {
        db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Purchased resource pack", `+${amount.toLocaleString()} ${typeName}`, 1);
    }
}

export function upgradeSubscriptionPlan(userId: number, planId: string) {
    // planId from checkout resembles "plus_month", "pro_year", etc.
    const parts = planId.split('_');
    const tier = parts[0]; // 'plus', 'pro', 'ultra'
    
    if (['plus', 'pro', 'ultra'].includes(tier)) {
        db.prepare(`
            UPDATE users 
            SET plan_tier = ?,
                account_tier = ?,
                monthly_chars_used = 0
            WHERE id = ?
        `).run(tier, tier, userId);
        
        db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Subscription Upgrade", `Tier: ${tier.toUpperCase()}`, 1);
    }
}

export function isPaymentProcessed(orderId: string): boolean {
    const stmt = db.prepare('SELECT 1 FROM processed_payments WHERE order_id = ?');
    return !!stmt.get(orderId);
}

export function markPaymentProcessed(orderId: string): void {
    const stmt = db.prepare('INSERT INTO processed_payments (order_id) VALUES (?)');
    stmt.run(orderId);
}

// --- Tasks ---

export interface Task {
    id: number;
    user_id: number;
    task_text: string;
    remind_at: string;
    status: 'pending' | 'done';
    created_at: string;
}

export function getTasksByUserId(userId: number): Task[] {
    const stmt = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY remind_at ASC');
    return stmt.all(userId) as Task[];
}

export function createTask(userId: number, text: string, remindAt: string): Task {
    const stmt = db.prepare(`
        INSERT INTO tasks (user_id, task_text, remind_at)
        VALUES (?, ?, ?)
    `);
    const info = stmt.run(userId, text, remindAt);
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid) as Task;
}

export function updateTaskStatus(taskId: number, status: 'pending' | 'done'): void {
    const stmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ?');
    stmt.run(status, taskId);
}

export function deleteTask(taskId: number): void {
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run(taskId);
}

export function getPendingTasksToRemind(currentTimeIso: string): Task[] {
    const stmt = db.prepare("SELECT * FROM tasks WHERE status = 'pending' AND remind_at <= ?");
    return stmt.all(currentTimeIso) as Task[];
}

// --- Background Task Scheduler (Server-side only) ---
if (typeof window === 'undefined') {
    const POLLING_INTERVAL = 60000; // Every 1 min
    
    // We attach the interval to globalThis to prevent multiple intervals during Next.js HMR
    if (!globalThis.taskSchedulerActive) {
        globalThis.taskSchedulerActive = true;
        
        setInterval(async () => {
            try {
                const now = new Date().toISOString();
                
                // --- Cleanup stuck sessions ---
                cleanupStuckSessions();

                const pending = getPendingTasksToRemind(now);
                const botToken = process.env.TELEGRAM_BOT_TOKEN;

                if (!botToken || pending.length === 0) return;

                for (const task of pending) {
                    const user = getUserById(task.user_id);
                    if (!user || !user.telegram_id) continue;

                    // Send Telegram Reminder
                    const text = `🔔 *Reminder!*\n\n${task.task_text}`;
                    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: user.telegram_id,
                            text: text,
                            parse_mode: 'Markdown'
                        })
                    });

                    if (res.ok) {
                        updateTaskStatus(task.id, 'done');
                    } else {
                        console.error('Failed to send reminder:', await res.text());
                    }
                }
            } catch (err) {
                console.error('Error in task scheduler interval:', err);
            }
        }, POLLING_INTERVAL);
        
        console.log('Task background scheduler started.');
    }
}

// --- Agent Sessions ---

export interface AgentSession {
    id: string;
    user_id: number;
    title: string;
    doc_type: string;
    settings_json: string | null;
    main_tex: string | null;
    references_bib: string | null;
    visuals_json: string | null;
    share_id: string | null;
    status: string;
    error_msg: string | null;
    stream_text: string | null;
    tg_message_id: number | null;
    created_at: string;
    updated_at: string;
}

export function createAgentSession(data: {
    id: string;
    user_id: number;
    title: string;
    doc_type: string;
    settings_json?: string;
    main_tex?: string;
    references_bib?: string;
    visuals_json?: string;
    status?: string;
    stream_text?: string;
    tg_message_id?: number;
    share_id?: string;
} | any): AgentSession {
    const stmt = db.prepare(`
        INSERT INTO agent_sessions (id, user_id, title, doc_type, settings_json, main_tex, references_bib, visuals_json, status, stream_text, tg_message_id, share_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(data.id, data.user_id, data.title, data.doc_type, data.settings_json || null, data.main_tex || null, data.references_bib || null, data.visuals_json || null, data.status || 'done', data.stream_text || null, data.tg_message_id || null, data.share_id || null);
    return db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(data.id) as AgentSession;
}

export function getAgentSessionsByUser(userId: number): AgentSession[] {
    return db.prepare('SELECT id, user_id, title, doc_type, share_id, status, created_at, updated_at FROM agent_sessions WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as AgentSession[];
}

export function getAgentSession(id: string): AgentSession | undefined {
    return db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(id) as AgentSession | undefined;
}

export function getAgentSessionByShareId(shareId: string): AgentSession | undefined {
    return db.prepare('SELECT * FROM agent_sessions WHERE share_id = ?').get(shareId) as AgentSession | undefined;
}

export function getRecentSessionByTitle(userId: number, title: string): AgentSession | undefined {
    // Find session with same title for this user created in the last 1 hour
    return db.prepare(`
        SELECT * FROM agent_sessions 
        WHERE user_id = ? AND title = ? 
        AND created_at > datetime('now', '-1 hour')
        ORDER BY created_at DESC 
        LIMIT 1
    `).get(userId, title) as AgentSession | undefined;
}

export function updateAgentSession(id: string, data: {
    title?: string;
    main_tex?: string | null;
    references_bib?: string | null;
    visuals_json?: string | null;
    settings_json?: string | null;
    status?: string;
    error_msg?: string | null;
    stream_text?: string | null;
    tg_message_id?: number | null;
    share_id?: string | null;
}): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { fields.push('title = ?'); values.push(data.title); }
    if (data.main_tex !== undefined) { fields.push('main_tex = ?'); values.push(data.main_tex); }
    if (data.references_bib !== undefined) { fields.push('references_bib = ?'); values.push(data.references_bib); }
    if (data.visuals_json !== undefined) { fields.push('visuals_json = ?'); values.push(data.visuals_json); }
    if (data.settings_json !== undefined) { fields.push('settings_json = ?'); values.push(data.settings_json); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.error_msg !== undefined) { fields.push('error_msg = ?'); values.push(data.error_msg); }
    if (data.stream_text !== undefined) { fields.push('stream_text = ?'); values.push(data.stream_text); }
    if (data.tg_message_id !== undefined) { fields.push('tg_message_id = ?'); values.push(data.tg_message_id); }
    if (data.share_id !== undefined) { fields.push('share_id = ?'); values.push(data.share_id); }

    if (fields.length === 0) return;

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    db.prepare(`UPDATE agent_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteAgentSession(id: string, userId: number): boolean {
    const info = db.prepare('DELETE FROM agent_sessions WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
}

export function toggleAgentSessionShare(id: string, userId: number): string | null {
    const session = db.prepare('SELECT * FROM agent_sessions WHERE id = ? AND user_id = ?').get(id) as AgentSession | undefined;
    if (!session) return null;

    if (session.share_id) {
        // Remove share
        db.prepare('UPDATE agent_sessions SET share_id = NULL WHERE id = ?').run(id);
        return null;
    } else {
        // Generate share ID
        const shareId = crypto.randomUUID().split('-')[0]; // short 8-char ID
        db.prepare('UPDATE agent_sessions SET share_id = ? WHERE id = ?').run(shareId, id);
        return shareId;
    }
}

export function getActiveAgentSessionsCount(userId: number): number {
    const stmt = db.prepare("SELECT COUNT(*) as count FROM agent_sessions WHERE user_id = ? AND status = 'generating'");
    const res = stmt.get(userId) as { count: number };
    return res.count;
}

export async function sendTelegramNotification(userId: number, message: string): Promise<number | null> {
    try {
        const user = getUserById(userId);
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        
        if (!user || !user.telegram_id || !botToken) return null;

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.telegram_id,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        if (res.ok) {
            const data = await res.json();
            return data.result.message_id;
        }
        return null;
    } catch (e) {
        console.error("Failed to send Telegram notification:", e);
        return null;
    }
}

export async function updateTelegramNotification(userId: number, messageId: number, message: string): Promise<void> {
    try {
        const user = getUserById(userId);
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!user || !user.telegram_id || !botToken) return;

        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.telegram_id,
                message_id: messageId,
                text: message,
                parse_mode: 'Markdown'
            })
        });
    } catch (e) {
        console.error("Failed to update Telegram notification:", e);
    }
}

export async function deleteTelegramNotification(userId: number, messageId: number): Promise<void> {
    try {
        const user = getUserById(userId);
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!user || !user.telegram_id || !botToken) return;

        await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: user.telegram_id,
                message_id: messageId
            })
        });
    } catch (e) {
        // Silent error for delete, might already be deleted or too old
    }
}

// --- Bot Persistence ---

export function getBotSession(telegramId: string): any | null {
    const row = db.prepare('SELECT session_data FROM bot_sessions WHERE telegram_id = ?').get(telegramId) as any;
    if (!row) return null;
    try {
        return JSON.parse(row.session_data);
    } catch {
        return null;
    }
}

export function updateBotSession(telegramId: string, data: any): void {
    const sessionJson = JSON.stringify(data);
    db.prepare(`
        INSERT INTO bot_sessions (telegram_id, session_data, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(telegram_id) DO UPDATE SET 
            session_data = excluded.session_data,
            updated_at = CURRENT_TIMESTAMP
    `).run(telegramId, sessionJson);
}

// --- Stateful Sessions ---

export function createSessionRecord(data: { id: string, user_id: number, user_agent?: string, ip?: string, location?: string }) {
    const stmt = db.prepare(`
        INSERT INTO sessions (id, user_id, user_agent, ip, location)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(data.id, data.user_id, data.user_agent || null, data.ip || null, data.location || null);
}

export function getSessionById(id: string) {
    return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
}

export function getSessionsByUserId(userId: number) {
    return db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
}

export function deleteSessionRecord(id: string) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function deleteAllOtherSessions(userId: number, currentSessionId: string) {
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(userId, currentSessionId);
}

export function cleanupStuckSessions(): void {
    // Reset sessions that have been 'generating' for more than 15 minutes.
    // This handles server restarts or crashes mid-task.
    db.prepare(`
        UPDATE agent_sessions 
        SET status = 'error', error_msg = 'Session timed out (system restart or crash)' 
        WHERE status = 'generating' AND updated_at < datetime('now', '-15 minutes')
    `).run();
}
