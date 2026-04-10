import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { telegram_id, sessionId, updateVisuals, page = 1, limit = 5 } = await req.json();

        // Single Session View
        if (sessionId && !updateVisuals) {
            const { data: session } = await supabase.from('agent_sessions')
                .select('id, title, status, doc_type, error_msg, share_id, created_at, updated_at')
                .eq('id', sessionId)
                .single();
            return NextResponse.json({ session });
        }

        // Update visuals_json for a session (called after compilation)
        if (sessionId && updateVisuals) {
            await supabase.from('agent_sessions').update({ visuals_json: updateVisuals, updated_at: new Date().toISOString() }).eq('id', sessionId);
            return NextResponse.json({ success: true });
        }

        if (!telegram_id) return NextResponse.json({ error: "Missing telegram_id" }, { status: 400 });

        const { data: user } = await supabase.from('users').select('id').eq('telegram_id', telegram_id).single();
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const offset = (page - 1) * limit;

        // Get sessions for agent reports
        const { count } = await supabase.from('agent_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        const { data: sessionsData } = await supabase.from('agent_sessions')
            .select('id, title, status, created_at, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);
        const sessions = sessionsData || [];

        return NextResponse.json({
            sessions,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
            currentPage: page
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get("sessionId");

        if (!sessionId) {
            return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
        }

        await supabase.from('agent_sessions').delete().eq('id', sessionId);
        
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
