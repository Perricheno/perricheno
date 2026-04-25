import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getSpace, getSpaceFilesWithContent, getUserRoleInSpace } from '@/lib/space-db';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Allow owners/editors/viewers - read is fine
    const role = await getUserRoleInSpace(id, userId);
    if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const space = await getSpace(id, userId);
    if (!space) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const files = await getSpaceFilesWithContent(id);
    const zip = new JSZip();

    for (const file of files) {
        if (file.content_b64) {
            zip.file(file.path, Buffer.from(file.content_b64, 'base64'));
        } else if (file.content != null) {
            zip.file(file.path, file.content);
        }
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const slug = space.title.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 40);

    return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${slug}.zip"`,
        },
    });
}
