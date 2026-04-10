export const dynamic = 'force-dynamic';

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

export async function GET() {
    const admin = await verifyAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { data: promos } = await supabase.from('promo_codes')
            .select('id, code, type, amount, uses, max_uses, is_active, created_at')
            .order('created_at', { ascending: false })
            .limit(100);

        return NextResponse.json({ promos });
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
        const { promoId, action, is_active } = await req.json();

        if (!promoId) {
            return NextResponse.json({ error: "Missing promoId" }, { status: 400 });
        }

        if (action === 'toggle_active') {
            await supabase.from('promo_codes').update({ is_active }).eq('id', promoId);
            return NextResponse.json({ success: true });
        }

        if (action === 'delete') {
            // Delete usages first, then the promo code
            await supabase.from('promo_usages').delete().eq('promo_id', promoId);
            await supabase.from('promo_codes').delete().eq('id', promoId);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
