// Server-side PDF ingestion - text + embedded images via pdf-extractor service
// No client-side parsing; everything runs here so the browser stays thin.
//
// pdf-extractor endpoints:
//   POST /extract → JSON { text, images[], pageCount, ocrUsed }
//   GET  /health  → JSON { status: "UP" }

const PDF_EXTRACTOR_URL = process.env.PDF_EXTRACTOR_URL || "http://pdf-extractor:8080";

const IMAGE_BYTES_CAP = 2 * 1024 * 1024; // 2 MB per image; bigger → skip

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

// ── Public entry point ──

export async function ingestPdf(pdfBuffer: Buffer, filename: string): Promise<IngestedPdf> {
    // Call pdf-extractor service - it handles text extraction, images, OCR, everything
    const form = new FormData();
    const fresh = new Uint8Array(new ArrayBuffer(pdfBuffer.byteLength));
    fresh.set(pdfBuffer);
    const blob = new Blob([fresh], { type: "application/pdf" });
    form.append("file", blob, filename);

    const res = await fetch(`${PDF_EXTRACTOR_URL}/extract`, {
        method: "POST",
        body: form,
    });

    if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`PDF extraction failed: ${res.status} - ${errorText}`);
    }

    const data = await res.json();

    // Filter images by size cap (pdf-extractor returns all images)
    const filteredImages = (data.images || []).filter((img: IngestedImage) => 
        img.bytes <= IMAGE_BYTES_CAP && img.bytes >= 2048
    );

    // Normalize text: strip form-feed page breaks, collapse runs of blank lines,
    // trim trailing whitespace per line. Keeps the LLM focused on content.
    let text = (data.text || "")
        .replace(/\f/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return {
        filename: data.filename || filename,
        text,
        images: filteredImages,
        pageCount: data.pageCount || 0,
        charCount: text.length,
        imageCount: filteredImages.length,
        ocrUsed: data.ocrUsed || false,
    };
}
