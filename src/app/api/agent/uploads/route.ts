import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

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

    const { data, error } = await supabase
        .from('agent_uploads')
        .select('id, user_id, filename, file_type, char_count, image_count, page_count, ocr_used, storage_path, expires_at, created_at')
        .in('id', ids)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[uploads/GET] Supabase error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ uploads: data ?? [] });
}
