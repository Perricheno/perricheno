import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
    const authHeader = req.headers.get("X-Bot-Secret");

    if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { telegram_id, action, sessionId } = await req.json();
        const user = await getUserByTelegramId(String(telegram_id));
        
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 1. Handle Task Reset/Cleanup
        if (action === "reset" && sessionId) {
            await supabase.from('agent_sessions').update({ status: 'failed', error_msg: 'Manual reset via bot' }).eq('id', sessionId).eq('user_id', user.id);
            return NextResponse.json({ success: true, message: "Task reset complete." });
        }

        // 2. Query Active Tasks
        const { data: tasksData } = await supabase.from('agent_sessions')
            .select('id, title, status, created_at')
            .eq('user_id', user.id)
            .in('status', ['generating', 'processing', 'extracting'])
            .order('created_at', { ascending: false });
        const tasks = tasksData || [];

        return NextResponse.json({ 
            success: true, 
            tasks: tasks.map(t => ({
                ...t,
                timeAgo: Math.floor((Date.now() - new Date(t.created_at).getTime()) / 1000 / 60) // minutes ago
            })) 
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
