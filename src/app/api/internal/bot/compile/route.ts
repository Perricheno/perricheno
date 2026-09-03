import { NextRequest, NextResponse } from "next/server";
import { checkAndDeductUsage, getUserByTelegramId } from "@/lib/db";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const R_COMPILER_URL = process.env.R_COMPILER_URL || 'http://r-compiler:8000';
const PYTHON_COMPILER_URL = process.env.PYTHON_COMPILER_URL || 'http://python-compiler:8000';

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { code, type = 'python', telegramId, files = [] } = await req.json() as { code: string, type?: string, telegramId: string | number, files?: any[] };
        
        if (!code || !telegramId) {
            return NextResponse.json({ error: "Code and Telegram ID are required" }, { status: 400 });
        }

        const isPython = type === 'python';
        const compilerUrl = isPython ? PYTHON_COMPILER_URL : R_COMPILER_URL;

        // ── 1. Identify User & Deduct Usage ──
        const user = await getUserByTelegramId(String(telegramId));
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const charCount = code.length;
        const deduction = await checkAndDeductUsage(user.id, 'chars', charCount);
        
        if (!deduction.success) {
            return NextResponse.json({ 
                error: `Insufficient balance. Need ${charCount} symbols, but you have ${Math.floor(deduction.remaining)}.` 
            }, { status: 402 });
        }

        // ── 2. Proxy to Internal Compiler ──
        const compileRes = await fetch(`${compilerUrl}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, files }),
            signal: AbortSignal.timeout(40000),
        });

        if (!compileRes.ok) {
            const errText = await compileRes.text();
            throw new Error(`Compiler error: ${errText.slice(0, 100)}`);
        }

        const result = await compileRes.json();
        return NextResponse.json(result);

    } catch (err) {
        console.error("[Bot Internal Compile] Error:", err);
        return NextResponse.json({ error: err instanceof Error ? err.message : "Internal compilation failed" }, { status: 500 });
    }
}
