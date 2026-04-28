import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/uploads?ids=id1,id2,...
 * Returns upload metadata (without text_content) including expires_at for TTL display.
 */
export async function GET(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const idsParam = req.nextUrl.searchParams.get('ids');
    if (!idsParam) return NextResponse.json({ error: 'ids parameter required' }, { status: 400 });

    const ids = idsParam.split(',').filter(Boolean);
    if (ids.length === 0) return NextResponse.json({ uploads: [] });

    try {
        const data = await prisma.agentUpload.findMany({
            select: { id: true, user_id: true, filename: true, char_count: true, image_count: true, page_count: true, ocr_used: true, storage_path: true, expires_at: true, created_at: true },
            where: {
                id: { in: ids },
                user_id: userId
            },
            orderBy: { created_at: 'asc' }
        });
        return NextResponse.json({ uploads: data });
    } catch (error: any) {
        console.error('[uploads/GET] Prisma error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
