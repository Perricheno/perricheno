// Unified attachment endpoint — used by chat (and anywhere else) to upload a
// PDF or an image and get back an uploadId in agent_uploads. No parsing on the
// client, no base64 payloads in DB history.
//
// PDF  → Stirling pipeline (text + embedded images + OCR fallback).
// Image (png/jpeg/webp) → stored as a single image entry with empty text.
// Anything else → 415.

import { NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { createAgentUpload, getUserActiveUploadsCharTotal } from "@/lib/db";
import { ingestPdf } from "@/lib/agent/pdfIngest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TOTAL_CHAR_CAP = 200_000;
const MAX_PDF_BYTES = 40 * 1024 * 1024;      // 40 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;    // 10 MB
const MAX_DATA_BYTES = 20 * 1024 * 1024;     // 20 MB for CSV/Excel
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const DATA_MIMES = new Set([
    "text/csv",
    "text/plain",
    "application/json",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/tab-separated-values",
]);

function isPdf(file: Blob, name: string): boolean {
    if (file.type === "application/pdf") return true;
    return /\.pdf$/i.test(name);
}

function isImage(file: Blob, name: string): boolean {
    if (IMAGE_MIMES.has(file.type)) return true;
    return /\.(png|jpe?g|webp)$/i.test(name);
}

function isDataFile(file: Blob, name: string): boolean {
    if (DATA_MIMES.has(file.type)) return true;
    return /\.(csv|xlsx?|json|tsv|txt)$/i.test(name);
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let form: FormData;
    try { form = await req.formData(); }
    catch { return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 }); }

    const file = form.get("file");
    if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
    }
    const filename = (form.get("filename") as string | null) || (file as any).name || "attachment";

    // ── PDF path ──
    if (isPdf(file, filename)) {
        if (file.size > MAX_PDF_BYTES) {
            return NextResponse.json({ error: `PDF too large (> ${MAX_PDF_BYTES} bytes)` }, { status: 413 });
        }
        const buf = Buffer.from(await file.arrayBuffer());
        if (buf.length < 5 || buf.slice(0, 5).toString("utf8") !== "%PDF-") {
            return NextResponse.json({ error: "File does not look like a valid PDF" }, { status: 415 });
        }

        let bundle;
        try { bundle = await ingestPdf(buf, filename); }
        catch (e: any) {
            return NextResponse.json({ error: "Failed to parse PDF", details: String(e?.message || e).slice(0, 300) }, { status: 502 });
        }

        const existing = await getUserActiveUploadsCharTotal(userId);
        if (existing + bundle.charCount > TOTAL_CHAR_CAP) {
            return NextResponse.json({
                error: "TOTAL_CHAR_CAP",
                message: `Upload would exceed the ${TOTAL_CHAR_CAP.toLocaleString()}-character cap.`,
                fileChars: bundle.charCount,
                alreadyUsed: existing,
                remaining: Math.max(0, TOTAL_CHAR_CAP - existing),
            }, { status: 413 });
        }

        if (bundle.charCount === 0 && bundle.imageCount === 0) {
            return NextResponse.json({ error: "EMPTY_PDF", message: "Could not extract any text or images from this PDF." }, { status: 422 });
        }

        const row = await createAgentUpload({
            user_id: userId,
            filename: bundle.filename,
            text_content: bundle.text,
            images: bundle.images,
            page_count: bundle.pageCount,
            ocr_used: bundle.ocrUsed,
        });

        return NextResponse.json({
            uploadId: row.id,
            kind: "pdf",
            filename: row.filename,
            charCount: row.char_count,
            imageCount: row.image_count,
            pageCount: row.page_count,
            ocrUsed: row.ocr_used,
        });
    }

    // ── Image path ──
    if (isImage(file, filename)) {
        if (file.size > MAX_IMAGE_BYTES) {
            return NextResponse.json({ error: `Image too large (> ${MAX_IMAGE_BYTES} bytes)` }, { status: 413 });
        }
        const buf = Buffer.from(await file.arrayBuffer());
        const ct = file.type || (filename.match(/\.png$/i) ? "image/png" : filename.match(/\.webp$/i) ? "image/webp" : "image/jpeg");

        const row = await createAgentUpload({
            user_id: userId,
            filename,
            text_content: "",
            images: [{ dataUrl: `data:${ct};base64,${buf.toString("base64")}`, contentType: ct, bytes: buf.byteLength }],
            page_count: 0,
            ocr_used: false,
        });

        return NextResponse.json({
            uploadId: row.id,
            kind: "image",
            filename: row.filename,
            charCount: 0,
            imageCount: 1,
            pageCount: 0,
            ocrUsed: false,
        });
    }

    // ── Data file path (CSV, Excel, JSON, etc.) ──
    if (isDataFile(file, filename)) {
        if (file.size > MAX_DATA_BYTES) {
            return NextResponse.json({ error: `Data file too large (> ${MAX_DATA_BYTES} bytes)` }, { status: 413 });
        }
        
        let text: string;
        
        try {
            // For Excel files, just store the raw bytes as base64
            // The Analytics Pipeline will parse them
            if (filename.match(/\.xlsx?$/i)) {
                const buf = Buffer.from(await file.arrayBuffer());
                text = `[EXCEL_FILE:${buf.toString('base64')}]`;
            } else {
                // For text-based files (CSV, JSON, TSV, TXT)
                text = await file.text();
            }
        } catch (e: any) {
            return NextResponse.json({ 
                error: "Failed to read file", 
                details: String(e?.message || e).slice(0, 200) 
            }, { status: 500 });
        }
        
        const charCount = text.length;
        
        // For data analytics, don't enforce TOTAL_CHAR_CAP
        // (data files are used differently than PDFs)
        
        const row = await createAgentUpload({
            user_id: userId,
            filename,
            text_content: text,
            images: [],
            page_count: 1,
            ocr_used: false,
        });

        return NextResponse.json({
            uploadId: row.id,
            kind: "data",
            filename: row.filename,
            charCount: row.char_count,
            imageCount: 0,
            pageCount: 1,
            ocrUsed: false,
        });
    }

    return NextResponse.json({ 
        error: "Unsupported file type. Accepted: PDF, PNG, JPEG, WebP, CSV, Excel, JSON, TSV, TXT." 
    }, { status: 415 });
}

export async function DELETE(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { deleteAgentUpload } = await import("@/lib/db");
    await deleteAgentUpload(id, userId);
    return NextResponse.json({ ok: true });
}
