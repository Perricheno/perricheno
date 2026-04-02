import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

const PYTHON_COMPILER_URL = process.env.PYTHON_COMPILER_URL || 'http://python-compiler:8000';

// POST /api/agent/python-compile — proxy Python code to the internal Python compiler
export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    try {
        const { code } = await req.json();
        if (!code || typeof code !== 'string') {
            return NextResponse.json({ error: "Python code is required" }, { status: 400 });
        }

        const res = await fetch(`${PYTHON_COMPILER_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
            signal: AbortSignal.timeout(35000), // 35s timeout
        });

        if (!res.ok) {
            return NextResponse.json({ error: "Python compiler error" }, { status: 500 });
        }

        const result = await res.json();
        return NextResponse.json(result);

    } catch (err: any) {
        console.error("Python compile proxy error:", err);
        return NextResponse.json({ error: err.message || "Compilation failed" }, { status: 500 });
    }
}
