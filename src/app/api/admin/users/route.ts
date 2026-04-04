import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import db, { getUserById } from '@/lib/db';

async function verifyAdmin() {
    const userId = await verifySession();
    if (!userId) return null;
    const user = getUserById(userId);
    if (!user || user.telegram_id !== '1153844209') return null;
    return user;
}

export async function GET(req: Request) {
    const admin = await verifyAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const url = new URL(req.url);
        const search = url.searchParams.get('search') || '';
        
        let users;
        if (search) {
            const stmt = db.prepare(`SELECT * FROM users WHERE telegram_id LIKE ? OR username LIKE ? OR first_name LIKE ? ORDER BY created_at DESC LIMIT 50`);
            users = stmt.all(`%${search}%`, `%${search}%`, `%${search}%`);
        } else {
            const stmt = db.prepare(`SELECT * FROM users ORDER BY created_at DESC LIMIT 50`);
            users = stmt.all();
        }

        return NextResponse.json({ users });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const admin = await verifyAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const data = await req.json();
        const { targetUserId, action, amount, tier } = data;

        const targetUser = getUserById(targetUserId);
        if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

        if (action === 'grant_chars' || action === 'grant_reports') {
            const isChars = action === 'grant_chars';
            const resourceName = isChars ? 'chars' : 'reports';
            
            db.prepare(`UPDATE users SET purchased_${resourceName} = purchased_${resourceName} + ? WHERE id = ?`).run(amount, targetUserId);
            db.prepare(`INSERT INTO transactions (user_id, topic, amount_text, is_positive) VALUES (?, ?, ?, ?)`).run(targetUserId, "Admin Bonus", `+${amount.toLocaleString()} ${resourceName}`, 1);

            // Trigger receipt generation
            const receiptId = `PRN-BONUS-${Date.now().toString(36).toUpperCase()}-${targetUserId}`;
            const amountText = `${amount.toLocaleString()} ${resourceName} (Bonus)`;
            
            try {
                const { generateAndStoreReceipt } = await import('@/lib/receiptGenerator');
                generateAndStoreReceipt({
                    id: receiptId,
                    userId: targetUserId,
                    type: 'admin_bonus',
                    packName: `Admin Bonus`,
                    amountText: amountText,
                    dateISO: new Date().toISOString()
                }).catch(e => console.error("Receipt background gen failed:", e));
            } catch (e) {
                console.error("Failed to trigger receipt generator:", e);
            }

        } else if (action === 'set_tier') {
            db.prepare('UPDATE users SET account_tier = ? WHERE id = ?').run(tier, targetUserId);
        } else if (action === 'toggle_ban') {
            const newBanStatus = targetUser.is_banned ? 0 : 1;
            db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(newBanStatus, targetUserId);
            return NextResponse.json({ success: true, newBanStatus });
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
