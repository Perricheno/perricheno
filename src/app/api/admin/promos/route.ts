export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getUserById } from '@/lib/db';
import { prisma } from '@/lib/prisma';

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
        const promos = await prisma.promoCode.findMany({
            select: { id: true, code: true, type: true, amount: true, uses: true, max_uses: true, is_active: true, created_at: true },
            orderBy: { created_at: 'desc' },
            take: 100
        });

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
            await prisma.promoCode.update({ where: { id: promoId }, data: { is_active } });
            return NextResponse.json({ success: true });
        }

        if (action === 'delete') {
            // Delete usages first, then the promo code
            await prisma.promoUsage.deleteMany({ where: { promo_id: promoId } });
            await prisma.promoCode.delete({ where: { id: promoId } });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
