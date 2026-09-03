import { NextRequest, NextResponse } from "next/server";
import { STIRLING_PDF_API_KEY } from "@/lib/config";

const API_BASE = "https://pdf.perricheno.ru/api/v1";

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
    "vector-to-pdf": `${API_BASE}/convert/vector/pdf`,
    "text-editor-to-pdf": `${API_BASE}/convert/text-editor/pdf`,
    "svg-to-pdf": `${API_BASE}/convert/svg/pdf`,
    "pdf-to-xlsx": `${API_BASE}/convert/pdf/xlsx`,
    "pdf-to-video": `${API_BASE}/convert/pdf/video`,
    "pdf-to-vector": `${API_BASE}/convert/pdf/vector`,
    "pdf-to-text-editor": `${API_BASE}/convert/pdf/text-editor`,
    "pdf-to-epub": `${API_BASE}/convert/pdf/epub`,
    "pdf-to-csv": `${API_BASE}/convert/pdf/csv`,
    "pdf-to-cbz": `${API_BASE}/convert/pdf/cbz`,
    "pdf-to-cbr": `${API_BASE}/convert/pdf/cbr`,
    "eml-to-pdf": `${API_BASE}/convert/eml/pdf`,
    "ebook-to-pdf": `${API_BASE}/convert/ebook/pdf`,
    "cbz-to-pdf": `${API_BASE}/convert/cbz/pdf`,
    "cbr-to-pdf": `${API_BASE}/convert/cbr/pdf`,

    // Edit / General
    "merge-pdfs": `${API_BASE}/general/merge-pdfs`,
    "split-pages": `${API_BASE}/general/split-pages`,
    "remove-pages": `${API_BASE}/general/remove-pages`,
    "rotate-pdf": `${API_BASE}/general/rotate-pdf`,
    "organize-pdf": `${API_BASE}/general/rearrange-pages`,
    "scale-pages": `${API_BASE}/general/scale-pages`,
    "crop-pdf": `${API_BASE}/general/crop`,
    "split-pdf-by-sections": `${API_BASE}/general/split-pdf-by-sections`,
    "split-pdf-by-chapters": `${API_BASE}/general/split-pdf-by-chapters`,
    "split-for-poster-print": `${API_BASE}/general/split-for-poster-print`,
    "split-by-size-or-count": `${API_BASE}/general/split-by-size-or-count`,
    "remove-image-pdf": `${API_BASE}/general/remove-image-pdf`,
    "pdf-to-single-page": `${API_BASE}/general/pdf-to-single-page`,
    "overlay-pdfs": `${API_BASE}/general/overlay-pdfs`,
    "multi-page-layout": `${API_BASE}/general/multi-page-layout`,
    "extract-bookmarks": `${API_BASE}/general/extract-bookmarks`,
    "edit-table-of-contents": `${API_BASE}/general/edit-table-of-contents`,
    "booklet-imposition": `${API_BASE}/general/booklet-imposition`,

    // Security
    "add-password": `${API_BASE}/security/add-password`,
    "remove-password": `${API_BASE}/security/remove-password`,
    "add-watermark": `${API_BASE}/security/add-watermark`,
    "sanitize-pdf": `${API_BASE}/security/sanitize-pdf`,
    "verify-pdf": `${API_BASE}/security/verify-pdf`,
    "validate-signature": `${API_BASE}/security/validate-signature`,
    "remove-cert-sign": `${API_BASE}/security/remove-cert-sign`,
    "redact-pdf": `${API_BASE}/security/redact`,
    "get-info-on-pdf": `${API_BASE}/security/get-info-on-pdf`,
    "cert-sign": `${API_BASE}/security/cert-sign`,
    "auto-redact": `${API_BASE}/security/auto-redact`,

    // Misc
    "compress-pdf": `${API_BASE}/misc/compress-pdf`,
    "ocr-pdf": `${API_BASE}/misc/ocr-pdf`,
    "repair-pdf": `${API_BASE}/misc/repair`,
    "flatten-pdf": `${API_BASE}/misc/flatten`,
    "remove-blanks": `${API_BASE}/misc/remove-blanks`,
    "extract-images": `${API_BASE}/misc/extract-images`,
    "update-metadata": `${API_BASE}/misc/update-metadata`,
    "unlock-pdf-forms": `${API_BASE}/misc/unlock-pdf-forms`,
    "show-javascript": `${API_BASE}/misc/show-javascript`,
    "scanner-effect": `${API_BASE}/misc/scanner-effect`,
    "replace-invert-pdf": `${API_BASE}/misc/replace-invert-pdf`,
    "rename-attachment": `${API_BASE}/misc/rename-attachment`,
    "list-attachments": `${API_BASE}/misc/list-attachments`,
    "extract-image-scans": `${API_BASE}/misc/extract-image-scans`,
    "extract-attachments": `${API_BASE}/misc/extract-attachments`,
    "delete-attachment": `${API_BASE}/misc/delete-attachment`,
    "decompress-pdf": `${API_BASE}/misc/decompress-pdf`,
    "auto-split-pdf": `${API_BASE}/misc/auto-split-pdf`,
    "auto-rename": `${API_BASE}/misc/auto-rename`,
    "add-stamp": `${API_BASE}/misc/add-stamp`,
    "add-page-numbers": `${API_BASE}/misc/add-page-numbers`,
    "add-image": `${API_BASE}/misc/add-image`,
    "add-attachments": `${API_BASE}/misc/add-attachments`,

    // Filter
    "filter-page-size": `${API_BASE}/filter/filter-page-size`,
    "filter-page-rotation": `${API_BASE}/filter/filter-page-rotation`,
    "filter-page-count": `${API_BASE}/filter/filter-page-count`,
    "filter-file-size": `${API_BASE}/filter/filter-file-size`,
    "filter-contains-text": `${API_BASE}/filter/filter-contains-text`,
    "filter-contains-image": `${API_BASE}/filter/filter-contains-image`,

    // Analysis
    "security-info": `${API_BASE}/analysis/security-info`,
    "page-dimensions": `${API_BASE}/analysis/page-dimensions`,
    "page-count": `${API_BASE}/analysis/page-count`,
    "form-fields": `${API_BASE}/analysis/form-fields`,
    "font-info": `${API_BASE}/analysis/font-info`,
    "document-properties": `${API_BASE}/analysis/document-properties`,
    "basic-info": `${API_BASE}/analysis/basic-info`,
    "annotation-info": `${API_BASE}/analysis/annotation-info`,

    // Form
    "modify-fields": `${API_BASE}/form/modify-fields`,
    "fill-form": `${API_BASE}/form/fill`,
    "inspect-fields": `${API_BASE}/form/fields`,
    "fields-with-coordinates": `${API_BASE}/form/fields-with-coordinates`,
    "extract-xlsx-form": `${API_BASE}/form/extract-xlsx`,
    "extract-csv-form": `${API_BASE}/form/extract-csv`,
    "delete-fields": `${API_BASE}/form/delete-fields`,
    
    // Database / Pipeline
    "import-database": `${API_BASE}/database/import-database`,
    "handle-pipeline": `${API_BASE}/pipeline/handleData`,
};

