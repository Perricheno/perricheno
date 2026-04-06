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

export async function GET() {
    const admin = await verifyAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const promos = db.prepare(`
            SELECT id, code, type, amount, uses, max_uses, 
                   COALESCE(is_active, 1) as is_active, created_at 
            FROM promo_codes 
            ORDER BY created_at DESC 
            LIMIT 100
        `).all();

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
            db.prepare('UPDATE promo_codes SET is_active = ? WHERE id = ?').run(is_active, promoId);
            return NextResponse.json({ success: true });
        }

        if (action === 'delete') {
            // Delete usages first, then the promo code
            db.prepare('DELETE FROM promo_usages WHERE promo_id = ?').run(promoId);
            db.prepare('DELETE FROM promo_codes WHERE id = ?').run(promoId);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
