import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// ── Types ──────────────────────────────────────────────────────────────────

export type Compiler = 'pdflatex' | 'xelatex' | 'lualatex';
export type CollaboratorRole = 'owner' | 'editor' | 'viewer';

export interface Space {
    id: string;
    owner_id: number;
    title: string;
    description: string | null;
    compiler: Compiler;
    main_file: string;
    auto_compile: boolean;
    share_id: string | null;
    is_public: boolean;
    created_at: string;
    updated_at: string;
    // joined from collaborators (when listing)
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
    created_at: string;
    updated_at: string;
}

export interface SpaceVersion {
    id: string;
    space_id: string;
    created_by: number | null;
    label: string;
    message: string | null;
    snapshot: Record<string, string>;   // { "path": "content" }
    created_at: string;
}

export interface SpaceCollaborator {
    id: string;
    space_id: string;
    user_id: number;
    role: CollaboratorRole;
    invited_at: string;
    accepted_at: string | null;
    // joined
    username?: string | null;
    first_name?: string | null;
    photo_url?: string | null;
}

export interface SpaceInvite {
    id: string;
    space_id: string;
    email: string;
    role: CollaboratorRole;
    token: string;
    created_at: string;
    expires_at: string;
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
    const { data: space, error } = await supabase
        .from('spaces')
        .insert({ owner_id: ownerId, title, compiler })
        .select('*')
        .single();

    if (error || !space) throw new Error(error?.message ?? 'Failed to create space');

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
        await supabase.from('space_files').insert(fileRows);
    }

    // Owner as collaborator
    await supabase.from('space_collaborators').insert({
        space_id: space.id,
        user_id: ownerId,
        role: 'owner',
        accepted_at: new Date().toISOString(),
    });

    return space as Space;
}

export async function getSpacesByUser(userId: number): Promise<Space[]> {
    const { data } = await supabase
        .from('spaces')
        .select(`*, space_collaborators(user_id, role)`)
        .or(`owner_id.eq.${userId},space_collaborators.user_id.eq.${userId}`)
        .order('updated_at', { ascending: false });
    return (data ?? []) as Space[];
}

export async function getSpace(id: string, userId: number): Promise<Space | null> {
    const { data } = await supabase
        .from('spaces')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (!data) return null;
    // Check access
    if (data.owner_id !== userId) {
        const { data: collab } = await supabase
            .from('space_collaborators')
            .select('role')
            .eq('space_id', id)
            .eq('user_id', userId)
            .maybeSingle();
        if (!collab) return null;
    }
    return data as Space;
}

export async function getSpaceByShareId(shareId: string): Promise<Space | null> {
    const { data } = await supabase
        .from('spaces')
        .select('*')
        .eq('share_id', shareId)
        .eq('is_public', true)
        .maybeSingle();
    return (data as Space) ?? null;
}

export async function updateSpace(id: string, userId: number, patch: Partial<Pick<Space, 'title' | 'description' | 'compiler' | 'main_file' | 'auto_compile' | 'is_public'>>): Promise<void> {
    await supabase
        .from('spaces')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('owner_id', userId);
}

export async function touchSpace(id: string): Promise<void> {
    await supabase.from('spaces').update({ updated_at: new Date().toISOString() }).eq('id', id);
}

export async function deleteSpace(id: string, userId: number): Promise<void> {
    await supabase.from('spaces').delete().eq('id', id).eq('owner_id', userId);
}

export async function duplicateSpace(id: string, userId: number): Promise<Space | null> {
    const original = await getSpace(id, userId);
    if (!original) return null;
    const files = await getSpaceFilesWithContent(id);
    const newSpace = await supabase
        .from('spaces')
        .insert({ owner_id: userId, title: `${original.title} (copy)`, compiler: original.compiler, main_file: original.main_file })
        .select('*')
        .single();
    if (!newSpace.data) return null;
    if (files.length > 0) {
        await supabase.from('space_files').insert(
            files.map(f => ({ space_id: newSpace.data.id, path: f.path, content: f.content, content_b64: f.content_b64, mime_type: f.mime_type, size_bytes: f.size_bytes }))
        );
    }
    await supabase.from('space_collaborators').insert({ space_id: newSpace.data.id, user_id: userId, role: 'owner', accepted_at: new Date().toISOString() });
    return newSpace.data as Space;
}

export async function enableSpaceSharing(id: string, userId: number): Promise<string> {
    const shareId = uuidv4().replace(/-/g, '').slice(0, 12);
    await supabase.from('spaces').update({ share_id: shareId, is_public: true }).eq('id', id).eq('owner_id', userId);
    return shareId;
}

export async function disableSpaceSharing(id: string, userId: number): Promise<void> {
    await supabase.from('spaces').update({ is_public: false }).eq('id', id).eq('owner_id', userId);
}

// ── Files ──────────────────────────────────────────────────────────────────

export async function getSpaceFiles(spaceId: string): Promise<SpaceFile[]> {
    const { data } = await supabase
        .from('space_files')
        .select('id, space_id, path, is_binary, mime_type, size_bytes, created_at, updated_at')
        .eq('space_id', spaceId)
        .order('path');
    return (data ?? []) as SpaceFile[];
}

export async function getSpaceFilesWithContent(spaceId: string): Promise<SpaceFile[]> {
    const { data } = await supabase
        .from('space_files')
        .select('*')
        .eq('space_id', spaceId)
        .order('path');
    return (data ?? []) as SpaceFile[];
}

export async function getSpaceFile(spaceId: string, path: string): Promise<SpaceFile | null> {
    const { data } = await supabase
        .from('space_files')
        .select('*')
        .eq('space_id', spaceId)
        .eq('path', path)
        .maybeSingle();
    return (data as SpaceFile) ?? null;
}

