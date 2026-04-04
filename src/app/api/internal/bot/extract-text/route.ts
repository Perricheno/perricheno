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

        let currentBuffer = buffer;
        let currentExt = ext;

        // 0. Support Office formats by converting them to PDF first via Stirling
        if (['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt'].includes(ext || '')) {
            try {
                console.log(`[ExtractText] Converting ${ext} to PDF via Stirling...`);
                const convFormData = new FormData();
                convFormData.append("fileInput", new Blob([buffer]), fileName);
                const convRes = await fetch(`${PDF_API_BASE}/convert/file/pdf`, {
                    method: "POST",
                    headers: { "X-API-KEY": PDF_API_KEY },
                    body: convFormData,
                    signal: AbortSignal.timeout(30000),
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

        if (currentExt === 'pdf') {
            // 1. Try Text Extraction first (as metadata/fallback)
            try {
                const formData = new FormData();
                formData.append("fileInput", new Blob([currentBuffer], { type: "application/pdf" }), fileName);
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
                imgFormData.append("fileInput", new Blob([currentBuffer], { type: "application/pdf" }), fileName);
                
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
                    for (const fName of files) {
                        if (fName.match(/\.(png|jpg|jpeg)$/i)) {
                            const imgData = await zip.file(fName)?.async("base64");
                            if (imgData) images.push(`data:image/png;base64,${imgData}`);
                        }
                    }
                }
            } catch (e) {
                console.error("[ExtractText] PDF Image conversion failed:", e);
                if (!text) text = "[File processing totally failed]";
            }
        } else if (['txt', 'csv', 'tsv', 'json', 'md', 'tex', 'log', 'xml', 'r', 'py', 'js', 'ts', 'html'].includes(ext || '')) {
            const raw = buffer.toString('utf-8');
            if (ext === 'csv' || raw.includes(',')) {
                // Intelligent CSV Schema Extraction
                const allLines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const header = allLines[0];
                const sample = allLines.slice(1, 10); // First 9 data rows (total 10 lines with header)
                const rowCount = allLines.length;
                
                // Build a schema insights block
                const columns = header.split(',').map(c => c.trim().replace(/"/g, ''));
                text = `[DATASET SCHEMA DETECTED]\n`;
                text += `TOTAL ROWS: ${rowCount}\n`;
                text += `COLUMNS: ${columns.join(' | ')}\n\n`;
                text += `[STRUCTURAL SAMPLE (First 10 rows)]:\n${header}\n${sample.join('\n')}\n\n`;
                text += `[LOGIC INSTRUCTION]: This is a dataset with ${rowCount} rows. Analyze the types of metrics in "${columns.join(', ')}". Write code that handles the entire distribution correctly (simulation of patterns).`;
            } else {
                const lines = raw.split('\n');
                text = lines.length > 50 
                    ? `[TRUNCATED TEXT: Showing 50 of ${lines.length} lines]\n\n` + lines.slice(0, 50).join('\n')
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
