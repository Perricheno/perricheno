import { NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { createAgentUpload, getUserActiveUploadsCharTotal, getUserById, PDF_STAGING_CAPS } from "@/lib/db";
import { ingestPdf } from "@/lib/agent/pdfIngest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILE_BYTES = 40 * 1024 * 1024; // 40 MB per PDF

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
    }

    const filename = (form.get("filename") as string | null) || (file as any).name || "document.pdf";

    // Guard: PDF only. Mime is spoofable; do a cheap magic-byte check later.
    if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(filename)) {
        return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 415 });
    }

    if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `File too large (> ${MAX_FILE_BYTES} bytes)` }, { status: 413 });
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    // Magic bytes: PDFs start with "%PDF-"
    if (buf.length < 5 || buf.slice(0, 5).toString("utf8") !== "%PDF-") {
        return NextResponse.json({ error: "File does not look like a valid PDF" }, { status: 415 });
    }

    // ── Parse ──
    let bundle;
    try {
        bundle = await ingestPdf(buf, filename);
    } catch (e: any) {
        console.error("[ingest-pdf] failed:", e);
        return NextResponse.json({ error: "Failed to parse PDF", details: String(e?.message || e).slice(0, 300) }, { status: 502 });
    }

    // ── Plan-based staging cap check ──
    const dbUser = await getUserById(userId);
    const planTier = dbUser?.plan_tier || 'free';
    const stagingCap = PDF_STAGING_CAPS[planTier] ?? PDF_STAGING_CAPS.free;

    const existingTotal = await getUserActiveUploadsCharTotal(userId);

    if (stagingCap !== -1 && existingTotal + bundle.charCount > stagingCap) {
        const remaining = Math.max(0, stagingCap - existingTotal);
        return NextResponse.json({
            error: "TOTAL_CHAR_CAP",
            message: `Staging limit reached for your plan.`,
            fileChars: bundle.charCount,
            alreadyUsed: existingTotal,
            stagingCap,
            remaining,
            planTier,
        }, { status: 413 });
    }

    // Reject empty results explicitly - user needs a clear signal.
    if (bundle.charCount === 0 && bundle.imageCount === 0) {
        return NextResponse.json({
            error: "EMPTY_PDF",
            message: "Could not extract any text or images from this PDF.",
        }, { status: 422 });
    }

    // ── Persist ──
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
        filename: row.filename,
        charCount: row.char_count,
        imageCount: row.image_count,
        pageCount: row.page_count,
        ocrUsed: row.ocr_used,
        remaining: stagingCap === -1 ? -1 : Math.max(0, stagingCap - (existingTotal + bundle.charCount)),
    });
}

// Optional: allow deletion before the 24h TTL (e.g. user removes a file from the staging tray).
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
