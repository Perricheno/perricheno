import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

// @ts-ignore
import { read, utils } from "xlsx";

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

        // 0. Support Office formats (Docx/Pptx) by converting them to PDF first via Stirling
        // NOTE: We EXCLUDE 'xlsx' and 'xls' here to process them natively for better accuracy.
        if (['docx', 'doc', 'pptx', 'ppt'].includes(ext || '')) {
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
                    signal: AbortSignal.timeout(45000), // Extended for large files
                });

                if (imgRes.ok) {
                    const zipBuffer = await imgRes.arrayBuffer();
                    const zip = await JSZip.loadAsync(zipBuffer);
                    const files = Object.keys(zip.files).sort();
                    
                    // Take first 50 pages to prevent context window crash for huge documents
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
        } else if (['xlsx', 'xls', 'txt', 'csv', 'tsv', 'json', 'md', 'xml'].includes(ext || '')) {
            // NATIVE SPREADSHEET & TEXT HANDLER
            if (ext === 'xlsx' || ext === 'xls') {
                try {
                    const workbook = read(buffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const data = utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
                    
                    const rowCount = data.length;
                    const headers = (data[0] || []).map(h => String(h).trim());
                    const sample = data.slice(0, 25); // First 25 rows for structural insight
                    
                    text = `[DATASET SCHEMA DETECTED]\n`;
                    text += `FILE TYPE: EXCEL (${ext.toUpperCase()})\n`;
                    text += `ACTIVE SHEET: "${sheetName}"\n`;
                    text += `TOTAL ROWS: ${rowCount}\n`;
                    text += `COLUMNS: ${headers.join(' | ')}\n\n`;
                    text += `[STRUCTURAL SAMPLE (First 25 rows)]:\n`;
                    text += sample.map(row => row.join(' | ')).join('\n');
                    text += `\n\n[LOGIC INSTRUCTION]: This is a dataset with ${rowCount} rows. Analyze columns "${headers.join(', ')}". Load data using pandas directly from the provided strings.`;
                    
                    console.log(`[ExtractText] Parsed EXCEL: ${rowCount} rows, ${headers.length} cols.`);
                } catch (e) {
                    text = `[ERROR Parsing Excel: ${e}]`;
                }
            } else {
                const raw = buffer.toString('utf-8');
                if (ext === 'csv' || raw.includes(',')) {
                    // Intelligent CSV Schema Extraction
                    const allLines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    const header = allLines[0];
                    const sample = allLines.slice(0, 25);
                    const rowCount = allLines.length;
                    
                    text = `[DATASET SCHEMA DETECTED]\n`;
                    text += `TOTAL ROWS: ${rowCount}\n`;
                    text += `COLUMNS: ${header.split(',').join(' | ')}\n\n`;
                    text += `[STRUCTURAL SAMPLE (First 25 rows)]:\n${sample.join('\n')}\n\n`;
                    text += `[LOGIC INSTRUCTION]: Analyze this dataset. Read it via io.StringIO in your Python code.`;
                } else {
                    const lines = raw.split('\n');
                    text = lines.length > 100 
                        ? `[TRUNCATED TEXT: Showing 100 of ${lines.length} lines]\n\n` + lines.slice(0, 100).join('\n')
                        : raw;
                }
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
