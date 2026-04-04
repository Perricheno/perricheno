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
`);

// Safe migrations for legacy database updates
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
try { db.exec("ALTER TABLE users ADD COLUMN weekly_chars_used INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN last_week_reset TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT 0"); } catch (e) {}

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

export default db;

export interface User {
    id: number;
    telegram_id: string;
    username: string | null;
    first_name: string | null;
    photo_url: string | null;
    created_at: string;
    
    // Usage limits
    daily_chars_used: number;
    weekly_chars_used: number;
    purchased_chars: number;
    daily_visuals_used: number;
    purchased_visuals: number;
    daily_reports_used: number;
    purchased_reports: number;
    last_reset_date: string | null;
    last_week_reset: string | null;
    account_tier: string;
    is_banned: number;
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

    // Check if exists
    const existing = getUserByTelegramId(telegram_id);

    if (existing) {
        // Update
        const stmt = db.prepare(`
            UPDATE users 
            SET username = ?, first_name = ?, photo_url = ?
            WHERE telegram_id = ?
        `);
        stmt.run(username || null, first_name || null, photo_url || null, telegram_id);
        return getUserByTelegramId(telegram_id)!;
    } else {
        // Insert
        const stmt = db.prepare(`
            INSERT INTO users (telegram_id, username, first_name, photo_url, last_reset_date)
            VALUES (?, ?, ?, ?, ?)
        `);
        const today = new Date().toISOString().split('T')[0];
        const info = stmt.run(telegram_id, username || null, first_name || null, photo_url || null, today);
        return getUserByTelegramId(telegram_id)!;
    }
}

export function deleteUser(id: number) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(id);
}

// --- Strict Usage Tracking ---

export const LIMITS = {
    free: { daily_chars: 100000, weekly_chars: 500000, reports: 1 }
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

    // Visuals have NO quota limit — they just count chars
    if (type === 'visuals') {
        db.prepare(`UPDATE users SET daily_visuals_used = daily_visuals_used + ? WHERE id = ?`).run(amount, userId);
        db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Visual generation", `-${amount} chars`, 0);
        db.prepare(`INSERT INTO usage_logs (user_id, tokens) VALUES (?, ?)`).run(userId, amount);
        return { success: true, remaining: 999999 };
    }

    if (type === 'chars') {
        const dailyMax = LIMITS.free.daily_chars;
        const weeklyMax = LIMITS.free.weekly_chars;
        const purchased = user.purchased_chars;

        const remainingDaily = Math.max(0, dailyMax - user.daily_chars_used);
        const remainingWeekly = Math.max(0, weeklyMax - user.weekly_chars_used);
        const freeAvailable = Math.min(remainingDaily, remainingWeekly);
        const totalAvailable = freeAvailable + purchased;

        if (totalAvailable < amount) return { success: false, remaining: totalAvailable };

        const fromFree = Math.min(freeAvailable, amount);
        const fromPurchased = amount - fromFree;

        db.prepare(`
            UPDATE users 
            SET daily_chars_used = daily_chars_used + ?,
                weekly_chars_used = weekly_chars_used + ?,
                purchased_chars = purchased_chars - ?
            WHERE id = ?
        `).run(fromFree, fromFree, fromPurchased, userId);

        if (amount > 0) {
            db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Agent generation", `-${amount.toLocaleString()} chars`, 0);
            db.prepare(`INSERT INTO usage_logs (user_id, tokens) VALUES (?, ?)`).run(userId, amount);
        }

        return { success: true, remaining: totalAvailable - amount };
    }

    // Reports
    const maxDaily = LIMITS.free.reports;
    const usedDaily = user.daily_reports_used;
    const purchased = user.purchased_reports;
    const remainingDaily = Math.max(0, maxDaily - usedDaily);
    const totalAvailable = remainingDaily + purchased;

    if (totalAvailable < amount) return { success: false, remaining: totalAvailable };

    const amountToDeductDaily = Math.min(remainingDaily, amount);
    const amountToDeductPurchased = amount - amountToDeductDaily;

    db.prepare(`
        UPDATE users 
        SET daily_reports_used = daily_reports_used + ?,
            purchased_reports = purchased_reports - ?
        WHERE id = ?
    `).run(amountToDeductDaily, amountToDeductPurchased, userId);

    db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Report compilation", `-${amount} reports`, 0);

    return { success: true, remaining: totalAvailable - amount };
}

export function addPurchasedTokens(userId: number, type: 'chars' | 'visuals' | 'reports', amount: number) {
    db.prepare(`UPDATE users SET purchased_${type} = purchased_${type} + ? WHERE id = ?`).run(amount, userId);
    
    let typeName = type === 'chars' ? 'chars' : type === 'reports' ? 'reports' : 'visuals';
    if (amount > 0) {
        db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Purchased resource pack", `+${amount.toLocaleString()} ${typeName}`, 1);
    }
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