export async function POST(req: NextRequest) {
    try {
        if (!STIRLING_PDF_API_KEY) {
            console.error("[Proxy] STIRLING_PDF_API_KEY is not set");
            return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
        }

        const type = req.nextUrl.searchParams.get("type");
        const targetUrl = type ? ENDPOINTS[type] : ENDPOINTS["file-to-pdf"];

        if (!targetUrl) {
            return NextResponse.json({ error: "Invalid conversion type" }, { status: 400 });
        }

        const formData = await req.formData();

        // Log for debugging
        console.log(`[Proxy] Forwarding to ${targetUrl}`);
        
        // Extract internal parameters and remove them so they don't reach Stirling API
        const originalName = formData.get("originalName") as string || "converted-file";
        formData.delete("originalName");

        // Ensure required input exists (either fileInput or urlInput)
        if (!formData.has("fileInput") && !formData.has("urlInput")) {
            console.error("[Proxy] No input found (fileInput or urlInput)");
            return NextResponse.json({ error: "No input provided" }, { status: 400 });
        }

        // Forward to external API
        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "X-API-KEY": STIRLING_PDF_API_KEY,
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
        const tgExtRaw = contentType.split("/")[1] || "pdf";
        const tgExt = contentDisp.includes(".zip") ? "zip" : tgExtRaw.split(";")[0].trim();
        const finalName = originalName.includes(".") ? originalName.replace(/\.[^/.]+$/, `.${tgExt}`) : `${originalName}.${tgExt}`;

        // Fetch user context synchronously before returning (avoids Next.js request context loss)
        try {
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
                    
                    // Fire and forget
                    fetch(`${baseUrl}/api/telegram/send`, { method: "POST", body: tgFormData })
                        .catch(e => console.error("[Proxy] Telegram BG Send Failed", e));
                }
            }
        } catch (e) {
            console.error("[Proxy] Session check failed", e);
        }

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
