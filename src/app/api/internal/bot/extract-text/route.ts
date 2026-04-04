import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

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
        let images: string[] = [];

        if (ext === 'pdf') {
            // 1. Try Text Extraction first (as metadata/fallback)
            try {
                const formData = new FormData();
                formData.append("fileInput", new Blob([buffer], { type: "application/pdf" }), fileName);
                const pdfRes = await fetch(`${PDF_API_BASE}/convert/pdf/text`, {
                    method: "POST",
                    headers: { "X-API-KEY": PDF_API_KEY },
                    body: formData,
                    signal: AbortSignal.timeout(15000),
                });
                if (pdfRes.ok) {
                    text = Buffer.from(await pdfRes.arrayBuffer()).toString('utf-8');
                }
            } catch (e) {
                console.warn("[ExtractText] Failed to get text metadata, falling back to images only.");
            }

            // 2. PRIMARY: Convert PDF to Images for Vision analysis
            try {
                const imgFormData = new FormData();
                imgFormData.append("fileInput", new Blob([buffer], { type: "application/pdf" }), fileName);
                
                const imgRes = await fetch(`${PDF_API_BASE}/convert/pdf/img`, {
                    method: "POST",
                    headers: { "X-API-KEY": PDF_API_KEY },
                    body: imgFormData,
                    signal: AbortSignal.timeout(30000),
                });

                if (imgRes.ok) {
                    const zipBuffer = await imgRes.arrayBuffer();
                    const zip = await JSZip.loadAsync(zipBuffer);
                    const files = Object.keys(zip.files).sort();
                    
                    // Take ALL pages as requested by user
                    for (const fileName of files) {
                        if (fileName.match(/\.(png|jpg|jpeg)$/i)) {
                            const imgData = await zip.file(fileName)?.async("base64");
                            if (imgData) images.push(`data:image/png;base64,${imgData}`);
                        }
                    }
                    console.log(`[ExtractText] Successfully converted ${images.length} pages of ${fileName} to base64`);
                }
            } catch (e) {
                console.error("[ExtractText] PDF Image conversion failed:", e);
                if (!text) text = "[PDF processing totally failed]";
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
            images,
            fileName,
            chars: text.length,
            pages: images.length
        });
    } catch (err: any) {
        console.error("Extract text error:", err);
        return NextResponse.json({ error: err.message, text: "", images: [] }, { status: 500 });
    }
}
