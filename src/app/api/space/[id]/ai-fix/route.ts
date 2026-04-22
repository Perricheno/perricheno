import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!OPENAI_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const { id } = await params;
    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { log, code, filename } = await req.json() as { log: string; code: string; filename: string };
    if (!log) return NextResponse.json({ error: 'log required' }, { status: 400 });

    const system = `You are a LaTeX expert. A user has a LaTeX compilation error. Diagnose the error from the log and the source file, then provide a concise explanation and the corrected code snippet (only the relevant lines that need changing, not the whole file). Format your response as JSON: {"explanation": "...", "fix": "corrected LaTeX snippet here"}. Output only valid JSON, no markdown fences.`;

    const user = `File: ${filename ?? 'main.tex'}\n\nCompiler log:\n${log.slice(0, 3000)}\n\nSource code:\n${(code ?? '').slice(0, 6000)}`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
        }),
    });

    if (!resp.ok) return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';

    let parsed: { explanation?: string; fix?: string };
    try { parsed = JSON.parse(raw); } catch { parsed = { explanation: raw, fix: '' }; }

    return NextResponse.json(parsed);
}
