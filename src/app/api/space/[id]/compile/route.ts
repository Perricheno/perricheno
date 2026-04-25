import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSpace, getSpaceFilesWithContent, getUserRoleInSpace, updateSpace } from '@/lib/space-db';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const COMPILER_URL = process.env.LATEX_COMPILER_URL;
const COMPILER_KEY = process.env.LATEX_COMPILER_KEY;

// Compiler header map - extend when the compile service supports it
const COMPILER_HEADER: Record<string, string> = {
    pdflatex: 'pdflatex',
    xelatex:  'xelatex',
    lualatex: 'lualatex',
};

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const space = await getSpace(id, userId);
    if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!COMPILER_URL || !COMPILER_KEY) {
        return NextResponse.json({ error: 'Compiler not configured' }, { status: 503 });
    }

    const files = await getSpaceFilesWithContent(id);
    if (files.length === 0) return NextResponse.json({ error: 'No files to compile' }, { status: 400 });

    // Build ZIP
    const zip = new JSZip();
    for (const f of files) {
        if (f.content != null) {
            zip.file(f.path, f.content);
        } else if (f.content_b64 != null) {
            zip.file(f.path, f.content_b64, { base64: true });
        }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const form = new FormData();
    form.append('file', zipBlob, 'project.zip');

    const headers: Record<string, string> = {
        'x-api-key': COMPILER_KEY,
    };
    const compilerEngine = COMPILER_HEADER[space.compiler] ?? 'pdflatex';
    if (compilerEngine !== 'pdflatex') headers['X-Compiler'] = compilerEngine;
    // Signal which file is the entry point
    headers['X-Main-File'] = space.main_file;

    const res = await fetch(COMPILER_URL, {
        method: 'POST',
        headers,
        body: form,
        signal: AbortSignal.timeout(110_000),
    });

    const ct = res.headers.get('content-type') ?? '';

    // Success → stream PDF back
    if (res.ok && !ct.includes('json') && !ct.includes('text')) {
        const pdfBuffer = await res.arrayBuffer();
        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${space.title}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    }

    // Failure → return log
    const text = await res.text();
    let log = text;
    try {
        const j = JSON.parse(text);
        log = j.error || j.detail || j.log || text;
    } catch {}

    return NextResponse.json({ ok: false, log: String(log).slice(0, 12_000) }, { status: 200 });
}
