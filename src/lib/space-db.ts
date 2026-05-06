import 'server-only';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// ── Types ──────────────────────────────────────────────────────────────────

export type Compiler = 'pdflatex' | 'xelatex' | 'lualatex';
export type CollaboratorRole = 'owner' | 'editor' | 'viewer';

export interface Space {
    id: string;
    owner_id: number;
    title: string;
    description: string | null;
    compiler: string;
    main_file: string;
    auto_compile: boolean;
    share_id: string | null;
    is_public: boolean;
    created_at: Date;
    updated_at: Date;
    collaborators?: SpaceCollaborator[];
}

export interface SpaceFile {
    id: string;
    space_id: string;
    path: string;
    content?: string | null;
    content_b64?: string | null;
    is_binary: boolean;
    mime_type: string;
    size_bytes: number;
    created_at: Date;
    updated_at: Date;
}

export interface SpaceVersion {
    id: string;
    space_id: string;
    created_by: number | null;
    label: string;
    message: string | null;
    snapshot: Record<string, string>;   // { "path": "content" }
    created_at: Date;
}

export interface SpaceCollaborator {
    id: string;
    space_id: string;
    user_id: number;
    role: string;
    invited_at: Date;
    accepted_at: Date | null;
    username?: string | null;
    first_name?: string | null;
    photo_url?: string | null;
}

export interface SpaceInvite {
    id: string;
    space_id: string;
    email?: string | null;
    role: string;
    token: string;
    created_at: Date;
    expires_at: Date;
}

// Starter templates
const STARTER_TEMPLATES: Record<string, Record<string, string>> = {
    blank: {
        'main.tex': `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Untitled}
\\author{Author}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Start writing here.

\\end{document}
`,
    },
    research: {
        'main.tex': `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{graphicx}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage[style=apa,backend=biber]{biblatex}
\\addbibresource{references.bib}
\\geometry{margin=1in}

\\title{Research Paper Title}
\\author{Author Name \\\\ Institution}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Write your abstract here.
\\end{abstract}

\\section{Introduction}

\\section{Background}

\\section{Methodology}

\\section{Results}

\\section{Discussion}

\\section{Conclusion}

\\printbibliography
\\end{document}
`,
        'references.bib': `@article{example2024,
  author  = {Last, First},
  title   = {Example Title},
  journal = {Journal Name},
  year    = {2024},
  volume  = {1},
  pages   = {1--10},
}
`,
    },
    thesis: {
        'main.tex': `\\documentclass[12pt,a4paper]{report}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{graphicx}
\\usepackage{geometry}
\\usepackage{hyperref}
\\usepackage{setspace}
\\usepackage[style=apa,backend=biber]{biblatex}
\\addbibresource{references.bib}
\\geometry{margin=1in}
\\doublespacing

\\title{Thesis Title}
\\author{Student Name}
\\date{\\today}

\\begin{document}
\\maketitle
\\tableofcontents
\\listoffigures
\\listoftables

\\chapter{Introduction}

\\chapter{Literature Review}

\\chapter{Methodology}

\\chapter{Results}

\\chapter{Discussion}

\\chapter{Conclusion}

\\printbibliography
\\end{document}
`,
        'references.bib': '',
    },
    beamer: {
        'main.tex': `\\documentclass{beamer}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\usetheme{Madrid}
\\usecolortheme{default}

\\title{Presentation Title}
\\author{Author Name}
\\institute{Institution}
\\date{\\today}

\\begin{document}

\\begin{frame}
\\titlepage
\\end{frame}

\\begin{frame}{Outline}
\\tableofcontents
\\end{frame}

\\section{Introduction}
\\begin{frame}{Introduction}
\\begin{itemize}
  \\item Point one
  \\item Point two
  \\item Point three
\\end{itemize}
\\end{frame}

\\section{Conclusion}
\\begin{frame}{Conclusion}
Thank you!
\\end{frame}

\\end{document}
`,
    },
};

// ── Spaces ─────────────────────────────────────────────────────────────────

