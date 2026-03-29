import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key not configured" }, { status: 500 });
    }

    try {
        const { currentCode, editPrompt } = await req.json();

        if (!currentCode || !editPrompt) {
            return NextResponse.json({ error: "currentCode and editPrompt required" }, { status: 400 });
        }

        const prompt = `You are an R visualization expert editing existing R code. 
        
CURRENT R CODE:
\`\`\`R
${currentCode}
\`\`\`

USER EDIT REQUEST:
"${editPrompt}"

TASK: Return the FULL updated R code incorporating the user's request. Maintain all requirements (no Cairo() calls, publication quality, self-contained).
CRITICAL FAIL-SAFE: Do NOT use \`library(X)\` or \`require(X)\`. You MUST load all packages using \`if (!requireNamespace("pacman", quietly=TRUE)) install.packages("pacman", quiet=TRUE); pacman::p_load(pkg1, pkg2)\`.
Do NOT wrap in \`\`\`R or markdown. Return ONLY the raw executable R code.`;

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                messages: [
                    { role: "system", content: "You are an expert R programmer modifying code. Output ONLY raw executable R code. No formatting or explanations." },
                    { role: "user", content: prompt }
                ],
                stream: true,
            })
        });

        if (!aiRes.ok) {
            const err = await aiRes.text();
            return NextResponse.json({ error: `AI error: ${err}` }, { status: 500 });
        }

        const stream = new ReadableStream({
            async start(controller) {
                const reader = aiRes.body!.getReader();
                const decoder = new TextDecoder();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n').filter(l => l.trim() !== '');

                        for (const line of lines) {
                            if (line === 'data: [DONE]') continue;
                            if (line.startsWith('data: ')) {
                                try {
                                    const parsed = JSON.parse(line.slice(5));
                                    const content = parsed.choices[0]?.delta?.content;
                                    if (content) {
                                        controller.enqueue(new TextEncoder().encode(content));
                                    }
                                } catch (e) {
                                    // ignore parse err
                                }
                            }
                        }
                    }
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (err: any) {
        console.error("Visualize edit stream error:", err);
        return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
    }
}
