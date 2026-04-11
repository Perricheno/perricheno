import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { toggleAgentSessionShare } from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/agent/sessions/[id]/share — toggle share link
export async function POST(req: Request, { params }: RouteParams) {
    const { id } = await params;
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const shareId = await toggleAgentSessionShare(id, userId);

    return NextResponse.json({
        shared: shareId !== null,
        share_id: shareId,
        share_url: shareId ? `/agent/shared/${shareId}` : null,
    });
}
