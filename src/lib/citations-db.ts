import 'server-only';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Citation {
    id:         string;
    user_id:    number;
    doi:        string | null;
    arxiv_id:   string | null;
    isbn:       string | null;
    title:      string;
    authors:    string[];
    year:       number | null;
    venue:      string | null;
    abstract:   string | null;
    url:        string | null;
    bibtex:     string;
    cite_key:   string;
    tags:       string[];
    notes:      string | null;
    starred:    boolean;
    added_at:   Date;
    updated_at: Date;
}

export interface CitationCollection {
    id:          string;
    user_id:     number;
    name:        string;
    description: string | null;
    color:       string | null;
    created_at:  Date;
    item_count?: number;   
}

export type NewCitation = Omit<Citation, 'id' | 'user_id' | 'added_at' | 'updated_at'>;

// ── Citations CRUD ─────────────────────────────────────────────────────────

export async function listCitations(userId: number, opts?: {
    search?: string;
    tag?: string;
    starred?: boolean;
    collectionId?: string | null;
    limit?: number;
}): Promise<Citation[]> {
    const where: Prisma.CitationWhereInput = { user_id: userId };

    if (opts?.starred) where.starred = true;
    if (opts?.tag) where.tags = { has: opts.tag };
    if (opts?.search) {
        const s = opts.search.replace(/%/g, '').trim();
        if (s) {
            where.OR = [
                { title: { contains: s, mode: 'insensitive' } },
                { venue: { contains: s, mode: 'insensitive' } },
                { cite_key: { contains: s, mode: 'insensitive' } },
            ];
        }
    }

    if (opts?.collectionId) {
        where.collections = {
            some: { collection_id: opts.collectionId }
        };
    }

    const citations = await prisma.citation.findMany({
        where,
        orderBy: { added_at: 'desc' },
        take: opts?.limit ?? 500
    });

    return citations as Citation[];
}

export async function getCitation(userId: number, id: string): Promise<Citation | null> {
    const citation = await prisma.citation.findUnique({
        where: { id },
    });
    if (!citation || citation.user_id !== userId) return null;
    return citation as Citation;
}

export async function createCitation(userId: number, c: NewCitation): Promise<Citation> {
    // ensureUniqueCiteKey() only checks-then-picks a key in application code, so
    // two concurrent creates with the same base key can still both pass that
    // check and race to insert. The @@unique([user_id, cite_key]) DB constraint
    // (added in Phase 5, docs/REVIEW.md) is what actually prevents the
    // duplicate - retry with a fresh candidate key on the rare P2002 collision.
    for (let attempt = 0; attempt < 3; attempt++) {
        const citeKey = await ensureUniqueCiteKey(userId, c.cite_key);
        try {
            const citation = await prisma.citation.create({
                data: {
                    ...c,
                    user_id: userId,
                    cite_key: citeKey
                }
            });
            return citation as Citation;
        } catch (e: any) {
            if (e.code !== 'P2002' || attempt === 2) throw e;
        }
    }
    throw new Error('Failed to allocate a unique cite_key after 3 attempts');
}

export class CiteKeyConflictError extends Error {}

export async function updateCitation(
    userId: number, id: string, patch: Partial<NewCitation>
): Promise<Citation | null> {
    try {
        const citation = await prisma.citation.updateMany({
            where: { id, user_id: userId },
            data: patch
        });
        if (citation.count === 0) return null;
        return getCitation(userId, id);
    } catch (e: any) {
        // Renaming cite_key to one already used by another of this user's
        // citations now hits the @@unique([user_id, cite_key]) DB constraint
        // (Phase 5, docs/REVIEW.md) instead of silently creating a duplicate -
        // surface that distinctly instead of reporting a misleading "not found".
        if (e.code === 'P2002') throw new CiteKeyConflictError('cite_key already in use');
        return null;
    }
}

export async function deleteCitation(userId: number, id: string): Promise<boolean> {
    const result = await prisma.citation.deleteMany({
        where: { id, user_id: userId }
    });
    return result.count > 0;
}

async function ensureUniqueCiteKey(userId: number, base: string): Promise<string> {
    const existingKeys = await prisma.citation.findMany({
        where: { user_id: userId, cite_key: { startsWith: base } },
        select: { cite_key: true }
    });

    const taken = new Set(existingKeys.map(r => r.cite_key));
    if (!taken.has(base)) return base;
    for (let i = 2; i < 1000; i++) {
        const candidate = `${base}-${i}`;
        if (!taken.has(candidate)) return candidate;
    }
    return `${base}-${Date.now()}`;
}

// ── Collections CRUD ───────────────────────────────────────────────────────

export async function listCollections(userId: number): Promise<CitationCollection[]> {
    const collections = await prisma.citationCollection.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { items: true } } }
    });

    return collections.map(c => ({
        ...c,
        item_count: c._count.items,
        _count: undefined
    })) as CitationCollection[];
}

export async function createCollection(userId: number, name: string, color?: string): Promise<CitationCollection> {
    const collection = await prisma.citationCollection.create({
        data: { user_id: userId, name, color: color ?? null }
    });
    return collection as CitationCollection;
}

export async function deleteCollection(userId: number, id: string): Promise<boolean> {
    const result = await prisma.citationCollection.deleteMany({
        where: { id, user_id: userId }
    });
    return result.count > 0;
}

export async function addCitationToCollection(userId: number, collectionId: string, citationId: string): Promise<void> {
    const col = await prisma.citationCollection.findFirst({ where: { id: collectionId, user_id: userId } });
    const cit = await prisma.citation.findFirst({ where: { id: citationId, user_id: userId } });
    
    if (!col || !cit) throw new Error('Not found');

    await prisma.citationCollectionItem.upsert({
        where: { collection_id_citation_id: { collection_id: collectionId, citation_id: citationId } },
        create: { collection_id: collectionId, citation_id: citationId },
        update: {}
    });
}

export async function removeCitationFromCollection(userId: number, collectionId: string, citationId: string): Promise<void> {
    const col = await prisma.citationCollection.findFirst({ where: { id: collectionId, user_id: userId } });
    if (!col) return;

    try {
        await prisma.citationCollectionItem.delete({
            where: { collection_id_citation_id: { collection_id: collectionId, citation_id: citationId } }
        });
    } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025')) {
            console.error('[citations-db] removeCitationFromCollection unexpected error:', e);
        }
    }
}
