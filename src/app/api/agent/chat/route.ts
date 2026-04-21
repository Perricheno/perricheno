import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { checkAndDeductUsage, getAgentSession, updateAgentSession, getAgentUploadsByIds } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IMAGE_TOKEN_COST = 800;

// Compact shape stored in agent_sessions.stream_text for chat sessions.
// Base64 payloads live in agent_uploads (referenced by uploadIds), not here —
// history stays small no matter how many PDFs or screenshots the user attaches.
interface ChatMessageRow {
    role: 'user' | 'assistant';
    content: string;
    files_meta?: { upload_id: string; filename: string; kind: 'pdf' | 'image'; charCount: number; imageCount: number }[];
    created_at: string;
    tokens?: number;
    aborted?: boolean;
}

// Per-file text budget fed to the LLM for the *current* turn. Total caps are
// enforced at ingest time (200k across all uploads).
const PER_FILE_TEXT_CAP = 30_000;
// Keep first 2 messages + last N for the context window.
const PINNED_PREFIX = 2;
const TAIL_LENGTH = 18;

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    if (!OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const { sessionId, mode = 'send', editIndex } = body as {
        sessionId?: string;
        mode?: 'send' | 'retry' | 'edit';
        editIndex?: number;
    };
    let { message, uploadIds } = body as { message?: string; uploadIds?: string[] };

    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    if (mode === 'send' || mode === 'edit') {
        if (typeof message !== 'string') return NextResponse.json({ error: 'message required' }, { status: 400 });
        if (message.length > 100_000) return NextResponse.json({ error: 'Message is too large (>100k characters).' }, { status: 413 });
    }
    if (mode === 'edit' && (typeof editIndex !== 'number' || editIndex < 0)) {
        return NextResponse.json({ error: 'editIndex required for edit mode' }, { status: 400 });
    }

    const precheck = await checkAndDeductUsage(userId, 'chars', 0);
    if (precheck.remaining <= 0) return NextResponse.json({ error: 'LIMIT_REACHED' }, { status: 402 });

    const session = await getAgentSession(sessionId);
    if (!session || Number(session.user_id) !== Number(userId)) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // ── Parse history (compact format only; legacy base64 content may exist on old sessions) ──
    let history: ChatMessageRow[] = [];
    try {
        const raw = session.stream_text ? JSON.parse(session.stream_text) : [];
        if (Array.isArray(raw)) history = raw as ChatMessageRow[];
    } catch { history = []; }

    // ── Mode-specific history munging ──
    let skipAppendUser = false;

    if (mode === 'retry') {
        // Find the last user row, drop everything after it, regenerate.
        let lastUserIdx = -1;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === 'user') { lastUserIdx = i; break; }
        }
        if (lastUserIdx === -1) return NextResponse.json({ error: 'No user message to retry' }, { status: 400 });
        history = history.slice(0, lastUserIdx + 1);
        const lastUser = history[lastUserIdx];
        message = lastUser.content;
        uploadIds = lastUser.files_meta?.map(f => f.upload_id) ?? [];
        skipAppendUser = true;
    } else if (mode === 'edit') {
        // Truncate history to *before* the edited turn; the new message replaces it.
        if (editIndex! >= history.length) return NextResponse.json({ error: 'editIndex out of range' }, { status: 400 });
        if (history[editIndex!]?.role !== 'user') return NextResponse.json({ error: 'editIndex must point to a user message' }, { status: 400 });
        history = history.slice(0, editIndex!);
    }

    // ── Load attached uploads ──
    // For retry this pulls whatever the prior turn referenced; expired uploads
    // are silently skipped (getAgentUploadsByIds filters by expires_at).
    const uploads = uploadIds && uploadIds.length > 0
        ? await getAgentUploadsByIds(uploadIds, userId)
        : [];

    // Normalize images_json (Supabase jsonb may be a string).
    for (const u of uploads) {
        if (typeof u.images_json === 'string') {
            try { u.images_json = JSON.parse(u.images_json); } catch { u.images_json = []; }
        }
    }

    // ── Build current user message content (multimodal) ──
    let currentContent: any = message;
    let imageTokensBudget = 0;
    const filesMeta: ChatMessageRow['files_meta'] = [];

    if (uploads.length > 0) {
        const textChunks: string[] = [];
        const imageParts: any[] = [];
        for (const u of uploads) {
            const textPart = (u.text_content || '').slice(0, PER_FILE_TEXT_CAP);
            if (textPart) {
                textChunks.push(`--- FILE: ${u.filename}${u.ocr_used ? ' (OCR)' : ''} ---\n${textPart}\n--- END FILE ---`);
            }
            const imgs = Array.isArray(u.images_json) ? u.images_json : [];
            for (const img of imgs as { dataUrl: string }[]) {
                if (!img?.dataUrl) continue;
                imageParts.push({ type: 'image_url', image_url: { url: img.dataUrl } });
                imageTokensBudget += IMAGE_TOKEN_COST;
            }
            filesMeta.push({
                upload_id: u.id,
                filename: u.filename,
                kind: u.text_content ? 'pdf' : 'image',
                charCount: u.char_count,
                imageCount: u.image_count,
            });
        }

        const textBlock = textChunks.length > 0
            ? `${message}\n\n${textChunks.join('\n\n')}`
            : message;

        currentContent = imageParts.length > 0
            ? [{ type: 'text', text: textBlock }, ...imageParts]
            : textBlock;
    }

    // ── Build LLM message window: pinned first 2 + tail, text-only for history ──
    const windowed = pickWindow(history, PINNED_PREFIX, TAIL_LENGTH);

    const apiMessages: any[] = [
        { role: 'system', content: `You are Perricheno AI — a premium research and analysis assistant. You provide thorough, well-structured, and accurate answers. Use markdown formatting (headers, bold, lists, code blocks) when appropriate. Be concise but comprehensive. Answer in the same language the user writes to you.` },
        ...windowed.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: currentContent },
    ];

    // ── Persist the user turn up front (unless retry — user row is already
    // at the tail from the earlier attempt). If the client aborts mid-stream we
    // still want the latest state on record so nothing is lost. ──
    if (!skipAppendUser) {
        const userRow: ChatMessageRow = {
            role: 'user',
            content: message!,
            files_meta: filesMeta.length > 0 ? filesMeta : undefined,
            created_at: new Date().toISOString(),
        };
        history.push(userRow);
    }
    await updateAgentSession(sessionId, { stream_text: JSON.stringify(history), status: 'generating' });

    // ── Stream ──
    const encoder = new TextEncoder();
    const upstreamAbort = new AbortController();

    // Forward client aborts to the OpenAI request so we don't keep burning tokens.
    const clientSignal = req.signal;
    const onClientAbort = () => upstreamAbort.abort();
    if (clientSignal) clientSignal.addEventListener('abort', onClientAbort);

    const stream = new ReadableStream({
        async start(controller) {
            let fullResponse = '';
            let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
            let aborted = false;

            try {
                const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                    body: JSON.stringify({
                        model: 'gpt-5-mini-2025-08-07',
                        stream: true,
                        stream_options: { include_usage: true },
                        messages: apiMessages,
                    }),
                    signal: upstreamAbort.signal,
                });

                if (!aiRes.ok) {
                    const errText = await aiRes.text();
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errText.slice(0, 500) })}\n\n`));
                    controller.close();
                    return;
                }

                const reader = aiRes.body?.getReader();
                if (!reader) { controller.close(); return; }

                const decoder = new TextDecoder();
                let buffer = '';
                let lastKeepalive = Date.now();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(dataStr);
                            const delta = parsed.choices?.[0]?.delta?.content;
                            if (delta) {
                                fullResponse += delta;
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                            }
                            if (parsed.usage) usage = parsed.usage;
                        } catch {}
                    }

                    // SSE keepalive every 15s to stop proxies / CF from closing the pipe.
                    if (Date.now() - lastKeepalive > 15_000) {
                        controller.enqueue(encoder.encode(`:ka\n\n`));
                        lastKeepalive = Date.now();
                    }
                }
            } catch (err: any) {
                aborted = err?.name === 'AbortError' || upstreamAbort.signal.aborted;
                if (!aborted) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err?.message || err).slice(0, 300) })}\n\n`));
                }
            } finally {
                // ── Persist assistant turn (partial if aborted) and deduct usage ──
                try {
                    const assistantRow: ChatMessageRow = {
                        role: 'assistant',
                        content: fullResponse,
                        created_at: new Date().toISOString(),
                        tokens: usage?.completion_tokens,
                        aborted: aborted || undefined,
                    };
                    history.push(assistantRow);
                    const msg = message ?? '';
                    const newTitle = await maybeAutoTitle(session.title, msg, history);
                    await updateAgentSession(sessionId, {
                        stream_text: JSON.stringify(history),
                        status: 'done',
                        title: newTitle,
                    });

                    // Billing: real tokens × 3 chars/token equivalence + flat image cost.
                    const inputTokens = usage?.prompt_tokens ?? Math.ceil(msg.length / 3);
                    const outputTokens = usage?.completion_tokens ?? Math.ceil(fullResponse.length / 3);
                    const totalChars = (inputTokens + outputTokens) * 3 + imageTokensBudget * 3;
                    if (totalChars > 0) await checkAndDeductUsage(userId, 'chars', totalChars);

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        done: true,
                        aborted,
                        charsBilled: totalChars,
                        promptTokens: inputTokens,
                        completionTokens: outputTokens,
                    })}\n\n`));

                    // Fire-and-forget smart-title refresh once the chat has real
                    // substance. Doesn't block the stream close.
                    generateSmartTitleIfNeeded(sessionId, history, newTitle).catch(() => {});
                } catch (persistErr) {
                    console.error('[chat] persist failed:', persistErr);
                }
                if (clientSignal) clientSignal.removeEventListener('abort', onClientAbort);
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}

function pickWindow(history: ChatMessageRow[], prefix: number, tail: number): ChatMessageRow[] {
    if (history.length <= prefix + tail) return history;
    return [...history.slice(0, prefix), ...history.slice(-tail)];
}

async function maybeAutoTitle(current: string, firstMsg: string, history: ChatMessageRow[]): Promise<string> {
    if (current && current !== 'New Chat') return current;
    const seed = firstMsg.trim().slice(0, 80).replace(/\s+/g, ' ');
    return seed || 'Chat';
}

// Fire-and-forget AI title. Called once history hits ~3 exchanges and the
// title is still the naive first-message seed. Short call, cheap model tier.
async function generateSmartTitleIfNeeded(sessionId: string, history: ChatMessageRow[], currentTitle: string): Promise<void> {
    if (history.length < 6) return;                           // at least 3 exchanges
    if (!currentTitle) return;
    // Only replace if the current title is the naive seed (= first user msg prefix).
    const firstUser = history.find(m => m.role === 'user');
    if (!firstUser) return;
    const naiveSeed = firstUser.content.trim().slice(0, 80).replace(/\s+/g, ' ');
    if (currentTitle !== naiveSeed && currentTitle !== 'New Chat') return;

    try {
        // Condense the conversation to the first 4 turns; plenty for titling.
        const snippet = history.slice(0, 4).map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 400)}`).join('\n');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify({
                model: 'gpt-5-mini-2025-08-07',
                messages: [
                    { role: 'system', content: 'Produce a 3-6 word title summarizing this chat. No punctuation, no quotes, no prefix. Match the conversation language.' },
                    { role: 'user', content: snippet },
                ],
            }),
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return;
        const j = await res.json();
        const title = String(j?.choices?.[0]?.message?.content || '').trim().replace(/^["'«»]|["'«»]$/g, '').slice(0, 80);
        if (title && title.length > 2) {
            await updateAgentSession(sessionId, { title });
        }
    } catch (e) {
        console.warn('[chat] title generation failed:', (e as any)?.message);
    }
}
