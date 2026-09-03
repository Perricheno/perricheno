import { NextRequest, NextResponse } from "next/server";
import { STIRLING_PDF_API_KEY } from "@/lib/config";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PDF_EXTRACTOR_URL = process.env.PDF_EXTRACTOR_URL || "http://pdf-extractor:8080";
const PDF_API_BASE = "https://pdf.perricheno.ru/api/v1";

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const fileName = req.headers.get("x-file-name") || "unknown";
        const buffer = Buffer.from(await req.arrayBuffer());
        const ext = fileName.split('.').pop()?.toLowerCase();

        let text = "";
        let images: string[] = [];

        let currentBuffer = buffer;
        let currentExt = ext;

        // 0. Support Office formats by converting them to PDF first via Stirling
        if (['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt'].includes(ext || '')) {
            if (!STIRLING_PDF_API_KEY) {
                console.error("[ExtractText] STIRLING_PDF_API_KEY is not set - skipping Office-to-PDF conversion");
            } else {
                try {
                    console.log(`[ExtractText] Converting ${ext} to PDF via Stirling...`);
                    const convFormData = new FormData();
                    convFormData.append("fileInput", new Blob([buffer]), fileName);
                    const convRes = await fetch(`${PDF_API_BASE}/convert/file/pdf`, {
                        method: "POST",
                        headers: { "X-API-KEY": STIRLING_PDF_API_KEY },
                        body: convFormData,
                        signal: AbortSignal.timeout(45000),
                    });
                    if (convRes.ok) {
                        currentBuffer = Buffer.from(await convRes.arrayBuffer());
                        currentExt = 'pdf';
                        console.log(`[ExtractText] Successfully converted ${ext} to PDF.`);
                    }
                } catch (e) {
                    console.error(`[ExtractText] Conversion of ${ext} failed:`, e);
                }
            }
        }

        if (currentExt === 'pdf') {
            // PDF → pdf-extractor (PaddleOCR-VL: layout-aware markdown + embedded images)
            try {
                const form = new FormData();
                form.append("file", new Blob([currentBuffer], { type: "application/pdf" }), fileName);
                const res = await fetch(`${PDF_EXTRACTOR_URL}/extract`, {
                    method: "POST",
                    body: form,
                    signal: AbortSignal.timeout(300_000), // 5 min - async job can take a while
                });
                if (res.ok) {
                    const data = await res.json();
                    text = (data.text || "").replace(/\f/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
                    images = (data.images || [])
                        .filter((img: { bytes: number }) => img.bytes >= 2048)
                        .map((img: { dataUrl: string }) => img.dataUrl);
                    console.log(`[ExtractText] pdf-extractor: ${text.length} chars, ${images.length} images`);
                } else {
                    console.warn(`[ExtractText] pdf-extractor returned ${res.status}`);
                    text = "[PDF extraction failed]";
                }
            } catch (e) {
                console.error("[ExtractText] pdf-extractor error:", e);
                text = "[PDF extraction failed]";
            }
        } else if (['txt', 'csv', 'tsv', 'json', 'md', 'xml'].includes(ext || '')) {
            // SAFE BUFFER READING: Only read up to 5MB to prevent memory exhaustion on 1M+ row files
            const MAX_BYTES = 5 * 1024 * 1024; 
            const safeBuffer = buffer.length > MAX_BYTES ? buffer.subarray(0, MAX_BYTES) : buffer;
            const raw = safeBuffer.toString('utf-8');
            
            if (ext === 'csv' || raw.includes(',')) {
                // Intelligent CSV Schema Extraction (Limited to 10 rows for massive files)
                const allLines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const header = allLines[0];
                const sample = allLines.slice(0, 10); // EXACTLY 10 ROWS as requested
                
                text = `[DATASET SCHEMA DETECTED]\n`;
                text += `COLUMNS: ${header.split(',').join(' | ')}\n\n`;
                text += `[STRUCTURAL SAMPLE (First 10 rows)]:\n`;
                text += `===CSV START===\n${sample.join('\n')}\n===CSV END===\n\n`;
                text += `[LOGIC INSTRUCTION]: Analyze this dataset using the provided get_dataframe() helper.`;
            } else {
                const lines = raw.split('\n');
                text = lines.length > 800 
                    ? `[TRUNCATED TEXT: Showing 800 lines]\n\n` + lines.slice(0, 800).join('\n')
                    : raw;
            }
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
