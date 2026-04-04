import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PYTHON_COMPILER_URL = process.env.PYTHON_COMPILER_URL || "http://python-compiler:8000/compile";
const R_COMPILER_URL = process.env.R_COMPILER_URL || "http://r-compiler:8000/compile";

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { code, language = "python" } = await req.json();
        
        if (!code) {
            return NextResponse.json({ error: "No code provided" }, { status: 400 });
        }

        const compilerUrl = language === "python" ? PYTHON_COMPILER_URL : R_COMPILER_URL;

        const response = await fetch(compilerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
        });

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json({ error: `Compiler Error: ${err}` }, { status: 502 });
        }

        const result = await response.json();
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
