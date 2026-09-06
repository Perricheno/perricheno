// Doc-to-TeX's own upload endpoint. Unlike /api/agent/attach (PDF/image/data
// files only, for vision-context use), this accepts the full set of source
// formats the feature promises - PDF, Office documents, photos, plain text -
// and normalizes every one of them down to a PDF before handing off to the
// existing, unchanged pdf-extractor pipeline. See docToTex/ingest.ts.

import { NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { createAgentUpload, getUserActiveUploadsCharTotal, getUserById, PDF_STAGING_CAPS } from "@/lib/db";
import { normalizeAndIngest, classifySource } from "@/lib/agent/docToTex/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Office/photo conversion + OCR can take a while

const MAX_BYTES = 40 * 1024 * 1024; // 40 MB, same ceiling as /api/agent/attach's PDF path

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
    const filename = (form.get("filename") as string | null) || (file as any).name || "document";

    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: `File too large (> ${MAX_BYTES} bytes)` }, { status: 413 });
    }

    const kind = classifySource(file, filename);
    if (!kind) {
        return NextResponse.json({
            error: "Unsupported file type. Accepted: PDF, DOCX/DOC, PPTX/PPT, PNG/JPEG, TXT/MD.",
        }, { status: 415 });
    }

    let normalized;
    try {
        normalized = await normalizeAndIngest(file, filename);
    } catch (e: any) {
        return NextResponse.json({
            error: "Failed to process file",
            details: String(e?.message || e).slice(0, 300),
        }, { status: 502 });
    }

    const charCount = normalized.text.length;
    const images = normalized.bundle?.images ?? [];

    if (charCount === 0 && images.length === 0) {
        return NextResponse.json({ error: "EMPTY_DOCUMENT", message: "Could not extract any text or images from this file." }, { status: 422 });
    }

    const dbUser = await getUserById(userId);
    const planTier = dbUser?.plan_tier || "free";
    const stagingCap = PDF_STAGING_CAPS[planTier] ?? PDF_STAGING_CAPS.free;
    const existing = await getUserActiveUploadsCharTotal(userId);
    if (stagingCap !== -1 && existing + charCount > stagingCap) {
        return NextResponse.json({
            error: "TOTAL_CHAR_CAP",
            message: "Staging limit reached for your plan.",
            fileChars: charCount,
            alreadyUsed: existing,
            stagingCap,
            remaining: Math.max(0, stagingCap - existing),
            planTier,
        }, { status: 413 });
    }

    const row = await createAgentUpload({
        user_id: userId,
        filename: normalized.bundle?.filename || filename,
        text_content: normalized.text,
        images,
        page_count: normalized.bundle?.pageCount ?? 0,
        ocr_used: normalized.bundle?.ocrUsed ?? false,
    });

    return NextResponse.json({
        uploadId: row.id,
        kind,
        filename: row.filename,
        charCount: row.char_count,
        imageCount: row.image_count,
        pageCount: row.page_count,
        ocrUsed: row.ocr_used,
        // For the upload-preview panel - a peek at what was actually
        // extracted, not the full document. Images capped to keep the
        // response small; the full set still exists server-side in
        // AgentUpload and is what the conversion itself will use.
        textPreview: normalized.text.slice(0, 800),
        previewImages: images.slice(0, 6).map(img => img.dataUrl),
    });
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
