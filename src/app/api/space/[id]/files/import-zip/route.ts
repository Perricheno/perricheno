import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getUserRoleInSpace, upsertSpaceFile, upsertSpaceFileBinary } from '@/lib/space-db';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

const MAX_ZIP_SIZE  = 20 * 1024 * 1024; // 20 MB
const MAX_FILE_SIZE =  5 * 1024 * 1024; //  5 MB per extracted file

const TEXT_EXTS = new Set([
    'tex', 'bib', 'txt', 'md', 'cls', 'sty', 'cfg', 'bst', 'inp', 'def',
    'dtx', 'ins', 'ist', 'lua', 'py', 'js', 'ts', 'json', 'xml', 'yaml', 'yml',
    'csv', 'aux', 'log', 'out', 'toc', 'lof', 'lot', 'bbl', 'blg', 'idx', 'ind',
]);

function isBinaryBuffer(buf: Buffer): boolean {
    return buf.slice(0, 8000).includes(0); // null byte → binary
}

function mimeFor(ext: string): string {
    const map: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf',
        eps: 'application/postscript', ttf: 'font/ttf', otf: 'font/otf',
    };
    return map[ext] ?? 'application/octet-stream';
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const role = await getUserRoleInSpace(id, userId);
    if (!role || role === 'viewer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let form: FormData;
    try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Invalid form data' }, { status: 400 }); }

    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
    if (file.size > MAX_ZIP_SIZE) return NextResponse.json({ error: 'ZIP too large (max 20 MB)' }, { status: 413 });

    const zipBuf = Buffer.from(await file.arrayBuffer());
    let zip: JSZip;
    try { zip = await JSZip.loadAsync(zipBuf); } catch {
        return NextResponse.json({ error: 'Invalid ZIP file' }, { status: 400 });
    }

    // Detect single common root folder (Overleaf exports wrap everything in one dir)
    const allFilePaths = Object.keys(zip.files).filter(p =>
        !zip.files[p].dir && !p.startsWith('__MACOSX/') && !p.includes('/.')
    );
    const roots = new Set(allFilePaths.map(p => p.split('/')[0]));
    const rootPrefix = roots.size === 1 && allFilePaths.some(p => p.includes('/'))
        ? [...roots][0] + '/'
        : '';

    const imported: string[] = [];
    const skipped: string[]  = [];

    for (const zipPath of allFilePaths) {
        const storedPath = rootPrefix && zipPath.startsWith(rootPrefix)
            ? zipPath.slice(rootPrefix.length)
            : zipPath;
        if (!storedPath) continue;

        const entry = zip.files[zipPath];
        const buf = Buffer.from(await entry.async('arraybuffer'));
        if (buf.byteLength > MAX_FILE_SIZE) { skipped.push(storedPath); continue; }

        const ext = storedPath.split('.').pop()?.toLowerCase() ?? '';
        const isText = TEXT_EXTS.has(ext) && !isBinaryBuffer(buf);

        if (isText) {
            await upsertSpaceFile(id, storedPath, buf.toString('utf8'), 'text/plain');
        } else {
            await upsertSpaceFileBinary(id, storedPath, buf.toString('base64'), mimeFor(ext));
        }
        imported.push(storedPath);
    }

    return NextResponse.json({ ok: true, imported, skipped }, { status: 200 });
}
