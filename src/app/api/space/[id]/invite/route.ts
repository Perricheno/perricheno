import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { createSpaceInvite, getUserRoleInSpace } from '@/lib/space-db';
import type { CollaboratorRole } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (role !== 'owner') return NextResponse.json({ error: 'Only owner can invite' }, { status: 403 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });

    const inviteRole: CollaboratorRole = ['editor', 'viewer'].includes(body.role) ? body.role : 'editor';
    const invite = await createSpaceInvite(id, email, inviteRole);

    // In production: send email with invite link
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://perricheno.ru'}/space/invite/${invite.token}`;
    return NextResponse.json({ ok: true, inviteUrl, token: invite.token }, { status: 201 });
}
