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
`);

export default db;

export interface User {
    id: number;
    telegram_id: string;
    username: string | null;
    first_name: string | null;
    photo_url: string | null;
    created_at: string;
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
            INSERT INTO users (telegram_id, username, first_name, photo_url)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(telegram_id, username || null, first_name || null, photo_url || null);
        return {
            id: Number(info.lastInsertRowid),
            telegram_id,
            username: username || null,
            first_name: first_name || null,
            photo_url: photo_url || null,
            created_at: new Date().toISOString() // Approximate
        };
    }
}

export function deleteUser(id: number) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(id);
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
    const stmt = db.prepare('SELECT * FROM tasks WHERE status = "pending" AND remind_at <= ?');
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
