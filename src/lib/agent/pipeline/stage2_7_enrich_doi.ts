// Stage 2.7 - DOI Enrichment
// Uses CrossRef API to fetch accurate metadata for references with DOIs.
// Fixes incomplete/incorrect author names, years, venues, and citation keys.

import type { ExtractedRef } from "./types";

interface CrossRefWork {
    title?: string[];
    author?: Array<{ given?: string; family?: string }>;
    published?: { 'date-parts'?: number[][] };
    'container-title'?: string[];
    DOI?: string;
    type?: string;
}

// CrossRef API (free, no auth required)
async function fetchCrossRefMetadata(doi: string): Promise<CrossRefWork | null> {
    try {
        const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '').trim();
        const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
        
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Perricheno/1.0 (mailto:support@perricheno.ru)',
            },
            signal: AbortSignal.timeout(10000),
        });
        
        if (!res.ok) {
            console.warn(`[DOI-Enrich] CrossRef API failed for ${doi}: ${res.status}`);
            return null;
        }
        
        const data = await res.json();
        return data.message as CrossRefWork;
    } catch (e: any) {
        console.error(`[DOI-Enrich] Error fetching ${doi}:`, e?.message);
        return null;
    }
}

function formatAuthors(authors?: Array<{ given?: string; family?: string }>): string[] {
    if (!authors || authors.length === 0) return [];
    
    return authors.map(a => {
        const family = a.family || '';
        const given = a.given || '';
        return given ? `${family}, ${given}` : family;
    }).filter(Boolean);
}

function generateBibKey(authors: string[], year?: number, title?: string): string {
    if (authors.length > 0 && year) {
        const firstAuthor = authors[0].split(',')[0].toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        return `${firstAuthor}_${year}`;
    }
    
    if (title) {
        const slug = title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 30);
        return year ? `${slug}_${year}` : slug;
    }
    
    return `ref_${Date.now()}`;
}

function generateBibTeX(work: CrossRefWork, bibKey: string): string {
    const title = work.title?.[0] || 'Untitled';
    const authors = formatAuthors(work.author);
    const year = work.published?.['date-parts']?.[0]?.[0];
    const venue = work['container-title']?.[0];
    const doi = work.DOI;
    const type = work.type;
    
    // Determine entry type
    let entryType = 'article';
    if (type === 'book' || type === 'monograph') entryType = 'book';
    else if (type === 'proceedings-article' || type === 'paper-conference') entryType = 'inproceedings';
    
    const authorStr = authors.length > 0 
        ? authors.join(' and ')
        : 'Anonymous';
    
    let bib = `@${entryType}{${bibKey},\n`;
    bib += `  title = {${title}},\n`;
    bib += `  author = {${authorStr}},\n`;
    if (year) bib += `  year = {${year}},\n`;
    if (venue) {
        if (entryType === 'article') {
            bib += `  journal = {${venue}},\n`;
        } else if (entryType === 'inproceedings') {
            bib += `  booktitle = {${venue}},\n`;
        } else {
            bib += `  publisher = {${venue}},\n`;
        }
    }
    if (doi) bib += `  doi = {${doi}},\n`;
    bib += `}`;
    
    return bib;
}

export async function runStage2_7(
    refs: ExtractedRef[],
    onProgress?: (done: number, total: number, current?: string) => void,
): Promise<{ enrichedRefs: ExtractedRef[]; enrichedCount: number }> {
    const refsWithDoi = refs.filter(r => 
        r.status === 'ok' && 
        r.metadata?.doi && 
        r.metadata.doi.length > 5
    );
    
    if (refsWithDoi.length === 0) {
        console.log('[Stage2.7] No DOIs found, skipping enrichment');
        return { enrichedRefs: refs, enrichedCount: 0 };
    }
    
    console.log(`[Stage2.7] Enriching ${refsWithDoi.length} references with DOIs`);
    
    let enrichedCount = 0;
    const enrichedRefs = [...refs];
    
    for (let i = 0; i < refsWithDoi.length; i++) {
        const ref = refsWithDoi[i];
        const doi = ref.metadata!.doi!;
        
        onProgress?.(i, refsWithDoi.length, ref.filename);
        
        try {
            const work = await fetchCrossRefMetadata(doi);
            
            if (!work) continue;
            
            // Extract enriched metadata
            const enrichedAuthors = formatAuthors(work.author);
            const enrichedYear = work.published?.['date-parts']?.[0]?.[0];
            const enrichedTitle = work.title?.[0];
            const enrichedVenue = work['container-title']?.[0];
            
            // Only enrich if we got better data
            const shouldEnrich = 
                (enrichedAuthors.length > 0 && (!ref.metadata?.authors || ref.metadata.authors.length === 0)) ||
                (enrichedYear && !ref.metadata?.year) ||
                (enrichedTitle && (!ref.metadata?.title || ref.metadata.title.includes('Untitled'))) ||
                (enrichedVenue && !ref.metadata?.venue);
            
            if (shouldEnrich) {
                // Generate new citation key
                const newBibKey = generateBibKey(
                    enrichedAuthors.length > 0 ? enrichedAuthors : ref.metadata?.authors || [],
                    enrichedYear || ref.metadata?.year,
                    enrichedTitle || ref.metadata?.title
                );
                
                // Generate new BibTeX
                const newBibTeX = generateBibTeX(work, newBibKey);
                
                // Find and update the ref in enrichedRefs
                const refIndex = enrichedRefs.findIndex(r => r.uploadId === ref.uploadId);
                if (refIndex !== -1) {
                    enrichedRefs[refIndex] = {
                        ...enrichedRefs[refIndex],
                        bibKey: newBibKey,
                        metadata: {
                            title: enrichedTitle || ref.metadata?.title,
                            authors: enrichedAuthors.length > 0 ? enrichedAuthors : ref.metadata?.authors,
                            year: enrichedYear || ref.metadata?.year,
                            venue: enrichedVenue || ref.metadata?.venue,
                            doi: doi,
                        },
                        bibEntry: newBibTeX,
                    };
                    
                    enrichedCount++;
                    console.log(`[Stage2.7] ✓ Enriched ${ref.filename}: ${newBibKey}`);
                }
            }
            
            // Rate limiting: 50 requests per second max for CrossRef
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (e: any) {
            console.error(`[Stage2.7] Failed to enrich ${ref.filename}:`, e?.message);
        }
    }
    
    onProgress?.(refsWithDoi.length, refsWithDoi.length, 'Complete');
    
    console.log(`[Stage2.7] Enrichment complete: ${enrichedCount}/${refsWithDoi.length} references improved`);
    
    return { enrichedRefs, enrichedCount };
}
