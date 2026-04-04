"use server";

import { revalidatePath } from "next/cache";
import db, { getUserById } from "@/lib/db";
import { verifySession } from "@/lib/session";
import crypto from "crypto";

export async function generateSecurePromoCode() {
    await verifyAdmin();
    // Generate a long SHA-512 hash as the promo code base
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha512').update(raw).digest('hex');
    return { success: true, code: hash.toUpperCase() };
}

async function verifyAdmin() {
    const userId = await verifySession();
    if (!userId) throw new Error("Unauthorized");
    const user = getUserById(userId);
    if (!user || user.telegram_id !== '1153844209') throw new Error("Forbidden");
    return user;
}

export async function createPromoCode(code: string, type: string, amount: number, maxUses: number) {
    await verifyAdmin();
    db.prepare(`INSERT INTO promo_codes (code, type, amount, max_uses) VALUES (?, ?, ?, ?)`).run(code, type, amount, maxUses);
    revalidatePath("/dashboard");
    return { success: true };
}

export async function setSystemConfig(key: string, value: string) {
    await verifyAdmin();
    db.prepare(`INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value);
    revalidatePath("/dashboard");
    return { success: true };
}

export async function manageUserTokens(userId: number, action: string, amount: number) {
    await verifyAdmin();
    const user = getUserById(userId);
    if (!user) throw new Error("User missing");

    if (action === 'grant_chars') {
        db.prepare('UPDATE users SET purchased_chars = purchased_chars + ? WHERE id = ?').run(amount, userId);
        db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Admin System Grant", `+${amount.toLocaleString()} chars`, 1);
    } else if (action === 'grant_reports') {
        db.prepare('UPDATE users SET purchased_reports = purchased_reports + ? WHERE id = ?').run(amount, userId);
        db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(userId, "Admin System Grant", `+${amount.toLocaleString()} reports`, 1);
    } else if (action === 'toggle_freeze') {
        const newStatus = user.is_banned ? 0 : 1;
        db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(newStatus, userId);
    }
    revalidatePath("/dashboard");
    return { success: true };
}

export async function sendDirectMessage(userId: number, message: string) {
    const admin = await verifyAdmin();
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const BOT_INTERNAL_URL = "http://telegram-bot:3001/bot-internal";

    // 1. Save to DB
    db.prepare(`INSERT INTO system_notifications (user_id, message) VALUES (?, ?)`).run(userId, message);

    // 2. PUSH to Telegram Bot
    try {
        const user = getUserById(userId);
        if (user && user.telegram_id) {
            const formatted = `📩 *Сообщение от администрации Perricheno*:\n\n${message}`;
            await fetch(`${BOT_INTERNAL_URL}/send-message`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                body: JSON.stringify({ userId: user.telegram_id, text: formatted })
            });
        }
    } catch (err) {
        console.error("Failed to push DM to bot:", err);
    }

    revalidatePath("/dashboard");
    return { success: true };
}

export async function checkServiceHealth(serviceId: string) {
    const admin = await verifyAdmin();
    const log: string[] = [`[${new Date().toISOString()}] Starting diagnostic for: ${serviceId}`];
    let status: 'online' | 'offline' | 'error' = 'online';

    try {
        switch (serviceId) {
            case 'openai': {
                log.push("Pinging OpenAI API (v1/models)...");
                const res = await fetch("https://api.openai.com/v1/models", {
                    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` }
                });
                const data = await res.json();
                if (res.ok) {
                    log.push(`SUCCESS: Received ${data.data?.length || 0} models.`);
                } else {
                    status = 'error';
                    log.push(`ERROR ${res.status}: ${JSON.stringify(data.error || data)}`);
                }
                break;
            }
            case 'latex': {
                const url = process.env.LATEX_COMPILER_URL || 'http://latex-compiler:8000';
                log.push(`Checking LaTeX Compiler at ${url}/health...`);
                const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
                if (res.ok) {
                    log.push("SUCCESS: Compiler is healthy and responsive.");
                } else {
                    status = 'error';
                    log.push(`ERROR ${res.status}: ${await res.text()}`);
                }
                break;
            }
            case 'python': {
                const url = process.env.PYTHON_COMPILER_URL || 'http://python-compiler:8000';
                log.push(`Checking Python Matrix at ${url}/health...`);
                const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
                if (res.ok) {
                    log.push("SUCCESS: Python Sandbox is active.");
                } else {
                    status = 'error';
                    log.push(`ERROR ${res.status}: ${await res.text()}`);
                }
                break;
            }
            case 'r': {
                const url = process.env.R_COMPILER_URL || 'http://r-compiler:8000';
                log.push(`Checking R-Node at ${url}/health...`);
                const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
                if (res.ok) {
                    log.push("SUCCESS: R Environment is active.");
                } else {
                    status = 'error';
                    log.push(`ERROR ${res.status}: ${await res.text()}`);
                }
                break;
            }
            case 'fx': {
                log.push("Checking Exchange Rate API (open.er-api.com)...");
                const res = await fetch("https://open.er-api.com/v6/latest/USD");
                if (res.ok) {
                    const data = await res.json();
                    if (data.result === 'success') {
                        log.push(`SUCCESS: Base USD, KZT: ${data.rates.KZT}, RUB: ${data.rates.RUB}`);
                    } else {
                        status = 'error';
                        log.push(`API ERROR: ${data['error-type'] || 'Unknown'}`);
                    }
                } else {
                    status = 'error';
                    log.push(`NETWORK ERROR ${res.status}`);
                }
                break;
            }
            case 'db': {
                log.push("Checking SQLite V-Base Integrity...");
                const start = Date.now();
                const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
                const end = Date.now();
                log.push(`SUCCESS: ${users.count} user records indexed. Latency: ${end - start}ms`);
                break;
            }
            default:
                log.push(`Unknown service ID: ${serviceId}`);
                status = 'error';
        }
    } catch (err: any) {
        status = 'offline';
        log.push(`CRITICAL: Service unreachable or connection refused. ${err.message}`);
    }

    return { status, log: log.join('\n') };
}
