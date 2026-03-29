import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

const R_COMPILER_URL = process.env.R_COMPILER_URL || 'http://r-compiler:8000';

// POST /api/agent/r-compile — proxy R code to the internal R compiler
export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    try {
        const { code } = await req.json();
        if (!code || typeof code !== 'string') {
            return NextResponse.json({ error: "R code is required" }, { status: 400 });
        }

        const res = await fetch(`${R_COMPILER_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
            signal: AbortSignal.timeout(35000), // 35s timeout (R has 30s internal)
        });

        if (!res.ok) {
            return NextResponse.json({ error: "R compiler error" }, { status: 500 });
        }

        const result = await res.json();
        return NextResponse.json(result);

    } catch (err: any) {
        console.error("R compile proxy error:", err);
        return NextResponse.json({ error: err.message || "Compilation failed" }, { status: 500 });
    }
}
