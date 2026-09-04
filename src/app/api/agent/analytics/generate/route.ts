// POST /api/agent/analytics/generate
// New Analytics Pipeline endpoint with proper data verification

import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { checkAndDeductUsage, getAgentUploadsByIds, createAgentSession } from '@/lib/db';
import { getQueue } from '@/lib/queue';
import type { AnalyticsSettings } from '@/lib/analytics/pipeline/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Generation itself runs in the standalone worker process (src/worker/index.ts,
// src/lib/jobs/analyticsGenerate.ts) so it survives a web-container restart,
// not just a client disconnect. This route only validates, persists the
// initial AgentSession row, and enqueues the job.

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) {
        return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }
    
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key not configured" }, { status: 500 });
    }
    
    // Check quota
    const precheck = await checkAndDeductUsage(userId, 'visuals', 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ 
            error: "LIMIT_REACHED", 
            details: "Visual tokens limit reached." 
        }, { status: 402 });
    }
    
    try {
        const body = await req.json();
        const { prompt, runtime = 'Python', uploadIds = [] } = body;
        
        if (!prompt || !prompt.trim()) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }
        
        if (!uploadIds || uploadIds.length === 0) {
            return NextResponse.json({ 
                error: "No data files uploaded. Please upload CSV, Excel, or other data files." 
            }, { status: 400 });
        }
        
        // Validate uploads exist
        const uploads = await getAgentUploadsByIds(uploadIds, userId);
        if (uploads.length === 0) {
            return NextResponse.json({ error: "Uploads not found" }, { status: 404 });
        }
        
        // Create session immediately
        const sessionId = crypto.randomUUID();
        const session = await createAgentSession({
            id: sessionId,
            user_id: userId,
            title: prompt.slice(0, 100),
            doc_type: 'data_analytics',
            status: 'generating',
            settings_json: JSON.stringify({ prompt, runtime, uploadIds }),
            stage_json: JSON.stringify({
                current_stage: 0,
                total_stages: 3,
                label: "Initializing...",
                completed_stages: [],
                started_at: new Date().toISOString(),
            }),
        });
        
        if (!session || !session.id) {
            throw new Error("Failed to create session");
        }
        
        // Enqueue background pipeline job
        const settings: AnalyticsSettings = {
            prompt,
            runtime: runtime as 'R' | 'Python',
            chartTypes: [],  // Will be determined by Stage 2
            uploadIds,
        };
        
        await getQueue().add('analytics-generate', { sessionId: session.id, settings, userId });
        
        // Return session ID immediately
        return NextResponse.json({ sessionId: session.id });
        
    } catch (err: any) {
        console.error(`[Analytics] Generate failed:`, err);
        return NextResponse.json({ 
            error: err?.message || "Failed to start analytics pipeline" 
        }, { status: 500 });
    }
}
