import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    try {
        // Fetch last 15 transactions - exclude 0 amounts or empty text
        const { data: transactionsRaw } = await supabase.from('transactions')
            .select('id, topic, amount_text, is_positive, created_at')
            .eq('user_id', userId)
            .not('amount_text', 'in', '("0","0.00","-0","-0.00","")')
            .order('created_at', { ascending: false })
            .limit(20);

        const { data: receiptsRaw } = await supabase.from('receipts')
            .select('id, type, pack_name, amount_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        // Format transactions
        const transactions = (transactionsRaw || []).map(tx => {
            const d = new Date(tx.created_at); 
            let cleanAmount = tx.amount_text;
            if (cleanAmount.startsWith('-0')) cleanAmount = cleanAmount.replace('-0', '0');
            
            return {
                id: `txn_${tx.id}`,
                type: tx.topic,
                amount: cleanAmount,
                date: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                is_positive: !!tx.is_positive
            };
        }).filter(tx => tx.amount !== '0' && tx.amount !== '0.00');

        return NextResponse.json({ transactions, receipts: receiptsRaw, hourlyData: [] });

    } catch (err: any) {
        console.error("Billing stats error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