export async function createSpace(
    ownerId: number,
    title: string,
    template: keyof typeof STARTER_TEMPLATES = 'blank',
    compiler: Compiler = 'pdflatex',
): Promise<Space> {
    const space = await prisma.space.create({
        data: {
            owner_id: ownerId,
            title,
            compiler
        }
    });

    // Seed files from template
    const files = STARTER_TEMPLATES[template] ?? STARTER_TEMPLATES.blank;
    const fileRows = Object.entries(files).map(([path, content]) => ({
        space_id: space.id,
        path,
        content,
        mime_type: 'text/plain',
        size_bytes: Buffer.byteLength(content, 'utf8'),
    }));
    
    if (fileRows.length > 0) {
        await prisma.spaceFile.createMany({ data: fileRows });
    }

    // Owner as collaborator
    await prisma.spaceCollaborator.create({
        data: {
            space_id: space.id,
            user_id: ownerId,
            role: 'owner',
            accepted_at: new Date()
        }
    });

    return space as Space;
}

export async function getSpacesByUser(userId: number): Promise<Space[]> {
    const spaces = await prisma.space.findMany({
        where: {
            OR: [
                { owner_id: userId },
                { collaborators: { some: { user_id: userId } } }
            ]
        },
        include: { collaborators: true },
        orderBy: { updated_at: 'desc' }
    });
    return spaces as Space[];
}

export async function getSpace(id: string, userId: number): Promise<Space | null> {
    const space = await prisma.space.findUnique({
        where: { id },
        include: { collaborators: true }
    });
    if (!space) return null;
    
    // Check access
    if (space.owner_id !== userId) {
        const hasAccess = space.collaborators.some(c => c.user_id === userId);
        if (!hasAccess) return null;
    }
    return space as Space;
}

export async function getSpaceByShareId(shareId: string): Promise<Space | null> {
    return prisma.space.findFirst({
        where: { share_id: shareId, is_public: true }
    }) as Promise<Space | null>;
}

export async function updateSpace(id: string, userId: number, patch: Partial<Pick<Space, 'title' | 'description' | 'compiler' | 'main_file' | 'auto_compile' | 'is_public'>>): Promise<void> {
    await prisma.space.updateMany({
        where: { id, owner_id: userId },
        data: patch
    });
}

export async function touchSpace(id: string): Promise<void> {
    await prisma.space.update({
        where: { id },
        data: { updated_at: new Date() }
    });
}

export async function deleteSpace(id: string, userId: number): Promise<void> {
    await prisma.space.deleteMany({
        where: { id, owner_id: userId }
    });
}

export async function duplicateSpace(id: string, userId: number): Promise<Space | null> {
    const original = await getSpace(id, userId);
    if (!original) return null;
    
    const files = await getSpaceFilesWithContent(id);
    
    const newSpace = await prisma.space.create({
        data: {
            owner_id: userId,
            title: `${original.title} (copy)`,
            compiler: original.compiler,
            main_file: original.main_file
        }
    });

    if (files.length > 0) {
        await prisma.spaceFile.createMany({
            data: files.map(f => ({
                space_id: newSpace.id,
                path: f.path,
                content: f.content,
                content_b64: f.content_b64,
                mime_type: f.mime_type,
                size_bytes: f.size_bytes
            }))
        });
    }
    
    await prisma.spaceCollaborator.create({
        data: {
            space_id: newSpace.id,
            user_id: userId,
            role: 'owner',
            accepted_at: new Date()
        }
    });
    
    return newSpace as Space;
}

export async function enableSpaceSharing(id: string, userId: number): Promise<string> {
    const shareId = uuidv4().replace(/-/g, '').slice(0, 12);
    await prisma.space.updateMany({
        where: { id, owner_id: userId },
        data: { share_id: shareId, is_public: true }
    });
    return shareId;
}

export async function disableSpaceSharing(id: string, userId: number): Promise<void> {
    await prisma.space.updateMany({
        where: { id, owner_id: userId },
        data: { is_public: false }
    });
}

// ── Files ──────────────────────────────────────────────────────────────────

export async function getSpaceFiles(spaceId: string): Promise<SpaceFile[]> {
    return prisma.spaceFile.findMany({
        where: { space_id: spaceId },
        select: { id: true, space_id: true, path: true, is_binary: true, mime_type: true, size_bytes: true, created_at: true, updated_at: true },
        orderBy: { path: 'asc' }
    }) as unknown as Promise<SpaceFile[]>;
}

