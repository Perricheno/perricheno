import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://pdf.perricheno.ru/api/v1";
const API_KEY = "02cb1632-3a3f-4cc2-ae6f-598c8b483bb9";

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
        
        // Background Telegram Delivery
        const originalName = formData.get("originalName") as string || "converted-file";
        const tgExt = contentDisp.includes(".zip") ? "zip" : contentType.split("/")[1] || "pdf";
        const finalName = originalName.includes(".") ? originalName.replace(/\.[^/.]+$/, `.${tgExt}`) : `${originalName}.${tgExt}`;

        // Fire and forget Telegram delivery if user is logged in
        import("next/headers").then(async ({ cookies }) => {
            const { verifySession } = await import("@/lib/session");
            const { getUserById } = await import("@/lib/db");
            const userId = await verifySession();
            
            if (userId) {
                const user = await getUserById(Number(userId));
                
                if (user?.telegram_id) {
                    console.log(`[Proxy] Sending ${finalName} to Telegram user ${user.telegram_id}`);
                    const tgFormData = new FormData();
                    tgFormData.append("document", new Blob([buffer], { type: contentType }), finalName);
                    tgFormData.append("chat_id", user.telegram_id.toString());
                    
                    // Construct absolute URL for the webhook proxy
                    const protocol = req.headers.get("x-forwarded-proto") || "http";
                    const host = req.headers.get("host");
                    const baseUrl = `${protocol}://${host}`;
                    
                    fetch(`${baseUrl}/api/telegram/send`, { method: "POST", body: tgFormData })
                        .catch(e => console.error("[Proxy] Telegram BG Send Failed", e));
                }
            }
        }).catch(e => console.error("[Proxy] Session check failed", e));

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
