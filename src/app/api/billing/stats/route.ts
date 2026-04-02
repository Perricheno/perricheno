import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import db from '@/lib/db';

export async function GET(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    try {
        // Fetch last 15 transactions
        const txStmt = db.prepare(`
            SELECT id, topic as type, amount_text as amount, is_positive, created_at as _date 
            FROM transactions 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 15
        `);
        const transactionsRaw = txStmt.all(userId) as any[];

        // Format dates for transactions
        const transactions = transactionsRaw.map(tx => {
            const d = new Date(tx._date + 'Z'); // sqlite CURRENT_TIMESTAMP is UTC
            return {
                id: `txn_${tx.id}`,
                type: tx.type,
                amount: tx.amount,
                date: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                is_positive: tx.is_positive === 1
            };
        });

        // Calculate usage per hour over the last 24 hours
        // Since SQLite doesn't natively group by "last 24 buckets" easily without recursive CTEs,
        // we'll fetch all logs in the last 24h and build the buckets in JS.
        const logsStmt = db.prepare(`
            SELECT tokens, created_at 
            FROM usage_logs 
            WHERE user_id = ? AND created_at >= datetime('now', '-24 hours')
        `);
        const recentLogs = logsStmt.all(userId) as any[];

        // Build 24 hour buckets counting backwards from NOW
        const now = new Date();
        const buckets = Array.from({ length: 24 }).map((_, i) => {
            const h = (now.getHours() - i + 24) % 24;
            return { label: `${h}:00`, value: 0, _hourOffset: i };
        }).reverse(); // From 23h ago to NOW

        recentLogs.forEach(log => {
            const logTime = new Date(log.created_at + 'Z');
            const diffMs = now.getTime() - logTime.getTime();
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours >= 0 && diffHours < 24) {
                // Find correct bucket (0 is the oldest, 23 is the newest)
                const bucketIdx = 23 - diffHours;
                if (buckets[bucketIdx]) {
                    buckets[bucketIdx].value += log.tokens;
                }
            }
        });

        // Strip _hourOffset
        const hourlyData = buckets.map(b => ({ label: b.label, value: b.value }));

        return NextResponse.json({ transactions, hourlyData });

    } catch (err: any) {
        console.error("Billing stats error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
