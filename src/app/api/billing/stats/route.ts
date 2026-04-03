import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import db from '@/lib/db';

export async function GET(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    try {
        // Fetch last 15 transactions - exclude 0 amounts or empty text
        const txStmt = db.prepare(`
            SELECT id, topic as type, amount_text as amount, is_positive, created_at as _date 
            FROM transactions 
            WHERE user_id = ? AND amount_text NOT IN ('0', '0.00', '-0', '-0.00', '')
            ORDER BY created_at DESC 
            LIMIT 20
        `);
        const transactionsRaw = txStmt.all(userId) as any[];

        // Format transactions
        const transactions = transactionsRaw.map(tx => {
            const d = new Date(tx._date + 'Z'); 
            // Final cleanup of the amount string to prevent "-0" or "-1" weirdness from DB
            let cleanAmount = tx.amount;
            if (cleanAmount.startsWith('-0')) cleanAmount = cleanAmount.replace('-0', '0');
            
            return {
                id: `txn_${tx.id}`,
                type: tx.type,
                amount: cleanAmount,
                date: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                is_positive: tx.is_positive === 1
            };
        }).filter(tx => tx.amount !== '0' && tx.amount !== '0.00');

        return NextResponse.json({ transactions, hourlyData: [] });

    } catch (err: any) {
        console.error("Billing stats error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
