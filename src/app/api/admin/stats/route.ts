import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getUserById } from '@/lib/db';
import { supabase } from '@/lib/supabase';

async function verifyAdmin() {
    const userId = await verifySession();
    if (!userId) return null;
    const user = await getUserById(userId);
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
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
        
        let totalChars = 0;
        const { data: usage } = await supabase.from('usage_logs').select('tokens');
        if (usage) totalChars = usage.reduce((sum, r) => sum + (r.tokens || 0), 0);

        const { count: totalPurchases } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('is_positive', true).eq('topic', 'Purchased resource pack');

        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: recentLogsData } = await supabase.from('usage_logs').select('tokens, created_at').gte('created_at', sevenDaysAgo);
        const recentLogsResult = recentLogsData || [];

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
                totalUsers: totalUsers || 0,
                totalUsage: totalChars,
                totalTransactions: totalPurchases || 0
            },
            weekData
        });

    } catch (err: any) {
        console.error("Admin stats error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
