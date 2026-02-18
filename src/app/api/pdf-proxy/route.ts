import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://pdf.perricheno.ru/api/v1";
const API_KEY = "19529837-c5f6-4d7e-9452-37e1d8ef3905";

const ENDPOINTS: Record<string, string> = {
    // Convert
    "file-to-pdf": `${API_BASE}/convert/file/pdf`,
    "img-to-pdf": `${API_BASE}/convert/img/pdf`,
    "pdf-to-word": `${API_BASE}/convert/pdf/word`,
    "pdf-to-ppt": `${API_BASE}/convert/pdf/presentation`,
    "pdf-to-text": `${API_BASE}/convert/pdf/text`,
    "pdf-to-img": `${API_BASE}/convert/pdf/img`,
    "pdf-to-html": `${API_BASE}/convert/pdf/html`,
    "pdf-to-xml": `${API_BASE}/convert/pdf/xml`,
    "pdf-to-pdfa": `${API_BASE}/convert/pdf/pdfa`,
    "html-to-pdf": `${API_BASE}/convert/html/pdf`,
    "markdown-to-pdf": `${API_BASE}/convert/markdown/pdf`,
    "url-to-pdf": `${API_BASE}/convert/url/pdf`,

    // Edit / General
    "merge-pdfs": `${API_BASE}/general/merge-pdfs`,
    "split-pages": `${API_BASE}/general/split-pages`,
    "remove-pages": `${API_BASE}/general/remove-pages`,
    "rotate-pdf": `${API_BASE}/general/rotate-pdf`,
    "organize-pdf": `${API_BASE}/general/rearrange-pages`,
    "scale-pages": `${API_BASE}/general/scale-pages`,
    "crop-pdf": `${API_BASE}/general/crop`,

    // Security
    "add-password": `${API_BASE}/security/add-password`,
    "remove-password": `${API_BASE}/security/remove-password`,
    "add-watermark": `${API_BASE}/security/add-watermark`,
    "sanitize-pdf": `${API_BASE}/security/sanitize-pdf`,

    // Misc
    "compress-pdf": `${API_BASE}/misc/compress-pdf`,
    "ocr-pdf": `${API_BASE}/misc/ocr-pdf`,
    "repair-pdf": `${API_BASE}/misc/repair`,
    "flatten-pdf": `${API_BASE}/misc/flatten`,
    "remove-blanks": `${API_BASE}/misc/remove-blanks`,
    "extract-images": `${API_BASE}/misc/extract-images`,
};

export async function POST(req: NextRequest) {
    try {
        const type = req.nextUrl.searchParams.get("type");
        const targetUrl = type ? ENDPOINTS[type] : ENDPOINTS["file-to-pdf"];

        if (!targetUrl) {
            return NextResponse.json({ error: "Invalid conversion type" }, { status: 400 });
        }

        const formData = await req.formData();

        // Log for debugging
        console.log(`[Proxy] Forwarding to ${targetUrl}`);
        // Ensure fileInput exists
        if (!formData.has("fileInput")) {
            console.error("[Proxy] No fileInput in request");
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Forward to external API
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "X-API-KEY": API_KEY,
                // Do NOT set Content-Type, let browser set boundary
            },
            body: formData,
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Proxy] API Error ${response.status}: ${errText}`);
            return NextResponse.json({
                error: `API Error: ${response.status}`,
                details: errText.substring(0, 500)
            }, { status: response.status });
        }

        // Get file data
        const buffer = await response.arrayBuffer();

        // Determine content type based on response or request type
        const contentType = response.headers.get("Content-Type") || "application/octet-stream";
        const contentDisp = response.headers.get("Content-Disposition") || `attachment; filename="converted-file"`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": contentDisp,
            },
        });
    } catch (e) {
        console.error("[Proxy] Internal Error:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
