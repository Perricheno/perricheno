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

export async function GET(req: Request) {
    const admin = await verifyAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const url = new URL(req.url);
        const search = url.searchParams.get('search') || '';
        
        let users = [] as any[];
        if (search) {
            users = await prisma.user.findMany({
                where: {
                    OR: [
                        { telegram_id: { contains: search, mode: 'insensitive' } },
                        { username: { contains: search, mode: 'insensitive' } },
                        { first_name: { contains: search, mode: 'insensitive' } }
                    ]
                },
                orderBy: { created_at: 'desc' },
                take: 50
            });
        } else {
            users = await prisma.user.findMany({
                orderBy: { created_at: 'desc' },
                take: 50
            });
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

        const targetUser = await getUserById(targetUserId);
        if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

        if (action === 'grant_chars' || action === 'grant_reports') {
            const isChars = action === 'grant_chars';
            const resourceName = isChars ? 'chars' : 'reports';
            
            if (isChars) {
                await prisma.user.update({ where: { id: targetUserId }, data: { purchased_chars: targetUser.purchased_chars + amount } });
            } else {
                await prisma.user.update({ where: { id: targetUserId }, data: { purchased_reports: targetUser.purchased_reports + amount } });
            }
            await prisma.transaction.create({ data: { user_id: targetUserId, topic: "Admin Bonus", amount_text: `+${amount.toLocaleString()} ${resourceName}`, is_positive: true } });

            // Trigger receipt generation
            const crypto = require('crypto');
            const uniqueId = crypto.randomBytes(6).toString('hex').toUpperCase();
            const receiptId = `PRN-BONUS-${uniqueId}-${targetUserId}`;
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
            await prisma.user.update({ where: { id: targetUserId }, data: { account_tier: tier } });
        } else if (action === 'toggle_ban') {
            const newBanStatus = targetUser.is_banned ? false : true;
            await prisma.user.update({ where: { id: targetUserId }, data: { is_banned: newBanStatus } });
            return NextResponse.json({ success: true, newBanStatus });
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
