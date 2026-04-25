import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getUserRoleInSpace } from '@/lib/space-db';

export const dynamic = 'force-dynamic';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS: Record<string, string> = {
    fix:       'Fix LaTeX errors and syntax issues in the selected text. Return only the corrected LaTeX, no explanation.',
    rewrite:   'Rewrite the selected LaTeX text to be clearer and better structured. Return only the rewritten LaTeX.',
    translate: 'Translate the human-readable text in the selected LaTeX into English while preserving all LaTeX commands and structure. Return only the result.',
    explain:   'Explain what the selected LaTeX code does. Return a short, clear explanation in plain text (not LaTeX).',
    shorten:   'Make the selected text shorter and more concise while preserving meaning. Return only the result.',
    expand:    'Expand and elaborate the selected text with more detail. Return only the result.',
};

export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!OPENAI_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const { id } = await params;
    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { action, text, customPrompt } = await req.json() as { action?: string; text: string; customPrompt?: string };
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

    const instruction = customPrompt?.trim() || (action ? ACTIONS[action] : null);
    if (!instruction) return NextResponse.json({ error: 'action or customPrompt required' }, { status: 400 });

    const system = `You are a LaTeX expert assistant. Follow the instruction precisely. Output ONLY the result - no preamble, no explanation unless asked.`;
    const user = `Instruction: ${instruction}\n\nSelected text:\n${text.slice(0, 4000)}`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
            model: 'gpt-5-mini-2025-08-07',
            messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
    });

    if (!resp.ok) return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
    const data = await resp.json();
    const result = data.choices?.[0]?.message?.content ?? '';

    return NextResponse.json({ result });
}
