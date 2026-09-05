// Doc-to-TeX ingestion entry point. Normalizes every accepted input format
// down to a PDF, then hands off to the existing, unchanged pdf-extractor
// pipeline (ingestPdf). This means pdf-extractor and PaddleOCR-VL never need
// to know about Office documents or photos - they only ever see PDFs.

import { ingestPdf, type IngestedPdf } from "@/lib/agent/pdfIngest";
import { convertOfficeToPdf, OFFICE_EXTENSIONS } from "@/lib/agent/officeToPdf";
import { wrapImageAsPdf } from "./imageToPdf";

export type DocToTexSourceKind = "pdf" | "office" | "image" | "text";

export function classifySource(file: Blob, filename: string): DocToTexSourceKind | null {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (file.type === "application/pdf" || ext === "pdf") return "pdf";
    if (OFFICE_EXTENSIONS.has(ext)) return "office";
    if (["image/png", "image/jpeg"].includes(file.type) || /\.(png|jpe?g)$/i.test(filename)) return "image";
    if (["txt", "md"].includes(ext)) return "text";
    return null;
}

export interface NormalizedInput {
    kind: DocToTexSourceKind;
    // For text inputs, ingestion is trivial - no images, text as-is.
    text: string;
    bundle: IngestedPdf | null;
}

export async function normalizeAndIngest(file: Blob, filename: string): Promise<NormalizedInput> {
    const kind = classifySource(file, filename);
    if (!kind) throw new Error(`Unsupported file type: ${filename}`);

    if (kind === "text") {
        const text = await file.text();
        return { kind, text, bundle: null };
    }

    let pdfBuffer: Buffer;
    if (kind === "pdf") {
        pdfBuffer = Buffer.from(await file.arrayBuffer());
    } else if (kind === "office") {
        const raw = Buffer.from(await file.arrayBuffer());
        pdfBuffer = await convertOfficeToPdf(raw, filename);
    } else {
        const raw = Buffer.from(await file.arrayBuffer());
        pdfBuffer = await wrapImageAsPdf(raw, file.type || "image/png");
    }

    const bundle = await ingestPdf(pdfBuffer, filename);
    return { kind, text: bundle.text, bundle };
}
