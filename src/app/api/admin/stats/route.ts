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
        // Global Stats
        const totalUsersResult = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
        const totalCharsResult = db.prepare('SELECT SUM(tokens) as count FROM usage_logs').get() as { count: number };
        
        // Find total purchases (is_positive = 1 and like 'Purchased%')
        // In this case, we just count how many purchase transactions there are
        const totalPurchasesResult = db.prepare(`SELECT COUNT(*) as count FROM transactions WHERE is_positive = 1 AND topic = 'Purchased resource pack'`).get() as { count: number };

        const recentLogsResult = db.prepare(`SELECT tokens, created_at FROM usage_logs WHERE created_at >= datetime('now', '-7 days')`).all() as any[];

        // Build 7 day array
        const now = new Date();
        const weekData = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(now.getTime() - (6 - i) * 86400000);
            return {
                label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                value: 0
            };
        });

        // Fill week data
        recentLogsResult.forEach(log => {
            const logTime = new Date(log.created_at + 'Z');
            const diffMs = now.getTime() - logTime.getTime();
            const diffDays = Math.floor(diffMs / 86400000);
            if (diffDays >= 0 && diffDays < 7) {
                const idx = 6 - diffDays;
                if (weekData[idx]) weekData[idx].value += log.tokens;
            }
        });

        return NextResponse.json({
            stats: {
                totalUsers: totalUsersResult.count,
                totalUsage: totalCharsResult.count || 0,
                totalTransactions: totalPurchasesResult.count
            },
            weekData
        });

    } catch (err: any) {
        console.error("Admin stats error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
