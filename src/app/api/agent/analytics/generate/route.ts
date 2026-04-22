// POST /api/agent/analytics/generate
// New Analytics Pipeline endpoint with proper data verification

import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { checkAndDeductUsage, getAgentUploadsByIds, createAgentSession, updateAgentSession } from '@/lib/db';
import { runAnalyticsPipeline } from '@/lib/analytics/pipeline';
import { saveFilesToDisk, deleteFiles } from '@/lib/analytics/fileManager';
import type { AnalyticsSettings } from '@/lib/analytics/pipeline/types';
import type { StageProgress } from '@/lib/agent/stages';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Background runner (fire-and-forget)
async function runBackground(
    sessionId: string,
    settings: AnalyticsSettings,
    userId: number
) {
    try {
        console.log(`[Analytics-BG] Starting pipeline for session ${sessionId}`);
        
        // Get uploads
        const uploads = await getAgentUploadsByIds(settings.uploadIds, userId);
        
        if (uploads.length === 0) {
            throw new Error("No uploads found");
        }
        
        // Save files to shared volume for R/Python compilers
        console.log(`[Analytics-BG] Saving ${uploads.length} files to disk...`);
        const fileMap = await saveFilesToDisk(uploads);
        const savedFiles = Array.from(fileMap.values());
        
        // CRITICAL: Clear text_content to avoid sending huge data to OpenAI
        // Files are now on disk, accessible by compilers
        uploads.forEach(u => {
            u.text_content = null;
        });
        
        // Progress writer
        const writeProgress = async (p: StageProgress) => {
            await updateAgentSession(sessionId, {
                stage_json: JSON.stringify(p),
                updated_at: new Date().toISOString(),
            });
        };
        
        let result;
        try {
            // Run pipeline with fileMap
            result = await runAnalyticsPipeline({
                settings,
                uploads,
                writeProgress,
                fileMap, // Pass fileMap to pipeline
            });
            
            // Clean up files after pipeline completes
            await deleteFiles(savedFiles);
            console.log(`[Analytics-BG] Cleaned up ${savedFiles.length} temporary files`);
        } catch (error) {
            // Clean up files even if pipeline fails
            await deleteFiles(savedFiles);
            throw error;
        }
        
        // Deduct usage
        await checkAndDeductUsage(userId, 'chars', result.totalTokens * 3);  // tokens → chars
        await checkAndDeductUsage(userId, 'visuals', result.charts.length);
        
        // Save results
        await updateAgentSession(sessionId, {
            status: result.status === 'done' ? 'done' : 'needs_attention',
            visuals_json: JSON.stringify(result.charts),
            settings_json: JSON.stringify({
                ...settings,
                verifications: result.verifications,
                chartPlans: result.chartPlans,
            }),
            updated_at: new Date().toISOString(),
        });
        
        console.log(`[Analytics-BG] Pipeline complete for ${sessionId}: ${result.charts.length} charts`);
        
    } catch (err: any) {
        console.error(`[Analytics-BG] Pipeline failed for ${sessionId}:`, err);
        
        await updateAgentSession(sessionId, {
            status: 'error',
            error_msg: err?.message || 'Pipeline failed',
            updated_at: new Date().toISOString(),
        });
    }
}

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
                updated_at: new Date().toISOString(),
            }),
        });
        
        if (!session || !session.id) {
            throw new Error("Failed to create session");
        }
        
        // Start background pipeline (fire-and-forget)
        const settings: AnalyticsSettings = {
            prompt,
            runtime: runtime as 'R' | 'Python',
            chartTypes: [],  // Will be determined by Stage 2
            uploadIds,
        };
        
        runBackground(session.id, settings, userId).catch(err => {
            console.error(`[Analytics] Background runner crashed:`, err);
        });
        
        // Return session ID immediately
        return NextResponse.json({ sessionId: session.id });
        
    } catch (err: any) {
        console.error(`[Analytics] Generate failed:`, err);
        return NextResponse.json({ 
            error: err?.message || "Failed to start analytics pipeline" 
        }, { status: 500 });
    }
}
