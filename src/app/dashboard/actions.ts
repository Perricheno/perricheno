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
