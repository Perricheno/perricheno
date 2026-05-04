"use server";

import { revalidatePath } from "next/cache";
import { getUserById } from "@/lib/db";
import { prisma } from "@/lib/prisma";
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
    const user = await getUserById(userId);
    if (!user || user.telegram_id !== '1153844209') throw new Error("Forbidden");
    return user;
}

export async function createPromoCode(code: string, type: string, amount: number, maxUses: number) {
    await verifyAdmin();
    await prisma.promoCode.create({ data: { code, type, amount, max_uses: maxUses } });
    revalidatePath("/dashboard");
    return { success: true };
}

export async function setSystemConfig(key: string, value: string) {
    await verifyAdmin();
    await prisma.systemConfig.upsert({ where: { key }, update: { value }, create: { key, value } });
    revalidatePath("/dashboard");
    return { success: true };
}

export async function manageUserTokens(userId: number, action: string, amount: number) {
    await verifyAdmin();
    const user = await getUserById(userId);
    if (!user) throw new Error("User missing");

    if (action === 'grant_chars') {
        await prisma.user.update({ where: { id: userId }, data: { purchased_chars: user.purchased_chars + amount } });
        await prisma.transaction.create({ data: { user_id: userId, topic: "Admin System Grant", amount_text: `+${amount.toLocaleString()} chars`, is_positive: true } });
    } else if (action === 'grant_reports') {
        await prisma.user.update({ where: { id: userId }, data: { purchased_reports: user.purchased_reports + amount } });
        await prisma.transaction.create({ data: { user_id: userId, topic: "Admin System Grant", amount_text: `+${amount.toLocaleString()} reports`, is_positive: true } });
    } else if (action === 'toggle_freeze') {
        const newStatus = user.is_banned ? false : true;
        await prisma.user.update({ where: { id: userId }, data: { is_banned: newStatus } });
    }
    revalidatePath("/dashboard");
    return { success: true };
}

export async function sendDirectMessage(userId: number, message: string) {
    const admin = await verifyAdmin();
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const BOT_INTERNAL_URL = "http://telegram-bot:3001/bot-internal";

    // 1. Save to DB
    await prisma.systemNotification.create({ data: { user_id: userId, message } });

    // 2. PUSH to Telegram Bot
    try {
        const user = await getUserById(userId);
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
                const count = await prisma.user.count();
                const end = Date.now();
                log.push(`SUCCESS: ${count || 0} user records indexed. Latency: ${end - start}ms`);
                break;
            }
            case 'stirling': {
                const url = "https://pdf.perricheno.ru/api/v1/info/is-alive";
                const apiKey = "0a69f4b4-0210-47c0-a2a9-946e3e894c4c";
                log.push(`Checking Stirling PDF at ${url}...`);
                const res = await fetch(url, { 
                    headers: { "X-API-KEY": apiKey },
                    signal: AbortSignal.timeout(5000) 
                });
                if (res.ok) {
                    log.push("SUCCESS: Stirling PDF API is alive and authenticated.");
                } else {
                    const txt = await res.text().catch(() => '');
                    status = 'error';
                    log.push(`ERROR ${res.status}: ${txt.slice(0, 100)}`);
                }
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
