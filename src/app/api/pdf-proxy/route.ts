import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://pdf.perricheno.ru/api/v1";
const API_KEY = "19529837-c5f6-4d7e-9452-37e1d8ef3905";

const ENDPOINTS: Record<string, string> = {
    "file-to-pdf": `${API_BASE}/convert/file/pdf`,
    "img-to-pdf": `${API_BASE}/convert/img/pdf`,
    "pdf-to-word": `${API_BASE}/convert/pdf/word`,
    "pdf-to-ppt": `${API_BASE}/convert/pdf/presentation`,
    "pdf-to-text": `${API_BASE}/convert/pdf/text`,
    "pdf-to-html": `${API_BASE}/convert/pdf/html`,
    "pdf-to-xml": `${API_BASE}/convert/pdf/xml`,
    "pdf-to-img": `${API_BASE}/convert/pdf/img`,
    "merge-pdfs": `${API_BASE}/general/merge-pdfs`,
};

export async function POST(req: NextRequest) {
    try {
        const type = req.nextUrl.searchParams.get("type");
        const targetUrl = type ? ENDPOINTS[type] : ENDPOINTS["file-to-pdf"];

        if (!targetUrl) {
            return NextResponse.json({ error: "Invalid conversion type" }, { status: 400 });
        }

        const formData = await req.formData();

        // Forward to external API
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "X-API-KEY": API_KEY,
            },
            body: formData,
        });

        if (!response.ok) {
            const errText = await response.text();
            return NextResponse.json({ error: `API Error: ${response.status} - ${errText}` }, { status: response.status });
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
        console.error("Proxy Error:", e);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
