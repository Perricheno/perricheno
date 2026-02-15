import Database from 'better-sqlite3';
import path from 'path';

// For Next.js development, we need to ensure we don't create multiple connections
// but better-sqlite3 handles this well as long as we reuse the instance or rely on Next.js clearing cache.
// However, in dev mode, module might reload. We can use globalThis pattern.

const dbPath = path.join(process.cwd(), 'perricheno.db');

// Declare global type for db
declare global {
    var db: ReturnType<typeof Database> | undefined;
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
    )
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
