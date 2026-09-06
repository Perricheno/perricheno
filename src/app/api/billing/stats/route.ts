import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    try {
        // Fetch last 15 transactions - exclude 0 amounts or empty text
        const transactionsRaw = await prisma.transaction.findMany({
            where: {
                user_id: userId,
                NOT: { amount_text: { in: ["0", "0.00", "-0", "-0.00", ""] } }
            },
            select: { id: true, topic: true, amount_text: true, is_positive: true, created_at: true },
            orderBy: { created_at: 'desc' },
            take: 20
        });

        const receiptsRaw = await prisma.receipt.findMany({
            where: { user_id: userId },
            select: { id: true, type: true, pack_name: true, amount_text: true, created_at: true },
            orderBy: { created_at: 'desc' }
        });

        // Format transactions
        const transactions = (transactionsRaw || []).map(tx => {
            const d = new Date(tx.created_at); 
            let cleanAmount = tx.amount_text;
            if (cleanAmount.startsWith('-0')) cleanAmount = cleanAmount.replace('-0', '0');
            
            return {
                id: `txn_${tx.id}`,
                type: tx.topic,
                amount: cleanAmount,
                // Raw ISO timestamp, not a pre-formatted display string - the
                // frontend re-parsed this field with `new Date(...)` and a
                // formatted string like "Sep 6, 03:45 PM" isn't reliably
                // reparseable across engines/locales, producing "Invalid Date"
                // in the UI. Format once, on the client, from this ISO value.
                date: d.toISOString(),
                is_positive: !!tx.is_positive
            };
        }).filter(tx => tx.amount !== '0' && tx.amount !== '0.00');

        return NextResponse.json({ transactions, receipts: receiptsRaw, hourlyData: [] });

    } catch (err: any) {
        console.error("Billing stats error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
