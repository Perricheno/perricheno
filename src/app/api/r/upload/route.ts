// R Studio — server-side file extraction proxy.
// Supports PDF, Office formats (docx/xlsx/pptx), CSV, TXT via internal extract-text endpoint.
// Returns { name, content, images } where content is extracted text and images are base64 page renders.

import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/session";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const INTERNAL_EXTRACT_URL = process.env.INTERNAL_EXTRACT_URL || "http://localhost:3000/api/internal/bot/extract-text";

export async function POST(req: NextRequest) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    if (!WEBHOOK_SECRET) return NextResponse.json({ error: "Extract service not configured." }, { status: 500 });

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

        const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "File too large (max 20 MB)." }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();

        const extractForm = new FormData();
        extractForm.append("file", new Blob([buffer]), file.name);

        const extractRes = await fetch(INTERNAL_EXTRACT_URL, {
            method: "POST",
            headers: {
                "x-bot-secret": WEBHOOK_SECRET,
                "x-file-name": file.name,
            },
            body: buffer,
            signal: AbortSignal.timeout(60_000),
        });

        if (!extractRes.ok) {
            const errText = await extractRes.text().catch(() => "");
            return NextResponse.json({ error: "Extraction failed: " + errText.slice(0, 200) }, { status: 500 });
        }

        const result = await extractRes.json();

        return NextResponse.json({
            name: file.name,
            content: result.text ?? "",
            images: result.images ?? [],
            chars: result.chars ?? 0,
            pages: result.pages ?? 0,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Upload failed." }, { status: 500 });
    }
}
