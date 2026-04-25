import 'server-only';
import { supabase } from '@/lib/supabase';

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
    added_at:   string;
    updated_at: string;
}

export interface CitationCollection {
    id:          string;
    user_id:     number;
    name:        string;
    description: string | null;
    color:       string | null;
    created_at:  string;
    item_count?: number;   // joined aggregate
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
    let q = supabase
        .from('citations')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false })
        .limit(opts?.limit ?? 500);

    if (opts?.starred) q = q.eq('starred', true);
    if (opts?.tag)     q = q.contains('tags', [opts.tag]);
    if (opts?.search) {
        // Case-insensitive search across title / authors / venue / cite_key
        const s = opts.search.replace(/%/g, '').trim();
        if (s) q = q.or(`title.ilike.%${s}%,venue.ilike.%${s}%,cite_key.ilike.%${s}%`);
    }

    if (opts?.collectionId) {
        // Restrict to a specific collection via inner join
        const { data: items } = await supabase
            .from('citation_collection_items')
            .select('citation_id')
            .eq('collection_id', opts.collectionId);
        const ids = (items ?? []).map(i => i.citation_id);
        if (ids.length === 0) return [];
        q = q.in('id', ids);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as Citation[];
}

export async function getCitation(userId: number, id: string): Promise<Citation | null> {
    const { data, error } = await supabase
        .from('citations')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Citation | null;
}

export async function createCitation(userId: number, c: NewCitation): Promise<Citation> {
    // Ensure cite_key is unique for this user - append -2, -3… if collision
    const citeKey = await ensureUniqueCiteKey(userId, c.cite_key);
    const payload = { ...c, user_id: userId, cite_key: citeKey };

    const { data, error } = await supabase
        .from('citations')
        .insert(payload)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data as Citation;
}

export async function updateCitation(
    userId: number, id: string, patch: Partial<NewCitation>
): Promise<Citation | null> {
    const { data, error } = await supabase
        .from('citations')
        .update(patch)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data as Citation | null;
}

export async function deleteCitation(userId: number, id: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('citations')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id');
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
}

async function ensureUniqueCiteKey(userId: number, base: string): Promise<string> {
    const { data } = await supabase
        .from('citations')
        .select('cite_key')
        .eq('user_id', userId)
        .like('cite_key', `${base}%`);

    const taken = new Set((data ?? []).map(r => r.cite_key));
    if (!taken.has(base)) return base;
    for (let i = 2; i < 1000; i++) {
        const candidate = `${base}-${i}`;
        if (!taken.has(candidate)) return candidate;
    }
    return `${base}-${Date.now()}`;
}

// ── Collections CRUD ───────────────────────────────────────────────────────

export async function listCollections(userId: number): Promise<CitationCollection[]> {
    const { data, error } = await supabase
        .from('citation_collections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CitationCollection[];
}

export async function createCollection(userId: number, name: string, color?: string): Promise<CitationCollection> {
    const { data, error } = await supabase
        .from('citation_collections')
        .insert({ user_id: userId, name, color: color ?? null })
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data as CitationCollection;
}

export async function deleteCollection(userId: number, id: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('citation_collections')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id');
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
}

export async function addCitationToCollection(userId: number, collectionId: string, citationId: string): Promise<void> {
    // Guard: both rows belong to the user
    const [col, cit] = await Promise.all([
        supabase.from('citation_collections').select('id').eq('id', collectionId).eq('user_id', userId).maybeSingle(),
        supabase.from('citations').select('id').eq('id', citationId).eq('user_id', userId).maybeSingle(),
    ]);
    if (!col.data || !cit.data) throw new Error('Not found');

    await supabase
        .from('citation_collection_items')
        .upsert({ collection_id: collectionId, citation_id: citationId }, { onConflict: 'collection_id,citation_id' });
}

export async function removeCitationFromCollection(userId: number, collectionId: string, citationId: string): Promise<void> {
    // Ownership check via collection
    const { data: col } = await supabase
        .from('citation_collections')
        .select('id').eq('id', collectionId).eq('user_id', userId).maybeSingle();
    if (!col) return;

    await supabase
        .from('citation_collection_items')
        .delete()
        .eq('collection_id', collectionId)
        .eq('citation_id', citationId);
}
