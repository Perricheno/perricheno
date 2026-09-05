// Office document (DOCX/DOC/PPTX/PPT/XLSX/XLS) → PDF, via the Stirling-PDF
// service. Extracted from the bot's extract-text route so it can be reused by
// any upload path (Doc-to-TeX included), not just the Telegram bot.

import { STIRLING_PDF_API_KEY } from "@/lib/config";

const PDF_API_BASE = "https://pdf.perricheno.ru/api/v1";

export const OFFICE_EXTENSIONS = new Set(["xlsx", "xls", "docx", "doc", "pptx", "ppt"]);

export async function convertOfficeToPdf(buffer: Buffer, filename: string) {
    if (!STIRLING_PDF_API_KEY) {
        throw new Error("STIRLING_PDF_API_KEY is not set - cannot convert Office documents to PDF");
    }

    // Blob's DOM typings want an ArrayBufferView<ArrayBuffer> specifically;
    // a Node Buffer is typed over the wider ArrayBufferLike. Copy into a
    // fresh Uint8Array to satisfy that - same workaround pdfIngest.ts uses.
    const fresh = new Uint8Array(new ArrayBuffer(buffer.byteLength));
    fresh.set(buffer);

    const form = new FormData();
    form.append("fileInput", new Blob([fresh]), filename);

    const res = await fetch(`${PDF_API_BASE}/convert/file/pdf`, {
        method: "POST",
        headers: { "X-API-KEY": STIRLING_PDF_API_KEY },
        body: form,
        signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Stirling conversion failed: ${res.status} ${detail.slice(0, 200)}`);
    }

    return Buffer.from(await res.arrayBuffer());
}
