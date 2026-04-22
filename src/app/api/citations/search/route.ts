import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface CrossRefItem {
    DOI: string;
    title?: string[];
    author?: { given?: string; family?: string }[];
    'container-title'?: string[];
    published?: { 'date-parts'?: number[][] };
    'published-print'?: { 'date-parts'?: number[][] };
    abstract?: string;
    URL?: string;
    type?: string;
}

function crossrefToBibtex(item: CrossRefItem): { bibtex: string; citeKey: string } {
    const authors = (item.author ?? [])
        .map(a => `${a.family ?? ''}, ${a.given ?? ''}`.trim())
        .filter(Boolean);
    const title = item.title?.[0] ?? 'Untitled';
    const year = item.published?.['date-parts']?.[0]?.[0]
        ?? item['published-print']?.['date-parts']?.[0]?.[0]
        ?? new Date().getFullYear();
    const venue = item['container-title']?.[0] ?? '';
    const doi = item.DOI ?? '';

    // Generate cite key: firstAuthorLastName + year
    const firstAuthor = item.author?.[0]?.family ?? 'unknown';
    const citeKey = `${firstAuthor.toLowerCase().replace(/[^a-z]/g, '')}${year}`;

    const entryType = item.type === 'book' ? 'book'
        : item.type === 'proceedings-article' ? 'inproceedings'
        : 'article';

    const bibtex = `@${entryType}{${citeKey},
  title     = {${title}},
  author    = {${authors.join(' and ')}},
  year      = {${year}},
  journal   = {${venue}},
  doi       = {${doi}},
  url       = {${item.URL ?? `https://doi.org/${doi}`}}
}`;

    return { bibtex, citeKey };
}

// Search CrossRef
async function searchCrossRef(query: string, limit = 10) {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&select=DOI,title,author,container-title,published,published-print,abstract,URL,type`;

    const res = await fetch(url, {
        headers: { 'User-Agent': 'Perricheno/1.0 (mailto:support@perricheno.ru)' },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`CrossRef API error: ${res.status}`);

    const data = await res.json();
    const items: CrossRefItem[] = data.message?.items ?? [];

    return items.map(item => {
        const { bibtex, citeKey } = crossrefToBibtex(item);
        const year = item.published?.['date-parts']?.[0]?.[0]
            ?? item['published-print']?.['date-parts']?.[0]?.[0]
            ?? null;

        return {
            source: 'crossref' as const,
            doi: item.DOI,
            arxiv_id: null,
            title: item.title?.[0] ?? 'Untitled',
            authors: (item.author ?? []).map(a => `${a.given ?? ''} ${a.family ?? ''}`.trim()),
            year,
            venue: item['container-title']?.[0] ?? null,
            abstract: item.abstract?.replace(/<[^>]*>/g, '') ?? null,
            url: item.URL ?? `https://doi.org/${item.DOI}`,
            bibtex,
            cite_key: citeKey,
        };
    });
}

// Resolve DOI directly
async function resolveDOI(doi: string) {
    // Clean DOI
    const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();

    const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Perricheno/1.0 (mailto:support@perricheno.ru)' },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`DOI not found: ${cleanDoi}`);

    const data = await res.json();
    const item: CrossRefItem = data.message;
    const { bibtex, citeKey } = crossrefToBibtex(item);
    const year = item.published?.['date-parts']?.[0]?.[0]
        ?? item['published-print']?.['date-parts']?.[0]?.[0]
        ?? null;

    return [{
        source: 'doi' as const,
        doi: item.DOI,
        arxiv_id: null,
        title: item.title?.[0] ?? 'Untitled',
        authors: (item.author ?? []).map(a => `${a.given ?? ''} ${a.family ?? ''}`.trim()),
        year,
        venue: item['container-title']?.[0] ?? null,
        abstract: item.abstract?.replace(/<[^>]*>/g, '') ?? null,
        url: item.URL ?? `https://doi.org/${item.DOI}`,
        bibtex,
        cite_key: citeKey,
    }];
}