export async function getSpaceFilesWithContent(spaceId: string): Promise<SpaceFile[]> {
    return prisma.spaceFile.findMany({
        where: { space_id: spaceId },
        orderBy: { path: 'asc' }
    }) as Promise<SpaceFile[]>;
}

export async function getSpaceFile(spaceId: string, path: string): Promise<SpaceFile | null> {
    return prisma.spaceFile.findUnique({
        where: { space_id_path: { space_id: spaceId, path } }
    }) as Promise<SpaceFile | null>;
}

export async function upsertSpaceFile(spaceId: string, path: string, content: string, mimeType = 'text/plain'): Promise<void> {
    const sizeBytes = Buffer.byteLength(content, 'utf8');
    await prisma.spaceFile.upsert({
        where: { space_id_path: { space_id: spaceId, path } },
        update: { content, content_b64: null, is_binary: false, mime_type: mimeType, size_bytes: sizeBytes },
        create: { space_id: spaceId, path, content, mime_type: mimeType, size_bytes: sizeBytes }
    });
    await touchSpace(spaceId);
}

export async function upsertSpaceFileBinary(spaceId: string, path: string, contentB64: string, mimeType: string): Promise<void> {
    const sizeBytes = Math.round(contentB64.length * 0.75);
    await prisma.spaceFile.upsert({
        where: { space_id_path: { space_id: spaceId, path } },
        update: { content: null, content_b64: contentB64, is_binary: true, mime_type: mimeType, size_bytes: sizeBytes },
        create: { space_id: spaceId, path, content_b64: contentB64, is_binary: true, mime_type: mimeType, size_bytes: sizeBytes }
    });
    await touchSpace(spaceId);
}

export async function deleteSpaceFile(spaceId: string, path: string): Promise<void> {
    try {
        await prisma.spaceFile.delete({
            where: { space_id_path: { space_id: spaceId, path } }
        });
        await touchSpace(spaceId);
    } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025')) {
            console.error('[space-db] deleteSpaceFile unexpected error:', e);
        }
    }
}

export async function renameSpaceFile(spaceId: string, oldPath: string, newPath: string): Promise<void> {
    await prisma.spaceFile.update({
        where: { space_id_path: { space_id: spaceId, path: oldPath } },
        data: { path: newPath }
    });
    
    // Update \input / \include references in all .tex files
    const texFiles = (await getSpaceFilesWithContent(spaceId)).filter(f => f.path.endsWith('.tex') && f.content);
    const oldBase = oldPath.replace(/\\.tex$/, '');
    const newBase = newPath.replace(/\\.tex$/, '');
    
    await Promise.all(texFiles.map(async f => {
        if (!f.content) return;
        const updated = f.content
            .replace(new RegExp(`\\\\input\\{${escapeRegex(oldBase)}\\}`, 'g'), `\\input{${newBase}}`)
            .replace(new RegExp(`\\\\include\\{${escapeRegex(oldBase)}\\}`, 'g'), `\\include{${newBase}}`);
        if (updated !== f.content) await upsertSpaceFile(spaceId, f.path, updated);
    }));
    
    await touchSpace(spaceId);
}

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ── Versions ───────────────────────────────────────────────────────────────

export async function createSpaceVersion(spaceId: string, userId: number, label: string, message?: string): Promise<SpaceVersion> {
    const files = await getSpaceFilesWithContent(spaceId);
    const snapshot: Record<string, string> = {};
    for (const f of files) {
        if (f.content != null) {
            snapshot[f.path] = f.content;
        } else if (f.content_b64 != null) {
            snapshot[f.path] = `__b64__:${f.mime_type}:${f.content_b64}`;
        }
    }
    
    const version = await prisma.spaceVersion.create({
        data: {
            space_id: spaceId,
            created_by: userId,
            label,
            message: message ?? null,
            snapshot: JSON.stringify(snapshot)
        }
    });
    
    return { ...version, snapshot: JSON.parse(version.snapshot) } as SpaceVersion;
}