export async function upsertSpaceFile(spaceId: string, path: string, content: string, mimeType = 'text/plain'): Promise<void> {
    const sizeBytes = Buffer.byteLength(content, 'utf8');
    await supabase.from('space_files').upsert(
        { space_id: spaceId, path, content, mime_type: mimeType, size_bytes: sizeBytes, updated_at: new Date().toISOString() },
        { onConflict: 'space_id,path' }
    );
    await touchSpace(spaceId);
}

export async function upsertSpaceFileBinary(spaceId: string, path: string, contentB64: string, mimeType: string): Promise<void> {
    const sizeBytes = Math.round(contentB64.length * 0.75);
    await supabase.from('space_files').upsert(
        { space_id: spaceId, path, content: null, content_b64: contentB64, is_binary: true, mime_type: mimeType, size_bytes: sizeBytes, updated_at: new Date().toISOString() },
        { onConflict: 'space_id,path' }
    );
    await touchSpace(spaceId);
}

export async function deleteSpaceFile(spaceId: string, path: string): Promise<void> {
    await supabase.from('space_files').delete().eq('space_id', spaceId).eq('path', path);
    await touchSpace(spaceId);
}

export async function renameSpaceFile(spaceId: string, oldPath: string, newPath: string): Promise<void> {
    await supabase.from('space_files').update({ path: newPath, updated_at: new Date().toISOString() }).eq('space_id', spaceId).eq('path', oldPath);
    // Update \input / \include references in all .tex files
    const texFiles = (await getSpaceFilesWithContent(spaceId)).filter(f => f.path.endsWith('.tex') && f.content);
    const oldBase = oldPath.replace(/\.tex$/, '');
    const newBase = newPath.replace(/\.tex$/, '');
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
        if (f.content != null) snapshot[f.path] = f.content;
    }
    const { data, error } = await supabase
        .from('space_versions')
        .insert({ space_id: spaceId, created_by: userId, label, message: message ?? null, snapshot })
        .select('*')
        .single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to create version');
    return data as SpaceVersion;
}

export async function getSpaceVersions(spaceId: string): Promise<Omit<SpaceVersion, 'snapshot'>[]> {
    const { data } = await supabase
        .from('space_versions')
        .select('id, space_id, created_by, label, message, created_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(100);
    return (data ?? []) as Omit<SpaceVersion, 'snapshot'>[];
}

export async function getSpaceVersion(id: string): Promise<SpaceVersion | null> {
    const { data } = await supabase.from('space_versions').select('*').eq('id', id).maybeSingle();
    return (data as SpaceVersion) ?? null;
}

export async function restoreSpaceVersion(versionId: string, spaceId: string, userId: number): Promise<void> {
    const version = await getSpaceVersion(versionId);
    if (!version || version.space_id !== spaceId) throw new Error('Version not found');
    // Save current state as a version first
    await createSpaceVersion(spaceId, userId, `Before restore to "${version.label}"`);
    // Restore files from snapshot
    for (const [path, content] of Object.entries(version.snapshot)) {
        await upsertSpaceFile(spaceId, path, content);
    }
}

// ── Collaborators ──────────────────────────────────────────────────────────

export async function getSpaceCollaborators(spaceId: string): Promise<SpaceCollaborator[]> {
    const { data } = await supabase
        .from('space_collaborators')
        .select('*, users(username, first_name, photo_url)')
        .eq('space_id', spaceId);
    return ((data ?? []) as any[]).map(row => ({
        ...row,
        username: row.users?.username ?? null,
        first_name: row.users?.first_name ?? null,
        photo_url: row.users?.photo_url ?? null,
        users: undefined,
    })) as SpaceCollaborator[];
}

export async function addCollaborator(spaceId: string, userId: number, role: CollaboratorRole = 'editor'): Promise<void> {
    await supabase.from('space_collaborators').upsert(
        { space_id: spaceId, user_id: userId, role, accepted_at: new Date().toISOString() },
        { onConflict: 'space_id,user_id' }
    );
}

export async function removeCollaborator(spaceId: string, userId: number): Promise<void> {
    await supabase.from('space_collaborators').delete().eq('space_id', spaceId).eq('user_id', userId);
}

export async function getUserRoleInSpace(spaceId: string, userId: number): Promise<CollaboratorRole | null> {
    const { data } = await supabase
        .from('space_collaborators')
        .select('role')
        .eq('space_id', spaceId)
        .eq('user_id', userId)
        .maybeSingle();
    return (data?.role as CollaboratorRole) ?? null;
}

export async function createSpaceInvite(spaceId: string, email: string, role: CollaboratorRole = 'editor'): Promise<SpaceInvite> {
    const token = uuidv4();
    const { data, error } = await supabase
        .from('space_invites')
        .insert({ space_id: spaceId, email, role, token })
        .select('*')
        .single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to create invite');
    return data as SpaceInvite;
}

export async function getSpaceInviteByToken(token: string): Promise<SpaceInvite | null> {
    const { data } = await supabase
        .from('space_invites')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
    return (data as SpaceInvite) ?? null;
}

export async function acceptSpaceInvite(token: string, userId: number): Promise<{ spaceId: string } | null> {
    const invite = await getSpaceInviteByToken(token);
    if (!invite) return null;

    // Add as collaborator (upsert in case already exists)
    await supabase.from('space_collaborators').upsert(
        { space_id: invite.space_id, user_id: userId, role: invite.role, accepted_at: new Date().toISOString() },
        { onConflict: 'space_id,user_id' }
    );

    // Mark invite as accepted (delete it)
    await supabase.from('space_invites').delete().eq('token', token);

    return { spaceId: invite.space_id };
}