// Search arXiv
async function searchArXiv(query: string, limit = 10) {
    const isId = /^\d{4}\.\d{4,5}(v\d+)?$/.test(query.trim());
    const url = isId
        ? `https://export.arxiv.org/api/query?id_list=${query.trim()}&max_results=1`
        : `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`arXiv API error: ${res.status}`);

    const xml = await res.text();

    // Simple XML parsing for arXiv Atom feed
    const entries: any[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
        const entry = match[1];
        const getTag = (tag: string) => {
            const m = entry.match(new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 's'));
            return m ? m[1].trim() : null;
        };
        const getAll = (tag: string, attr?: string) => {
            const results: string[] = [];
            const r = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'gs');
            let m2;
            while ((m2 = r.exec(entry)) !== null) results.push(m2[1].trim());
            return results;
        };

        const id = getTag('id') ?? '';
        const arxivId = id.replace('http://arxiv.org/abs/', '').replace(/v\d+$/, '');
        const title = (getTag('title') ?? 'Untitled').replace(/\s+/g, ' ');
        const summary = (getTag('summary') ?? '').replace(/\s+/g, ' ');
        const published = getTag('published') ?? '';
        const year = published ? parseInt(published.slice(0, 4)) : null;

        // Authors
        const authorRegex = /<author>\s*<name>(.*?)<\/name>/g;
        const authors: string[] = [];
        let am;
        while ((am = authorRegex.exec(entry)) !== null) authors.push(am[1].trim());

        // Generate cite key
        const firstAuthor = authors[0]?.split(' ').pop() ?? 'unknown';
        const citeKey = `${firstAuthor.toLowerCase().replace(/[^a-z]/g, '')}${year ?? ''}`;

        // DOI link
        const doiMatch = entry.match(/<link[^>]*href="(https?:\/\/dx\.doi\.org\/[^"]+)"/);
        const doi = doiMatch ? doiMatch[1].replace('http://dx.doi.org/', '').replace('https://dx.doi.org/', '') : null;

        const bibtex = `@article{${citeKey},
  title     = {${title}},
  author    = {${authors.join(' and ')}},
  year      = {${year ?? ''}},
  eprint    = {${arxivId}},
  archivePrefix = {arXiv},
  primaryClass  = {},
  url       = {https://arxiv.org/abs/${arxivId}}${doi ? `,\n  doi       = {${doi}}` : ''}
}`;

        entries.push({
            source: 'arxiv' as const,
            doi: doi ?? null,
            arxiv_id: arxivId,
            title,
            authors,
            year,
            venue: 'arXiv preprint',
            abstract: summary || null,
            url: `https://arxiv.org/abs/${arxivId}`,
            bibtex,
            cite_key: citeKey,
        });
    }

    return entries;
}

export async function GET(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const query = url.searchParams.get('q')?.trim();
    const source = url.searchParams.get('source') ?? 'auto'; // auto | crossref | arxiv | doi

    if (!query) {
        return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    try {
        let results: any[] = [];

        // Auto-detect source
        if (source === 'auto') {
            const isDOI = /^10\.\d{4,}\//.test(query) || /^https?:\/\/(dx\.)?doi\.org\//.test(query);
            const isArXivId = /^\d{4}\.\d{4,5}(v\d+)?$/.test(query);

            if (isDOI) {
                results = await resolveDOI(query);
            } else if (isArXivId) {
                results = await searchArXiv(query, 1);
            } else {
                // Search both in parallel
                const [crossrefResults, arxivResults] = await Promise.allSettled([
                    searchCrossRef(query, 8),
                    searchArXiv(query, 5),
                ]);

                if (crossrefResults.status === 'fulfilled') results.push(...crossrefResults.value);
                if (arxivResults.status === 'fulfilled') results.push(...arxivResults.value);
            }
        } else if (source === 'doi') {
            results = await resolveDOI(query);
        } else if (source === 'crossref') {
            results = await searchCrossRef(query);
        } else if (source === 'arxiv') {
            results = await searchArXiv(query);
        }

        return NextResponse.json({ results });
    } catch (e: any) {
        console.error('[citations/search]', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
