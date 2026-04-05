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

        if (currentExt === 'pdf') {
            // 1. Try Text Extraction first
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

            // 2. PRIMARY: Convert PDF to Images for Vision analysis (OPTIMIZED DPI)
            try {
                const imgFormData = new FormData();
                imgFormData.append("fileInput", new Blob([currentBuffer], { type: "application/pdf" }), fileName);
                // 150 DPI + JPG significantly reduces file size (by up to 90%)
                imgFormData.append("imageDPI", "150");
                imgFormData.append("imageFormat", "jpg");
                
                const imgRes = await fetch(`${PDF_API_BASE}/convert/pdf/img`, {
                    method: "POST",
                    headers: { "X-API-KEY": PDF_API_KEY },
                    body: imgFormData,
                    signal: AbortSignal.timeout(45000),
                });

                if (imgRes.ok) {
                    const zipBuffer = await imgRes.arrayBuffer();
                    const zip = await JSZip.loadAsync(zipBuffer);
                    const files = Object.keys(zip.files).sort();
                    
                    // Take first 50 pages to prevent context window crash
                    const limitedFiles = files.slice(0, 50);
                    for (const fName of limitedFiles) {
                        if (fName.match(/\.(png|jpg|jpeg)$/i)) {
                            const imgData = await zip.file(fName)?.async("base64");
                            if (imgData) images.push(`data:image/jpeg;base64,${imgData}`);
                        }
                    }
                    console.log(`[ExtractText] Processed ${images.length} pages at 150 DPI (JPG).`);
                }
            } catch (e) {
                console.error("[ExtractText] PDF Image conversion failed:", e);
                if (!text) text = "[File processing failed]";
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
