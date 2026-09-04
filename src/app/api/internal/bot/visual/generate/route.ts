import { NextRequest, NextResponse } from "next/server";
import { createAgentSession, updateAgentSession, checkAndDeductUsage, getUserByTelegramId, getRecentSessionByTitle } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { getQueue } from "@/lib/queue";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Generation itself runs in the standalone worker process (src/worker/index.ts,
// src/lib/jobs/botVisualGenerate.ts) so it survives a web-container restart,
// not just a client disconnect. This route only validates, persists/reuses
// the AgentSession row, and enqueues the job.

// ── Main Route ──

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key not configured" }, { status: 500 });
    }

    try {
        const { 
            context, 
            language = "python", 
            telegramId, 
            title, 
            chartType = 'auto', 
            chatId, 
            messageId,
            images,
            instruction,
            attachedFiles = [] 
        } = await req.json();
        
        console.log(`[Generate] Request from ${telegramId}: images=${images?.length || 0}, textChars=${context?.text_data?.length || 0}`);

        if (!context || (!context.text_data && (!images || images.length === 0))) {
            return NextResponse.json({ error: "No context provided" }, { status: 400 });
        }

        // --- Data Integrity Guard: Prevent hallucinations when text extraction fails ---
        const textContent = context.text_data || "";
        const hasVisionData = Array.isArray(images) && images.length > 0;
        
        // Increased threshold from 100 to 400 chars to ensure minimal data for analysis
        if (textContent.length < 400 && !hasVisionData) {
            console.warn(`[Generate] Blocked potential hallucination for ${telegramId} - insufficient context (${textContent.length} chars).`);
            return NextResponse.json({ 
                error: "⚠️ В документе недостаточно данных для анализа. Пожалуйста, убедитесь, что в файле есть количественные показатели или прикрепите детальное описание." 
            }, { status: 422 });
        }

        const BOT_INTERNAL_URL = "http://telegram-bot:3001/bot-internal";

        let sessionId = uuidv4();
        // ── Create DB session & Deduct Input Usage ──
        if (telegramId) {
            const user = await getUserByTelegramId(String(telegramId));
            if (user) {
                if (user.is_banned) {
                    return NextResponse.json({ error: "Ваш аккаунт заморожен администрацией." }, { status: 403 });
                }
                // Check if a completed session with the exact same title exists to cache output
                const existingSession = await getRecentSessionByTitle(user.id, title || "Telegram Visual");
                if (existingSession && existingSession.status === "done" && (existingSession.visuals_json || existingSession.stream_text)) {
                    console.log(`[Generate] Cache hit for session: ${existingSession.id}`);
                    // Return instantly without triggering OpenAI or updating the DB
                    if (chatId && messageId) {
                        fetch(`${BOT_INTERNAL_URL}/complete-visual`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                            body: JSON.stringify({ chatId, messageId, sessionId: existingSession.id })
                        }).catch(() => {});
                    }
                    return NextResponse.json({ success: true, sessionId: existingSession.id, cached: true });
                }

                if (existingSession && existingSession.status !== "done") {
                    sessionId = existingSession.id;
                    console.log(`[Generate] Consolidating into active existing session: ${sessionId}`);
                }

                // Identify Input Data Length
                const inputChars = textContent.length;
                if (inputChars > 0 && (!existingSession || existingSession.status === "done")) { // Only deduct for new sessions
                    const deduction = await checkAndDeductUsage(user.id, 'chars', inputChars);
                    if (!deduction.success) {
                        return NextResponse.json({ 
                            error: `Insufficient balance to analyze data. Need ${inputChars} symbols, but you only have ${Math.floor(deduction.remaining)}.` 
                        }, { status: 402 });
                    }
                }

                if (!existingSession || existingSession.status === "done") {
                    try {
                        await createAgentSession({
                            id: sessionId,
                            user_id: user.id,
                            title: title || "Telegram Visual",
                            status: "generating",
                            doc_type: "visual",
                            share_id: uuidv4().split('-')[0],
                        });
                    } catch (e) {
                        console.error("Failed to create session:", e);
                    }
                } else {
                    // Update existing active session status
                    await updateAgentSession(sessionId, { status: "generating", error_msg: null });
                }
            }
        }

        // ── Enqueue generation job ──
        await getQueue().add('bot-visual-generate', {
            sessionId,
            telegramId,
            context,
            language,
            chartType,
            chatId,
            messageId,
            images,
            instruction,
            title,
            attachedFiles,
        });

        return NextResponse.json({ success: true, sessionId });
    } catch (err) {
        console.error("Compile failed:", err);
        return NextResponse.json({ error: err instanceof Error ? err.message : "Compilation failed" }, { status: 500 });
    }
}
