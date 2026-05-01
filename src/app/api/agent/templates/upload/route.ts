// Accepts an Overleaf-style ZIP, extracts the preamble from main.tex, and
// returns it as a plain string. No DB storage — the client passes it to
// /api/agent/generate via customTemplatePreamble in settings.

import { NextResponse } from "next/server";
import JSZip from "jszip";
import { verifySession } from "@/lib/session";

const MAX_ZIP_BYTES = 10 * 1024 * 1024; // 10 MB

// Everything before \begin{document}
function extractPreamble(mainTex: string): string {
    const marker = mainTex.search(/\\begin\s*\{document\}/);
    const raw = marker !== -1 ? mainTex.slice(0, marker) : mainTex;
    return raw.trim();
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_ZIP_BYTES) {
        return NextResponse.json({ error: "ZIP file too large (max 10 MB)." }, { status: 413 });
    }

    let formData: FormData;
    try {
        formData = await req.formData();
    } catch {
        return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await (file as File).arrayBuffer());

    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(buffer);
    } catch {
        return NextResponse.json({ error: "Could not read ZIP file. Make sure it is a valid Overleaf project export." }, { status: 422 });
    }

    // Find main.tex — look for an exact match first, then any top-level .tex file.
    const allFiles = Object.keys(zip.files).filter(f => !zip.files[f].dir);
    const mainEntry =
        zip.files["main.tex"] ||
        allFiles.map(f => zip.files[f]).find(f => f.name.endsWith("main.tex")) ||
        allFiles.map(f => zip.files[f]).find(f => f.name.endsWith(".tex"));

    if (!mainEntry) {
        return NextResponse.json({ error: "No .tex file found in the ZIP." }, { status: 422 });
    }

    const mainTex = await mainEntry.async("string");
    const preamble = extractPreamble(mainTex);

    if (preamble.length < 20) {
        return NextResponse.json({ error: "Could not extract a valid preamble from main.tex." }, { status: 422 });
    }

    // Return the list of files for client-side info display
    const texFiles = allFiles.filter(f => f.endsWith(".tex")).map(f => f.split("/").pop()!);

    return NextResponse.json({
        preamble,
        mainFile: mainEntry.name,
        filesFound: texFiles,
        preambleLength: preamble.length,
    });
}
