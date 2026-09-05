// Wraps a single raster image (a photographed/scanned page) into a one-page
// PDF, so it can flow through the same pdf-extractor path as everything else.
// Reuses the already-deployed latex-compiler service instead of adding a new
// PDF-generation dependency: a trivial LaTeX document containing just the
// image compiles to a valid single-page PDF.

import JSZip from "jszip";

const COMPILER_URL = process.env.LATEX_COMPILER_URL;
const COMPILER_KEY = process.env.LATEX_COMPILER_KEY;

export async function wrapImageAsPdf(imageBuffer: Buffer, contentType: string): Promise<Buffer> {
    if (!COMPILER_URL || !COMPILER_KEY) {
        throw new Error("LATEX_COMPILER_URL / LATEX_COMPILER_KEY not configured");
    }

    // pdflatex's graphicx driver only accepts PNG/JPG/PDF - no WebP support in
    // any TeX engine's default graphics driver. Callers must pre-filter to
    // image/png or image/jpeg; this is the last line of defence.
    if (!contentType.includes("png") && !contentType.includes("jpeg") && !contentType.includes("jpg")) {
        throw new Error(`Unsupported image type for PDF wrapping: ${contentType}`);
    }
    const ext = contentType.includes("png") ? "png" : "jpg";
    const mainTex = [
        "\\documentclass{article}",
        "\\usepackage[margin=0pt]{geometry}",
        "\\usepackage{graphicx}",
        "\\pagestyle{empty}",
        "\\begin{document}",
        `\\includegraphics[width=\\paperwidth,height=\\paperheight,keepaspectratio]{page.${ext}}`,
        "\\end{document}",
    ].join("\n");

    const zip = new JSZip();
    zip.file("main.tex", mainTex);
    zip.file(`page.${ext}`, imageBuffer);
    const zipBlob: Buffer = await zip.generateAsync({ type: "nodebuffer" });
    const freshZip = new Uint8Array(new ArrayBuffer(zipBlob.byteLength));
    freshZip.set(zipBlob);

    const form = new FormData();
    form.append("file", new Blob([freshZip]), "project.zip");

    const res = await fetch(COMPILER_URL, {
        method: "POST",
        headers: { "x-api-key": COMPILER_KEY },
        body: form,
        signal: AbortSignal.timeout(60_000),
    });

    const ct = res.headers.get("content-type") || "";
    if (!res.ok || ct.includes("json") || ct.includes("text")) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Image-to-PDF wrap failed: ${detail.slice(0, 300)}`);
    }

    return Buffer.from(await res.arrayBuffer());
}
