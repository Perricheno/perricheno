"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    IconSearch, IconPlus, IconX, IconCopy, IconCheck, IconStar, IconStarFilled,
    IconTrash, IconExternalLink, IconBook2, IconLoader2, IconFileText,
    IconChevronDown, IconChevronUp, IconTag, IconFolder, IconDownload,
    IconArrowRight, IconFilter, IconCode, IconUser, IconSettings
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAdmin } from "@/components/AdminContext";

// ── Types ──────────────────────────────────────────────────────────────────

interface SearchResult {
    source: "crossref" | "arxiv" | "doi";
    doi: string | null;
    arxiv_id: string | null;
    title: string;
    authors: string[];
    year: number | null;
    venue: string | null;
    abstract: string | null;
    url: string;
    bibtex: string;
    cite_key: string;
}

interface ScholarArticle {
    title: string;
    summary: string;
    authors: string[];
    year: number;
    url: string;
    doi?: string;
}

interface Citation {
    id: string;
    doi: string | null;
    arxiv_id: string | null;
    title: string;
    authors: string[];
    year: number | null;
    venue: string | null;
    abstract: string | null;
    url: string | null;
    bibtex: string;
    cite_key: string;
    tags: string[];
    notes: string | null;
    starred: boolean;
    added_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={copy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                copied
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-black"
            }`}
        >
            {copied ? <IconCheck className="w-3.5 h-3.5" /> : <IconCopy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : label}
        </button>
    );
}

function SourceBadge({ source }: { source: string }) {
    const colors: Record<string, string> = {
        crossref: "bg-blue-50 text-blue-600 border-blue-200",
        arxiv: "bg-red-50 text-red-600 border-red-200",
        doi: "bg-purple-50 text-purple-600 border-purple-200",
        openalex: "bg-green-50 text-green-600 border-green-200",
        scholar: "bg-amber-50 text-amber-600 border-amber-200",
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${colors[source] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
            {source}
        </span>
    );
}

// Generate bibtex from a ScholarArticle
function articleToBibtex(article: ScholarArticle): { bibtex: string; citeKey: string } {
    const firstAuthor = article.authors[0]?.split(' ').pop() ?? 'unknown';
    const citeKey = `${firstAuthor.toLowerCase().replace(/[^a-z]/g, '')}${article.year ?? ''}`;
    
    const arxivId = article.url?.match(/arxiv\.org\/abs\/([\d.]+)/)?.[1] ?? '';
    
    const bibtex = `@article{${citeKey},
  title     = {${article.title}},
  author    = {${article.authors.join(' and ')}},
  year      = {${article.year ?? ''}},${arxivId ? `\n  eprint    = {${arxivId}},\n  archivePrefix = {arXiv},` : ''}${article.doi ? `\n  doi       = {${article.doi}},` : ''}
  url       = {${article.url}}
}`;
    return { bibtex, citeKey };
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CitationsPage() {
    const { user, setShowLogin } = useAdmin();

    // Tab state
    const [activeTab, setActiveTab] = useState<"search" | "scholar" | "library">("search");

    // ── SEARCH STATE (DOI/CrossRef/arXiv quick lookup) ──
    const [searchQuery, setSearchQuery] = useState("");
    const [searchSource, setSearchSource] = useState<"auto" | "crossref" | "arxiv" | "doi">("auto");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [expandedResult, setExpandedResult] = useState<number | null>(null);

    // ── SCHOLAR STATE (Deep academic search via research-api) ──
    const [scholarQuery, setScholarQuery] = useState("");
    const [scholarSource, setScholarSource] = useState<"openalex" | "arxiv">("openalex");
    const [scholarMaxResults, setScholarMaxResults] = useState(15);
    const [scholarYearFrom, setScholarYearFrom] = useState("Any");
    const [isScholarSearching, setIsScholarSearching] = useState(false);
    const [scholarResults, setScholarResults] = useState<ScholarArticle[]>([]);
    const [scholarError, setScholarError] = useState<string | null>(null);
    const [scholarQueryUsed, setScholarQueryUsed] = useState("");
    const [expandedScholar, setExpandedScholar] = useState<number | null>(null);
    const [scholarSettingsOpen, setScholarSettingsOpen] = useState(false);

    // ── LIBRARY STATE ──
    const [citations, setCitations] = useState<Citation[]>([]);
    const [libraryFilter, setLibraryFilter] = useState("");
    const [showStarredOnly, setShowStarredOnly] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);

    // Toast
    const [toast, setToast] = useState<string | null>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

    // Load library on mount
    useEffect(() => {
        if (user) loadLibrary();
    }, [user]);

    const loadLibrary = async () => {
        try {
            const res = await fetch("/api/citations");
            if (res.ok) {
                const data = await res.json();
                setCitations(data.citations ?? []);
            }
        } catch (e) {
            console.error("Failed to load citations", e);
        }
    };

    // ── DOI/CrossRef/arXiv Quick Search ────────────────────────────────────

    const handleSearch = async () => {
        if (!user) { setShowLogin(true); return; }
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setSearchError(null);
        setSearchResults([]);
        setExpandedResult(null);

        try {
            const params = new URLSearchParams({ q: searchQuery.trim(), source: searchSource });
            const res = await fetch(`/api/citations/search?${params}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                throw new Error(err.error || "Search failed");
            }
            const data = await res.json();
            setSearchResults(data.results ?? []);
            if ((data.results ?? []).length === 0) {
                setSearchError("No results found. Try a different query or source.");
            }
        } catch (e: any) {
            setSearchError(e.message);
        } finally {
            setIsSearching(false);
        }
    };

    // ── Scholar Deep Search (via research-api Go microservice) ─────────────

    const handleScholarSearch = async () => {
        if (!user) { setShowLogin(true); return; }
        if (!scholarQuery.trim()) return;

        setIsScholarSearching(true);
        setScholarError(null);
        setScholarResults([]);
        setExpandedScholar(null);
        setScholarQueryUsed("");

        try {
            // Create a temporary session for the search
            const sessionRes = await fetch('/api/agent/scholar/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: scholarQuery.trim(),
                    settings: {
                        scholarSource,
                        scholarMaxArticles: scholarMaxResults,
                        scholarYearFrom,
                        scholarAuthors: '',
                    }
                })
            });

            if (!sessionRes.ok) {
                if (sessionRes.status === 402) {
                    throw new Error("Insufficient balance. Please top up your account.");
                }
                const err = await sessionRes.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${sessionRes.status}`);
            }

            const { sessionId } = await sessionRes.json();

            // Now perform the actual search
            const searchRes = await fetch('/api/agent/scholar/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });

            if (!searchRes.ok) {
                const err = await searchRes.json().catch(() => ({}));
                throw new Error(err.error || "Scholar search failed");
            }

            const data = await searchRes.json();
            setScholarResults(data.articles ?? []);
            setScholarQueryUsed(data.query || scholarQuery);

            if ((data.articles ?? []).length === 0) {
                setScholarError("No papers found. Try different keywords or adjust settings.");
            }
        } catch (e: any) {
            setScholarError(e.message);
        } finally {
            setIsScholarSearching(false);
        }
    };

    // Scholar filtering
    const [scholarFilterText, setScholarFilterText] = useState("");
    type SortKey = "relevance" | "year_desc" | "year_asc";
    const [scholarSortKey, setScholarSortKey] = useState<SortKey>("relevance");

    const filteredScholarResults = useMemo(() => {
        const needle = scholarFilterText.trim().toLowerCase();
        let out = scholarResults.filter(a => {
            if (!needle) return true;
            const hay = `${a.title} ${a.summary} ${(a.authors || []).join(" ")}`.toLowerCase();
            return hay.includes(needle);
        });
        if (scholarSortKey === "year_desc") out = [...out].sort((a, b) => (b.year || 0) - (a.year || 0));
        else if (scholarSortKey === "year_asc") out = [...out].sort((a, b) => (a.year || 0) - (b.year || 0));
        return out;
    }, [scholarResults, scholarFilterText, scholarSortKey]);

    // ── Save to Library ────────────────────────────────────────────────────

    const saveToLibrary = async (result: SearchResult) => {
        if (!user) { setShowLogin(true); return; }

        setSavingId(result.cite_key);
        try {
            const res = await fetch("/api/citations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    doi: result.doi,
                    arxiv_id: result.arxiv_id,
                    title: result.title,
                    authors: result.authors,
                    year: result.year,
                    venue: result.venue,
                    abstract: result.abstract,
                    url: result.url,
                    bibtex: result.bibtex,
                    cite_key: result.cite_key,
                    tags: [],
                    notes: null,
                    starred: false,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to save");
            }
            showToast(`Saved: \\cite{${result.cite_key}}`);
            loadLibrary();
        } catch (e: any) {
            showToast(`Error: ${e.message}`);
        } finally {
            setSavingId(null);
        }
    };

    const saveScholarToLibrary = async (article: ScholarArticle) => {
        if (!user) { setShowLogin(true); return; }

        const { bibtex, citeKey } = articleToBibtex(article);
        const arxivId = article.url?.match(/arxiv\.org\/abs\/([\d.]+)/)?.[1] ?? null;
        
        setSavingId(citeKey);
        try {
            const res = await fetch("/api/citations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    doi: article.doi ?? null,
                    arxiv_id: arxivId,
                    title: article.title,
                    authors: article.authors,
                    year: article.year,
                    venue: null,
                    abstract: article.summary,
                    url: article.url,
                    bibtex,
                    cite_key: citeKey,
                    tags: [],
                    notes: null,
                    starred: false,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to save");
            }
            showToast(`Saved: \\cite{${citeKey}}`);
            loadLibrary();
        } catch (e: any) {
            showToast(`Error: ${e.message}`);
        } finally {
            setSavingId(null);
        }
    };

    // ── Library Actions ────────────────────────────────────────────────────

    const toggleStar = async (id: string, starred: boolean) => {
        await fetch(`/api/citations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ starred: !starred }),
        });
        setCitations(prev => prev.map(c => c.id === id ? { ...c, starred: !starred } : c));
    };

    const deleteCitation = async (id: string) => {
        if (!confirm("Delete this citation from your library?")) return;
        await fetch(`/api/citations/${id}`, { method: "DELETE" });
        setCitations(prev => prev.filter(c => c.id !== id));
        showToast("Citation deleted");
    };

    const exportAllBibtex = () => {
        const bibtex = filteredCitations.map(c => c.bibtex).join("\n\n");
        const blob = new Blob([bibtex], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "references.bib";
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Filtered Library ───────────────────────────────────────────────────

    const filteredCitations = citations.filter(c => {
        if (showStarredOnly && !c.starred) return false;
        if (libraryFilter) {
            const q = libraryFilter.toLowerCase();
            return (
                c.title.toLowerCase().includes(q) ||
                c.cite_key.toLowerCase().includes(q) ||
                c.authors.some(a => a.toLowerCase().includes(q)) ||
                (c.venue && c.venue.toLowerCase().includes(q))
            );
        }
        return true;
    });

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="w-full h-full flex flex-col bg-[#FBFBFC] overflow-hidden">
            {/* Header */}
            <div className="shrink-0 border-b border-gray-100 bg-white">
                <div className="max-w-5xl mx-auto px-6 py-5">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                            <IconBook2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-black tracking-tight">Citation Manager</h1>
                            <p className="text-xs text-gray-400">Search · Discover · Cite - DOI, arXiv, CrossRef, OpenAlex</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 w-fit">
                        {([
                            { id: "search" as const, label: "Quick Search", icon: IconSearch },
                            { id: "scholar" as const, label: "Scholar", icon: IconBook2 },
                            { id: "library" as const, label: "Library", icon: IconFolder },
                        ]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                    activeTab === tab.id
                                        ? "bg-black text-white shadow-sm"
                                        : "text-gray-400 hover:text-black"
                                }`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                                {tab.id === "library" && citations.length > 0 && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                                        activeTab === "library" ? "bg-white/20" : "bg-gray-200/50"
                                    }`}>
                                        {citations.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-6">

                    {/* ═══════════════════════════════════════════════════════ */}
                    {/* ── QUICK SEARCH TAB (DOI/CrossRef/arXiv) ──           */}
                    {/* ═══════════════════════════════════════════════════════ */}
                    {activeTab === "search" && (
                        <div>
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 mb-6">
                                <div className="flex items-center gap-2">
                                    <select
                                        value={searchSource}
                                        onChange={e => setSearchSource(e.target.value as any)}
                                        className="text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-gray-400 shrink-0"
                                    >
                                        <option value="auto">Auto</option>
                                        <option value="crossref">CrossRef</option>
                                        <option value="arxiv">arXiv</option>
                                        <option value="doi">DOI</option>
                                    </select>
                                    <input
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                                        placeholder="Search by title, DOI (10.xxxx/...), or arXiv ID (2401.12345)..."
                                        className="flex-1 text-[14px] text-black bg-transparent outline-none placeholder:text-gray-300 py-2"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleSearch}
                                        disabled={!searchQuery.trim() || isSearching}
                                        className="w-9 h-9 bg-black text-white rounded-xl flex items-center justify-center disabled:opacity-10 transition-all hover:bg-gray-800 active:scale-95 shrink-0"
                                    >
                                        {isSearching ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconSearch className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Empty state */}
                            {searchResults.length === 0 && !isSearching && !searchError && (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-5">
                                        <IconSearch className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-300 mb-2">Quick Citation Lookup</h3>
                                    <p className="text-sm text-gray-300 mb-6 max-w-md mx-auto">
                                        Enter a DOI, arXiv ID, or title to find papers and generate BibTeX
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {[
                                            { label: "10.1038/s41586-023-06600-9", desc: "DOI" },
                                            { label: "2301.07041", desc: "arXiv" },
                                            { label: "attention is all you need", desc: "Title" },
                                        ].map(ex => (
                                            <button
                                                key={ex.label}
                                                onClick={() => setSearchQuery(ex.label)}
                                                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-black transition-all"
                                            >
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-300 mr-2">{ex.desc}</span>
                                                {ex.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {searchError && <div className="text-center py-8"><p className="text-sm text-gray-400">{searchError}</p></div>}

                            {/* Search Results */}
                            <div className="space-y-3">
                                {searchResults.map((r, idx) => {
                                    const isExpanded = expandedResult === idx;
                                    const isAlreadySaved = citations.some(c => (r.doi && c.doi === r.doi) || (r.arxiv_id && c.arxiv_id === r.arxiv_id));

                                    return (
                                        <motion.div key={`${r.source}-${r.doi || r.arxiv_id || idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
                                            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors">
                                            <div className="p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <SourceBadge source={r.source} />
                                                            {r.year && <span className="text-[10px] font-mono text-gray-400">{r.year}</span>}
                                                        </div>
                                                        <h3 className="text-[14px] font-bold text-black leading-snug mb-1 line-clamp-2">{r.title}</h3>
                                                        <p className="text-[12px] text-gray-400 truncate">
                                                            {r.authors.slice(0, 4).join(", ")}{r.authors.length > 4 && ` +${r.authors.length - 4}`}
                                                        </p>
                                                        {r.venue && <p className="text-[11px] text-gray-300 mt-0.5 italic truncate">{r.venue}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <CopyButton text={`\\cite{${r.cite_key}}`} label="\\cite" />
                                                        <CopyButton text={r.bibtex} label="BibTeX" />
                                                        {isAlreadySaved ? (
                                                            <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-500 bg-emerald-50 border border-emerald-200">
                                                                <IconCheck className="w-3.5 h-3.5 inline mr-1" />Saved
                                                            </span>
                                                        ) : (
                                                            <button onClick={() => saveToLibrary(r)} disabled={savingId === r.cite_key}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-black text-white hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50">
                                                                {savingId === r.cite_key ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconPlus className="w-3.5 h-3.5" />}
                                                                Save
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <button onClick={() => setExpandedResult(isExpanded ? null : idx)}
                                                    className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 hover:text-black transition-colors flex items-center gap-1">
                                                    {isExpanded ? <IconChevronUp className="w-3 h-3" /> : <IconChevronDown className="w-3 h-3" />}
                                                    {isExpanded ? "Less" : "Details"}
                                                </button>
                                            </div>
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                                        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                                                            {r.abstract && (
                                                                <div>
                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">Abstract</p>
                                                                    <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-4">{r.abstract}</p>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">BibTeX</p>
                                                                <pre className="text-[11px] font-mono text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{r.bibtex}</pre>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {r.doi && <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline flex items-center gap-1"><IconExternalLink className="w-3 h-3" /> DOI</a>}
                                                                {r.arxiv_id && <a href={`https://arxiv.org/abs/${r.arxiv_id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-red-500 hover:underline flex items-center gap-1"><IconExternalLink className="w-3 h-3" /> arXiv</a>}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════ */}
                    {/* ── SCHOLAR TAB (Deep academic search)                 */}
                    {/* ═══════════════════════════════════════════════════════ */}
                    {activeTab === "scholar" && (
                        <div>
                            {/* Search Bar */}
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 mb-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        value={scholarQuery}
                                        onChange={e => setScholarQuery(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter") handleScholarSearch(); }}
                                        placeholder="Describe your research topic... (supports any language)"
                                        className="flex-1 text-[14px] text-black bg-transparent outline-none placeholder:text-gray-300 py-2 px-2"
                                    />
                                    <button
                                        onClick={() => setScholarSettingsOpen(!scholarSettingsOpen)}
                                        className={`p-2 rounded-lg transition-colors ${scholarSettingsOpen ? 'text-black bg-gray-100' : 'text-gray-400 hover:text-black'}`}
                                        title="Search settings"
                                    >
                                        <IconSettings className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleScholarSearch}
                                        disabled={!scholarQuery.trim() || isScholarSearching}
                                        className="w-9 h-9 bg-black text-white rounded-xl flex items-center justify-center disabled:opacity-10 transition-all hover:bg-gray-800 active:scale-95 shrink-0"
                                    >
                                        {isScholarSearching ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconSearch className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Settings panel */}
                            <AnimatePresence>
                                {scholarSettingsOpen && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden mb-4">
                                        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Source</label>
                                                <select value={scholarSource} onChange={e => setScholarSource(e.target.value as any)}
                                                    className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none cursor-pointer">
                                                    <option value="openalex">OpenAlex</option>
                                                    <option value="arxiv">arXiv</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Max Results</label>
                                                <select value={scholarMaxResults} onChange={e => setScholarMaxResults(Number(e.target.value))}
                                                    className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none cursor-pointer">
                                                    {[5, 10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Year From</label>
                                                <select value={scholarYearFrom} onChange={e => setScholarYearFrom(e.target.value)}
                                                    className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none cursor-pointer">
                                                    {["Any", "2024", "2023", "2022", "2020", "2015", "2010"].map(y => <option key={y} value={y}>{y === "Any" ? "Any year" : `${y}+`}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Loading */}
                            {isScholarSearching && (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="bg-white border border-gray-100 p-8 rounded-2xl shadow-sm text-center max-w-sm w-full">
                                        <IconBook2 className="w-12 h-12 text-black mx-auto mb-4" stroke={1.5} />
                                        <IconLoader2 className="w-6 h-6 animate-spin text-black mx-auto mb-4" />
                                        <h3 className="font-bold text-black mb-2">Searching Academic Papers...</h3>
                                        <p className="text-sm text-gray-400">Querying {scholarSource === 'openalex' ? 'OpenAlex' : 'arXiv'} for relevant papers</p>
                                    </div>
                                </div>
                            )}

                            {/* Empty state */}
                            {!isScholarSearching && scholarResults.length === 0 && !scholarError && (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-5">
                                        <IconBook2 className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-300 mb-2">Deep Academic Search</h3>
                                    <p className="text-sm text-gray-300 mb-6 max-w-md mx-auto">
                                        Search arXiv and OpenAlex for academic papers. Supports queries in any language - auto-translated to English.
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {[
                                            "transformer architectures for NLP",
                                            "квантовые вычисления",
                                            "CRISPR gene editing 2024",
                                        ].map(ex => (
                                            <button key={ex} onClick={() => setScholarQuery(ex)}
                                                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-black transition-all">
                                                {ex}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {scholarError && <div className="text-center py-8"><p className="text-sm text-gray-400">{scholarError}</p></div>}

                            {/* Scholar Results */}
                            {!isScholarSearching && scholarResults.length > 0 && (
                                <>
                                    {/* Header + filters */}
                                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-4">
                                        <div>
                                            <h2 className="text-lg font-black text-black">
                                                {filteredScholarResults.length} Papers Found
                                            </h2>
                                            {scholarQueryUsed && scholarQueryUsed !== scholarQuery && (
                                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">Translated query: {scholarQueryUsed}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Filter bar */}
                                    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex flex-col md:flex-row md:items-center gap-3 mb-4">
                                        <div className="flex-1 relative">
                                            <IconSearch className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input value={scholarFilterText} onChange={e => setScholarFilterText(e.target.value)}
                                                placeholder="Filter results..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-100 bg-gray-50 text-sm outline-none focus:border-gray-300 transition-colors" />
                                        </div>
                                        <select value={scholarSortKey} onChange={e => setScholarSortKey(e.target.value as SortKey)}
                                            className="px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 text-sm outline-none cursor-pointer">
                                            <option value="relevance">Relevance</option>
                                            <option value="year_desc">Year ↓</option>
                                            <option value="year_asc">Year ↑</option>
                                        </select>
                                    </div>

                                    {/* Article cards */}
                                    <div className="space-y-3">
                                        {filteredScholarResults.map((article, idx) => {
                                            const { bibtex, citeKey } = articleToBibtex(article);
                                            const isExpanded = expandedScholar === idx;
                                            const arxivId = article.url?.match(/arxiv\.org\/abs\/([\d.]+)/)?.[1] ?? null;
                                            const isAlreadySaved = citations.some(c =>
                                                (article.doi && c.doi === article.doi) ||
                                                (arxivId && c.arxiv_id === arxivId)
                                            );

                                            return (
                                                <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                                                    className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors group">
                                                    <div className="p-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1.5">
                                                                    <SourceBadge source={arxivId ? "arxiv" : "openalex"} />
                                                                    <span className="text-[10px] font-mono text-gray-400">{article.year}</span>
                                                                </div>
                                                                <h3 className="text-[14px] font-bold text-black leading-snug mb-1">
                                                                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{article.title}</a>
                                                                </h3>
                                                                <p className="text-[12px] text-gray-400 truncate">
                                                                    <IconUser className="w-3 h-3 inline mr-1 text-gray-300" />
                                                                    {article.authors.slice(0, 4).join(", ")}{article.authors.length > 4 && ` +${article.authors.length - 4}`}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <CopyButton text={`\\cite{${citeKey}}`} label="\\cite" />
                                                                <CopyButton text={bibtex} label="BibTeX" />
                                                                {isAlreadySaved ? (
                                                                    <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-500 bg-emerald-50 border border-emerald-200">
                                                                        <IconCheck className="w-3.5 h-3.5 inline mr-1" />Saved
                                                                    </span>
                                                                ) : (
                                                                    <button onClick={() => saveScholarToLibrary(article)} disabled={savingId === citeKey}
                                                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-black text-white hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50">
                                                                        {savingId === citeKey ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconPlus className="w-3.5 h-3.5" />}
                                                                        Save
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <button onClick={() => setExpandedScholar(isExpanded ? null : idx)}
                                                            className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 hover:text-black transition-colors flex items-center gap-1">
                                                            {isExpanded ? <IconChevronUp className="w-3 h-3" /> : <IconChevronDown className="w-3 h-3" />}
                                                            {isExpanded ? "Less" : "Abstract & Links"}
                                                        </button>
                                                    </div>

                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                                                <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                                                                    {article.summary && (
                                                                        <div>
                                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">Abstract</p>
                                                                            <p className="text-[12px] text-gray-500 leading-relaxed">{article.summary}</p>
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">BibTeX</p>
                                                                        <pre className="text-[11px] font-mono text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{bibtex}</pre>
                                                                    </div>
                                                                    <div className="flex gap-2 flex-wrap">
                                                                        <a href={article.url} target="_blank" rel="noopener noreferrer"
                                                                            className="text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 hover:bg-black hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-gray-200 flex items-center gap-1.5">
                                                                            <IconExternalLink className="w-3 h-3" /> View Paper
                                                                        </a>
                                                                        {article.url?.includes('arxiv.org') && (
                                                                            <>
                                                                                <a href={article.url.replace('/abs/', '/pdf/')} target="_blank" rel="noopener noreferrer"
                                                                                    className="text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 hover:bg-black hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-gray-200 flex items-center gap-1.5">
                                                                                    <IconFileText className="w-3 h-3" /> PDF
                                                                                </a>
                                                                                <a href={article.url.replace('/abs/', '/e-print/')} target="_blank" rel="noopener noreferrer"
                                                                                    className="text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 hover:bg-black hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-gray-200 flex items-center gap-1.5">
                                                                                    <IconCode className="w-3 h-3" /> LaTeX
                                                                                </a>
                                                                            </>
                                                                        )}
                                                                        {article.doi && (
                                                                            <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer"
                                                                                className="text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 hover:bg-black hover:text-white px-3 py-1.5 rounded-lg transition-colors border border-gray-200 flex items-center gap-1.5">
                                                                                <IconBook2 className="w-3 h-3" /> DOI
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════ */}
                    {/* ── LIBRARY TAB ──                                      */}
                    {/* ═══════════════════════════════════════════════════════ */}
                    {activeTab === "library" && (
                        <div>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="flex-1 relative">
                                    <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                    <input value={libraryFilter} onChange={e => setLibraryFilter(e.target.value)}
                                        placeholder="Filter citations..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:border-gray-400 transition-colors" />
                                </div>
                                <button onClick={() => setShowStarredOnly(!showStarredOnly)}
                                    className={`p-2.5 rounded-xl border transition-all ${showStarredOnly ? "bg-amber-50 border-amber-200 text-amber-500" : "bg-white border-gray-200 text-gray-300 hover:text-amber-400"}`}
                                    title="Show starred only">
                                    {showStarredOnly ? <IconStarFilled className="w-4 h-4" /> : <IconStar className="w-4 h-4" />}
                                </button>
                                <button onClick={exportAllBibtex} disabled={filteredCitations.length === 0}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-black text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-20">
                                    <IconDownload className="w-3.5 h-3.5" /> Export .bib
                                </button>
                            </div>

                            {citations.length === 0 && (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-5">
                                        <IconFolder className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-300 mb-2">Your library is empty</h3>
                                    <p className="text-sm text-gray-300 mb-4">Search for papers and save them to build your citation library</p>
                                    <button onClick={() => setActiveTab("search")}
                                        className="px-5 py-2.5 bg-black text-white rounded-xl text-[12px] font-bold hover:bg-gray-800 transition-all">
                                        <IconSearch className="w-4 h-4 inline mr-1.5" /> Start Searching
                                    </button>
                                </div>
                            )}

                            <div className="space-y-2">
                                {filteredCitations.map(c => (
                                    <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors group">
                                        <div className="flex items-start gap-3">
                                            <button onClick={() => toggleStar(c.id, c.starred)}
                                                className={`mt-0.5 shrink-0 transition-colors ${c.starred ? "text-amber-400" : "text-gray-200 hover:text-amber-300"}`}>
                                                {c.starred ? <IconStarFilled className="w-4 h-4" /> : <IconStar className="w-4 h-4" />}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[13px] font-bold text-black leading-snug mb-0.5 line-clamp-1">{c.title}</h3>
                                                <p className="text-[11px] text-gray-400 truncate">
                                                    {c.authors.slice(0, 3).join(", ")}{c.authors.length > 3 && ` +${c.authors.length - 3}`}
                                                    {c.year && <span className="ml-1">({c.year})</span>}
                                                    {c.venue && <span className="ml-1 italic">· {c.venue}</span>}
                                                </p>
                                                {c.tags.length > 0 && (
                                                    <div className="flex items-center gap-1 mt-1.5">
                                                        {c.tags.map(t => <span key={t} className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-50 text-gray-400 border border-gray-100">{t}</span>)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <CopyButton text={`\\cite{${c.cite_key}}`} label="\\cite" />
                                                <CopyButton text={c.bibtex} label="BibTeX" />
                                                {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 transition-colors"><IconExternalLink className="w-3.5 h-3.5" /></a>}
                                                <button onClick={() => deleteCitation(c.id)} className="p-1.5 rounded-lg text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><IconTrash className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {citations.length > 0 && (
                                <div className="text-center mt-6 text-[11px] text-gray-300 font-mono">
                                    {filteredCitations.length} of {citations.length} citations
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-black text-white rounded-xl text-sm font-medium shadow-2xl">
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
