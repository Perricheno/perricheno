// Server-side PDF ingestion — text + embedded images via Stirling-PDF
// (pdf.perricheno.ru). No client-side parsing; everything runs here so the
// browser stays thin and the service boundary is auditable.
//
// Stirling endpoints used:
//   POST /api/v1/convert/pdf/text      → text/plain (extracted text)
//   POST /api/v1/misc/extract-images   → application/zip (embedded images)
//   POST /api/v1/misc/ocr-pdf          → application/pdf (PDF with text layer)
//   POST /api/v1/analysis/page-count   → JSON { pageCount } (if available)

import JSZip from "jszip";

const PDF_BASE = process.env.PDF_SERVICE_URL || "https://pdf.perricheno.ru/api/v1";
const PDF_KEY = process.env.PDF_API_KEY || "0a69f4b4-0210-47c0-a2a9-946e3e894c4c";

const OCR_TEXT_THRESHOLD_PER_PAGE = 200; // below this → treat as scan, try OCR
const OCR_TEXT_ABSOLUTE_MIN = 500;       // regardless of pages
const IMAGE_BYTES_CAP = 2 * 1024 * 1024; // 2 MB per image; bigger → downsample-by-skip (drop)

export interface IngestedImage {
    dataUrl: string;           // e.g. "data:image/jpeg;base64,..."
    contentType: string;
    bytes: number;
}

export interface IngestedPdf {
    filename: string;
    text: string;
    images: IngestedImage[];
    pageCount: number;
    charCount: number;
    imageCount: number;
    ocrUsed: boolean;
}

// ── Low-level Stirling wrappers ──

async function stirlingMultipart(endpoint: string, pdfBuffer: Buffer, filename: string, extra?: Record<string, string>): Promise<Response> {
    const form = new FormData();
    // Node 22+ tightened Blob's BlobPart type: Buffer and Uint8Array<ArrayBufferLike>
    // both have `buffer: ArrayBufferLike`, which is no longer assignable to the
    // required ArrayBuffer-backed view. Copy into a freshly-allocated ArrayBuffer
    // to produce a Uint8Array<ArrayBuffer>.
    const fresh = new Uint8Array(new ArrayBuffer(pdfBuffer.byteLength));
    fresh.set(pdfBuffer);
    const blob = new Blob([fresh], { type: "application/pdf" });
    form.append("fileInput", blob, filename);
    if (extra) for (const [k, v] of Object.entries(extra)) form.append(k, v);

    return fetch(`${PDF_BASE}${endpoint}`, {
        method: "POST",
        headers: { "X-API-KEY": PDF_KEY },
        body: form,
    });
}

async function extractText(pdfBuffer: Buffer, filename: string): Promise<string> {
    const res = await stirlingMultipart("/convert/pdf/text", pdfBuffer, filename);
    if (!res.ok) throw new Error(`pdf-to-text failed: ${res.status}`);
    return await res.text();
}

async function extractImages(pdfBuffer: Buffer, filename: string): Promise<IngestedImage[]> {
    const res = await stirlingMultipart("/misc/extract-images", pdfBuffer, filename, { format: "jpeg" });
    if (!res.ok) {
        // Image extraction is best-effort; don't break ingestion over it.
        console.warn(`[pdfIngest] extract-images failed: ${res.status}`);
        return [];
    }
    const ab = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);

    const out: IngestedImage[] = [];
    const entries = Object.values(zip.files).filter(f => !f.dir);

    for (const entry of entries) {
        const name = entry.name.toLowerCase();
        const ct = name.endsWith(".png") ? "image/png"
                 : name.endsWith(".webp") ? "image/webp"
                 : "image/jpeg";
        const buf = Buffer.from(await entry.async("arraybuffer"));
        if (buf.byteLength > IMAGE_BYTES_CAP) continue; // skip oversized (usually raster scans)
        if (buf.byteLength < 2048) continue;            // skip tiny (likely decorative)
        out.push({
            dataUrl: `data:${ct};base64,${buf.toString("base64")}`,
            contentType: ct,
            bytes: buf.byteLength,
        });
    }
    return out;
}

async function ocrPdf(pdfBuffer: Buffer, filename: string): Promise<Buffer> {
    const res = await stirlingMultipart("/misc/ocr-pdf", pdfBuffer, filename, {
        languages: "eng,rus",
        ocrType: "force-ocr",
        ocrRenderType: "normal",
    });
    if (!res.ok) throw new Error(`ocr-pdf failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

async function pageCount(pdfBuffer: Buffer, filename: string): Promise<number> {
    try {
        const res = await stirlingMultipart("/analysis/page-count", pdfBuffer, filename);
        if (!res.ok) return 0;
        const j = await res.json();
        return Number(j?.pageCount || j?.pages || 0) || 0;
    } catch {
        return 0;
    }
}

// ── Public entry point ──

export async function ingestPdf(pdfBuffer: Buffer, filename: string): Promise<IngestedPdf> {
    // Kick off text, images, and pageCount in parallel. Text + images is the
    // hot path; pageCount is advisory (used to decide whether OCR is needed).
    const [textResult, imagesResult, pagesResult] = await Promise.allSettled([
        extractText(pdfBuffer, filename),
        extractImages(pdfBuffer, filename),
        pageCount(pdfBuffer, filename),
    ]);

    let text = textResult.status === "fulfilled" ? textResult.value : "";
    const images = imagesResult.status === "fulfilled" ? imagesResult.value : [];
    const pages = pagesResult.status === "fulfilled" ? pagesResult.value : 0;

    // OCR fallback: the PDF is probably scanned if we got almost no text.
    const tooSmallAbs = text.length < OCR_TEXT_ABSOLUTE_MIN;
    const tooSmallPerPage = pages > 0 && text.length < pages * OCR_TEXT_THRESHOLD_PER_PAGE;

    let ocrUsed = false;
    if (tooSmallAbs || tooSmallPerPage) {
        try {
            const ocrBuf = await ocrPdf(pdfBuffer, filename);
            const ocrText = await extractText(ocrBuf, filename);
            if (ocrText.length > text.length) {
                text = ocrText;
                ocrUsed = true;
            }
        } catch (e) {
            console.warn(`[pdfIngest] OCR fallback failed for ${filename}:`, e);
            // Keep whatever text we had (possibly empty).
        }
    }

    // Normalize text: strip form-feed page breaks, collapse runs of blank lines,
    // trim trailing whitespace per line. Keeps the LLM focused on content.
    text = text
        .replace(/\f/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return {
        filename,
        text,
        images,
        pageCount: pages,
        charCount: text.length,
        imageCount: images.length,
        ocrUsed,
    };
}