export async function getSpaceVersions(spaceId: string): Promise<Omit<SpaceVersion, 'snapshot'>[]> {
    const versions = await prisma.spaceVersion.findMany({
        where: { space_id: spaceId },
        select: { id: true, space_id: true, created_by: true, label: true, message: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 100
    });
    return versions as Omit<SpaceVersion, 'snapshot'>[];
}

export async function getSpaceVersion(id: string): Promise<SpaceVersion | null> {
    const version = await prisma.spaceVersion.findUnique({ where: { id } });
    if (!version) return null;
    return { ...version, snapshot: JSON.parse(version.snapshot) } as SpaceVersion;
}

export async function restoreSpaceVersion(versionId: string, spaceId: string, userId: number): Promise<void> {
    const version = await getSpaceVersion(versionId);
    if (!version || version.space_id !== spaceId) throw new Error('Version not found');
    
    await createSpaceVersion(spaceId, userId, `Before restore to "${version.label}"`);
    
    for (const [path, value] of Object.entries(version.snapshot)) {
        if (value.startsWith('__b64__:')) {
            const rest = value.slice('__b64__:'.length);
            const sep = rest.indexOf(':');
            const mime = rest.slice(0, sep);
            const b64  = rest.slice(sep + 1);
            await upsertSpaceFileBinary(spaceId, path, b64, mime);
        } else {
            await upsertSpaceFile(spaceId, path, value);
        }
    }
}

// ── Collaborators ──────────────────────────────────────────────────────────

export async function getSpaceCollaborators(spaceId: string): Promise<SpaceCollaborator[]> {
    const collabs = await prisma.spaceCollaborator.findMany({
        where: { space_id: spaceId },
        include: { user: { select: { username: true, first_name: true, photo_url: true } } }
    });
    
    return collabs.map(c => ({
        ...c,
        username: c.user?.username,
        first_name: c.user?.first_name,
        photo_url: c.user?.photo_url,
    })) as SpaceCollaborator[];
}

export async function addCollaborator(spaceId: string, userId: number, role: CollaboratorRole = 'editor'): Promise<void> {
    await prisma.spaceCollaborator.upsert({
        where: { space_id_user_id: { space_id: spaceId, user_id: userId } },
        update: { role, accepted_at: new Date() },
        create: { space_id: spaceId, user_id: userId, role, accepted_at: new Date() }
    });
}

export async function removeCollaborator(spaceId: string, userId: number): Promise<void> {
    try {
        await prisma.spaceCollaborator.delete({
            where: { space_id_user_id: { space_id: spaceId, user_id: userId } }
        });
    } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025')) {
            console.error('[space-db] removeCollaborator unexpected error:', e);
        }
    }
}

export async function getUserRoleInSpace(spaceId: string, userId: number): Promise<CollaboratorRole | null> {
    const collab = await prisma.spaceCollaborator.findUnique({
        where: { space_id_user_id: { space_id: spaceId, user_id: userId } }
    });
    return (collab?.role as CollaboratorRole) ?? null;
}

export async function createSpaceInvite(spaceId: string, role: CollaboratorRole = 'editor'): Promise<SpaceInvite> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration
    
    return prisma.spaceInvite.create({
        data: { space_id: spaceId, role, token, expires_at: expiresAt }
    }) as Promise<SpaceInvite>;
}

export async function getSpaceInviteByToken(token: string): Promise<SpaceInvite | null> {
    return prisma.spaceInvite.findFirst({
        where: { token, expires_at: { gt: new Date() } }
    }) as Promise<SpaceInvite | null>;
}

export async function acceptSpaceInvite(token: string, userId: number): Promise<{ spaceId: string } | null> {
    const invite = await getSpaceInviteByToken(token);
    if (!invite) return null;

    await prisma.$transaction([
        prisma.spaceCollaborator.upsert({
            where: { space_id_user_id: { space_id: invite.space_id, user_id: userId } },
            update: { role: invite.role, accepted_at: new Date() },
            create: { space_id: invite.space_id, user_id: userId, role: invite.role, accepted_at: new Date() }
        }),
        prisma.spaceInvite.delete({ where: { token } })
    ]);

    return { spaceId: invite.space_id };
}
