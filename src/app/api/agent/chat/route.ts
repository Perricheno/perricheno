import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { checkAndDeductUsage, getAgentSession, updateAgentSession } from '@/lib/db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { sessionId, message, files, model } = await req.json();

    if (!sessionId || !message) {
        return NextResponse.json({ error: "sessionId and message required" }, { status: 400 });
    }

    // Pre-check usage
    const precheck = await checkAndDeductUsage(userId, 'chars', 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ error: "LIMIT_REACHED" }, { status: 402 });
    }

    // Load existing session
    const session = await getAgentSession(sessionId);
    if (!session || Number(session.user_id) !== Number(userId)) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Parse existing messages
    let chatHistory: { role: string; content: string }[] = [];
    try {
        const stored = session.stream_text ? JSON.parse(session.stream_text) : [];
        chatHistory = stored;
    } catch { chatHistory = []; }

    // Build file context for the user message
    let userContent = message;
    if (files && files.length > 0) {
        const fileContext = files.map((f: { name: string; content: string }) => 
            `\n\n--- FILE: ${f.name} ---\n${f.content.slice(0, 50000)}\n--- END FILE ---`
        ).join('');
        userContent = message + fileContext;
    }

    // Add user message to history
    chatHistory.push({ role: 'user', content: userContent });

    // Build system prompt
    const systemPrompt = `You are Perricheno AI — a premium research and analysis assistant. You provide thorough, well-structured, and accurate answers. Use markdown formatting with headers, bold text, lists, and code blocks when appropriate. Be concise but comprehensive. Answer in the same language the user writes to you.`;

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.slice(-20) // Keep last 20 messages for context window
    ];

    // Choose model
    const selectedModel = model === 'grok' ? 'grok-4-1-mini-fast' : 'gpt-5-mini-2025-08-07';
    const apiBase = model === 'grok' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1';
    const apiKey = model === 'grok' ? process.env.XAI_API_KEY : OPENAI_API_KEY;

    // Stream the response
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const aiRes = await fetch(`${apiBase}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: selectedModel,
                        stream: true,
                        messages: apiMessages,
                    }),
                    signal: AbortSignal.timeout(120000),
                });

                if (!aiRes.ok) {
                    const errText = await aiRes.text();
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errText })}\n\n`));
                    controller.close();
                    return;
                }

                const reader = aiRes.body?.getReader();
                if (!reader) { controller.close(); return; }

                const decoder = new TextDecoder();
                let fullResponse = '';
                let buffer = '';

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
                        } catch {}
                    }
                }

                // Deduct usage
                const charCount = fullResponse.length + userContent.length;
                await checkAndDeductUsage(userId, 'chars', charCount);

                // Save assistant message to history
                chatHistory.push({ role: 'assistant', content: fullResponse });

                // Auto-generate title from first message
                let title = session.title;
                if (title === 'New Chat' && chatHistory.length <= 2) {
                    title = message.slice(0, 80) || 'Chat';
                }

                // Save to DB
                await updateAgentSession(sessionId, {
                    stream_text: JSON.stringify(chatHistory),
                    title,
                    status: 'done'
                });

                // Send done event with metadata
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    done: true, 
                    tokens: charCount,
                    messageCount: chatHistory.length 
                })}\n\n`));

                controller.close();
            } catch (err: any) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        }
    });
}
