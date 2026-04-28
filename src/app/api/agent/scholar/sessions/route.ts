import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from 'uuid';
import { prisma } from "@/lib/prisma";
import { verifySession } from '@/lib/session';
import { checkAndDeductUsage } from '@/lib/db';

export async function POST(req: NextRequest | Request) {
    try {
        const { prompt, settings } = await req.json();
        const userId = await verifySession();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Deduct 2500 chars for a Literature Search operation
        const usage = await checkAndDeductUsage(userId, 'chars', 2500);
        if (!usage.success) {
            return NextResponse.json({ error: "Insufficient characters on balance" }, { status: 402 });
        }

        const sessionId = uuidv4();

        await prisma.agentSession.create({
            data: {
                id: sessionId,
                user_id: userId,
                title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
                doc_type: 'literature_search',
                status: 'generating',
                stream_text: prompt, // Storing initial prompt here temporarily
                settings_json: JSON.stringify(settings),
                visuals_json: '[]',
            }
        });

        return NextResponse.json({ sessionId });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
