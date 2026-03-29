import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const COMPILER_URL = process.env.LATEX_COMPILER_URL;
    const COMPILER_KEY = process.env.LATEX_COMPILER_KEY;

    if (!COMPILER_URL || !COMPILER_KEY) {
        return NextResponse.json({ error: "Compiler Config (URL/KEY) missing. Set LATEX_COMPILER_URL and LATEX_COMPILER_KEY secrets." }, { status: 500 });
    }

    try {
        const formData = await req.formData();
        const zipFile = formData.get("file");

        if (!zipFile) {
            return NextResponse.json({ error: "No ZIP file provided." }, { status: 400 });
        }

        // Optional: If Vercel or NextJS mutates formData boundary, it's safer to reconstruct it:
        // Actually, just passing `formData` to `fetch()` cleanly reconstructs it in modern Node.
        
        const compilerRes = await fetch(COMPILER_URL, {
            method: 'POST',
            headers: {
                'x-api-key': COMPILER_KEY,
            },
            body: formData,
            signal: AbortSignal.timeout(90000), // LaTeX can be slow
        });

        if (!compilerRes.ok) {
            const errText = await compilerRes.text();
            console.error("Compiler microservice returned:", compilerRes.status, errText);
            return NextResponse.json({ error: `Compiler Error (${compilerRes.status}): ` + errText }, { status: compilerRes.status });
        }

        // Return the PDF buffer directly
        return new Response(compilerRes.body, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="compiled_document.pdf"`
            }
        });

    } catch (err: any) {
        console.error("Compile proxy error:", err);
        return NextResponse.json({ error: err.message || "Failed proxy to compilation server" }, { status: 500 });
    }
}
