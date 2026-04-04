import { NextRequest, NextResponse } from "next/server";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PDF_API_BASE = "https://pdf.perricheno.ru/api/v1";
const PDF_API_KEY = "0a69f4b4-0210-47c0-a2a9-946e3e894c4c";

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const fileName = req.headers.get("x-file-name") || "unknown";
        const buffer = Buffer.from(await req.arrayBuffer());
        const ext = fileName.split('.').pop()?.toLowerCase();

        let text = "";

        if (ext === 'pdf') {
            // Use existing Stirling PDF API (pdf.perricheno.ru) for extraction
            const formData = new FormData();
            formData.append("fileInput", new Blob([buffer], { type: "application/pdf" }), fileName);

            const pdfRes = await fetch(`${PDF_API_BASE}/convert/pdf/text`, {
                method: "POST",
                headers: { "X-API-KEY": PDF_API_KEY },
                body: formData,
                signal: AbortSignal.timeout(30000),
            });

            if (pdfRes.ok) {
                const resultBuffer = await pdfRes.arrayBuffer();
                text = Buffer.from(resultBuffer).toString('utf-8');
            } else {
                const errText = await pdfRes.text().catch(() => '');
                console.error(`[ExtractText] PDF API error ${pdfRes.status}: ${errText.slice(0, 200)}`);
                text = "[PDF text extraction failed via Stirling API]";
            }
        } else if (['txt', 'csv', 'tsv', 'json', 'md', 'tex', 'log', 'xml', 'r', 'py', 'js', 'ts', 'html'].includes(ext || '')) {
            text = buffer.toString('utf-8');
        } else {
            return NextResponse.json({ text: "", error: "Unsupported file type" }, { status: 200 });
        }

        // Clean up text
        text = text.replace(/\x00/g, '').replace(/\r\n/g, '\n').trim();

        return NextResponse.json({ 
            text,
            fileName,
            chars: text.length 
        });
    } catch (err: any) {
        console.error("Extract text error:", err);
        return NextResponse.json({ error: err.message, text: "" }, { status: 500 });
    }
}
