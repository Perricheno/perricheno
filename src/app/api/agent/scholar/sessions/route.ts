import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/lib/supabase";
import { verifySession } from '@/lib/session';

export async function POST(req: NextRequest | Request) {
    try {
        const { prompt, settings } = await req.json();
        const userId = await verifySession();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: dbUser } = await supabase.from('users').select('id, tokens').eq('id', userId).single();
        if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

        if (dbUser.tokens < 100) {
            return NextResponse.json({ error: "Insufficient tokens" }, { status: 402 });
        }

        const sessionId = uuidv4();
        
        // Deduct initial base token amount for the scholar search
        await supabase.from('users').update({ tokens: dbUser.tokens - 100 }).eq('id', userId);

        await supabase.from('agent_sessions').insert({
            id: sessionId,
            user_id: userId,
            title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
            doc_type: 'literature_search',
            status: 'generating',
            stream_text: prompt, // Storing initial prompt here temporarily
            settings_json: settings,
            visuals_json: [],
        });

        return NextResponse.json({ sessionId });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
