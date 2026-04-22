"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    IconSearch, IconPlus, IconX, IconCopy, IconCheck, IconStar, IconStarFilled,
    IconTrash, IconExternalLink, IconBook2, IconLoader2, IconFileText,
    IconChevronDown, IconChevronUp, IconTag, IconFolder, IconDownload,
    IconArrowRight, IconFilter, IconNotes
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

interface Collection {
    id: string;
    name: string;
    color: string | null;
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
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${colors[source] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
            {source}
        </span>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CitationsPage() {
    const { user, setShowLogin } = useAdmin();

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchSource, setSearchSource] = useState<"auto" | "crossref" | "arxiv" | "doi">("auto");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [expandedResult, setExpandedResult] = useState<number | null>(null);

    // Library state
    const [citations, setCitations] = useState<Citation[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [libraryFilter, setLibraryFilter] = useState("");
    const [showStarredOnly, setShowStarredOnly] = useState(false);
    const [activeTab, setActiveTab] = useState<"search" | "library">("search");
    const [savingId, setSavingId] = useState<string | null>(null);

    // Toast
    const [toast, setToast] = useState<string | null>(null);
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

    // Load library on mount
    useEffect(() => {
        if (user) {
            loadLibrary();
            loadCollections();
        }
    }, [user]);

    const loadLibrary = async () => {
        try {
            const res = await fetch("/api/citations");
            if (res.ok) {
                const data = await res.json();
                setCitations(data.citations);
            }
        } catch (e) {
            console.error("Failed to load citations", e);
        }
    };

    const loadCollections = async () => {
        try {
            const res = await fetch("/api/citations/collections");
            if (res.ok) {
                const data = await res.json();
                setCollections(data.collections);
            }
        } catch (e) {
            console.error("Failed to load collections", e);
        }
    };

    // ── Search ─────────────────────────────────────────────────────────────

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

    // ── Filtered Citations ─────────────────────────────────────────────────

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
                <div className="max-w-5xl mx-auto px-6 py-6">
                    <div className="flex items-center gap-4 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                            <IconBook2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-black tracking-tight">Citation Manager</h1>
                            <p className="text-xs text-gray-400">Search DOI · arXiv · CrossRef → copy \\cite{"{}"} & BibTeX instantly</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 w-fit">
                        <button
                            onClick={() => setActiveTab("search")}
                            className={`px-5 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-all ${
                                activeTab === "search"
                                    ? "bg-black text-white shadow-sm"
                                    : "text-gray-400 hover:text-black"
                            }`}
                        >
                            <IconSearch className="w-3.5 h-3.5 inline mr-1.5" />
                            Search
                        </button>
                        <button
                            onClick={() => setActiveTab("library")}
                            className={`px-5 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wider transition-all ${
                                activeTab === "library"
                                    ? "bg-black text-white shadow-sm"
                                    : "text-gray-400 hover:text-black"
                            }`}
                        >
                            <IconFolder className="w-3.5 h-3.5 inline mr-1.5" />
                            Library
                            {citations.length > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                                    {citations.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-6">
                    {/* ── SEARCH TAB ── */}
                    {activeTab === "search" && (
                        <div>
                            {/* Search Bar */}
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 px-2">
                                        <select
                                            value={searchSource}
                                            onChange={e => setSearchSource(e.target.value as any)}
                                            className="text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:border-gray-400"
                                        >
                                            <option value="auto">Auto</option>
                                            <option value="crossref">CrossRef</option>
                                            <option value="arxiv">arXiv</option>
                                            <option value="doi">DOI</option>
                                        </select>
                                    </div>
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
                                        {isSearching ? (
                                            <IconLoader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <IconSearch className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Quick Examples */}
                            {searchResults.length === 0 && !isSearching && !searchError && (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-5">
                                        <IconSearch className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-300 mb-2">Search academic papers</h3>
                                    <p className="text-sm text-gray-300 mb-6 max-w-md mx-auto">
                                        Enter a DOI, arXiv ID, or search by title to find papers and generate BibTeX citations
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {[
                                            { label: "10.1038/s41586-023-06600-9", desc: "DOI" },
                                            { label: "2301.07041", desc: "arXiv" },
                                            { label: "attention is all you need", desc: "Title" },
                                        ].map(ex => (
                                            <button
                                                key={ex.label}
                                                onClick={() => { setSearchQuery(ex.label); }}
                                                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-black transition-all"
                                            >
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-300 mr-2">{ex.desc}</span>
                                                {ex.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Search Error */}
                            {searchError && (
                                <div className="text-center py-8">
                                    <p className="text-sm text-gray-400">{searchError}</p>
                                </div>
                            )}

                            {/* Search Results */}
                            <div className="space-y-3">
                                {searchResults.map((r, idx) => {
                                    const isExpanded = expandedResult === idx;
                                    const isAlreadySaved = citations.some(
                                        c => (r.doi && c.doi === r.doi) || (r.arxiv_id && c.arxiv_id === r.arxiv_id)
                                    );

                                    return (
                                        <motion.div
                                            key={`${r.source}-${r.doi || r.arxiv_id || idx}`}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:border-gray-200 transition-colors"
                                        >
                                            {/* Main row */}
                                            <div className="p-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <SourceBadge source={r.source} />
                                                            {r.year && (
                                                                <span className="text-[10px] font-mono text-gray-400">{r.year}</span>
                                                            )}
                                                        </div>
                                                        <h3 className="text-[14px] font-bold text-black leading-snug mb-1 line-clamp-2">
                                                            {r.title}
                                                        </h3>
                                                        <p className="text-[12px] text-gray-400 truncate">
                                                            {r.authors.slice(0, 4).join(", ")}
                                                            {r.authors.length > 4 && ` +${r.authors.length - 4} more`}
                                                        </p>
                                                        {r.venue && (
                                                            <p className="text-[11px] text-gray-300 mt-0.5 italic truncate">{r.venue}</p>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <CopyButton text={`\\cite{${r.cite_key}}`} label="\\cite" />
                                                        <CopyButton text={r.bibtex} label="BibTeX" />
                                                        {isAlreadySaved ? (
                                                            <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-500 bg-emerald-50 border border-emerald-200">
                                                                <IconCheck className="w-3.5 h-3.5 inline mr-1" />Saved
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => saveToLibrary(r)}
                                                                disabled={savingId === r.cite_key}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-black text-white hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50"
                                                            >
                                                                {savingId === r.cite_key ? (
                                                                    <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <IconPlus className="w-3.5 h-3.5" />
                                                                )}
                                                                Save
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Expand toggle */}
                                                <button
                                                    onClick={() => setExpandedResult(isExpanded ? null : idx)}
                                                    className="mt-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 hover:text-black transition-colors flex items-center gap-1"
                                                >
                                                    {isExpanded ? <IconChevronUp className="w-3 h-3" /> : <IconChevronDown className="w-3 h-3" />}
                                                    {isExpanded ? "Less" : "Details"}
                                                </button>
                                            </div>

                                            {/* Expanded details */}
                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                                                            {r.abstract && (
                                                                <div>
                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">Abstract</p>
                                                                    <p className="text-[12px] text-gray-500 leading-relaxed line-clamp-4">{r.abstract}</p>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300 mb-1">BibTeX</p>
                                                                <pre className="text-[11px] font-mono text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                                                                    {r.bibtex}
                                                                </pre>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {r.doi && (
                                                                    <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noopener noreferrer"
                                                                        className="text-[11px] text-blue-500 hover:underline flex items-center gap-1">
                                                                        <IconExternalLink className="w-3 h-3" /> DOI
                                                                    </a>
                                                                )}
                                                                {r.arxiv_id && (
                                                                    <a href={`https://arxiv.org/abs/${r.arxiv_id}`} target="_blank" rel="noopener noreferrer"
                                                                        className="text-[11px] text-red-500 hover:underline flex items-center gap-1">
                                                                        <IconExternalLink className="w-3 h-3" /> arXiv
                                                                    </a>
                                                                )}
                                                                {r.url && (
                                                                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                                                                        className="text-[11px] text-gray-400 hover:underline flex items-center gap-1">
                                                                        <IconExternalLink className="w-3 h-3" /> URL
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
                        </div>
                    )}

                    {/* ── LIBRARY TAB ── */}
                    {activeTab === "library" && (
                        <div>
                            {/* Library Controls */}
                            <div className="flex items-center gap-3 mb-5">
                                <div className="flex-1 relative">
                                    <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                    <input
                                        value={libraryFilter}
                                        onChange={e => setLibraryFilter(e.target.value)}
                                        placeholder="Filter citations..."
                                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] outline-none focus:border-gray-400 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={() => setShowStarredOnly(!showStarredOnly)}
                                    className={`p-2.5 rounded-xl border transition-all ${
                                        showStarredOnly
                                            ? "bg-amber-50 border-amber-200 text-amber-500"
                                            : "bg-white border-gray-200 text-gray-300 hover:text-amber-400"
                                    }`}
                                    title="Show starred only"
                                >
                                    {showStarredOnly ? <IconStarFilled className="w-4 h-4" /> : <IconStar className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={exportAllBibtex}
                                    disabled={filteredCitations.length === 0}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-black text-white rounded-xl text-[11px] font-bold uppercase tracking-wider hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-20"
                                >
                                    <IconDownload className="w-3.5 h-3.5" />
                                    Export .bib
                                </button>
                            </div>

                            {/* Empty state */}
                            {citations.length === 0 && (
                                <div className="text-center py-16">
                                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-5">
                                        <IconFolder className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-300 mb-2">Your library is empty</h3>
                                    <p className="text-sm text-gray-300 mb-4">Search for papers and save them to build your citation library</p>
                                    <button
                                        onClick={() => setActiveTab("search")}
                                        className="px-5 py-2.5 bg-black text-white rounded-xl text-[12px] font-bold hover:bg-gray-800 transition-all"
                                    >
                                        <IconSearch className="w-4 h-4 inline mr-1.5" />
                                        Start Searching
                                    </button>
                                </div>
                            )}

                            {/* Citation cards */}
                            <div className="space-y-2">
                                {filteredCitations.map(c => (
                                    <div
                                        key={c.id}
                                        className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors group"
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Star */}
                                            <button
                                                onClick={() => toggleStar(c.id, c.starred)}
                                                className={`mt-0.5 shrink-0 transition-colors ${
                                                    c.starred ? "text-amber-400" : "text-gray-200 hover:text-amber-300"
                                                }`}
                                            >
                                                {c.starred ? <IconStarFilled className="w-4 h-4" /> : <IconStar className="w-4 h-4" />}
                                            </button>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[13px] font-bold text-black leading-snug mb-0.5 line-clamp-1">
                                                    {c.title}
                                                </h3>
                                                <p className="text-[11px] text-gray-400 truncate">
                                                    {c.authors.slice(0, 3).join(", ")}
                                                    {c.authors.length > 3 && ` +${c.authors.length - 3}`}
                                                    {c.year && <span className="ml-1">({c.year})</span>}
                                                    {c.venue && <span className="ml-1 italic">· {c.venue}</span>}
                                                </p>

                                                {/* Tags */}
                                                {c.tags.length > 0 && (
                                                    <div className="flex items-center gap-1 mt-1.5">
                                                        {c.tags.map(t => (
                                                            <span key={t} className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-50 text-gray-400 border border-gray-100">
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <CopyButton text={`\\cite{${c.cite_key}}`} label="\\cite" />
                                                <CopyButton text={c.bibtex} label="BibTeX" />
                                                {c.url && (
                                                    <a href={c.url} target="_blank" rel="noopener noreferrer"
                                                        className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 transition-colors">
                                                        <IconExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => deleteCitation(c.id)}
                                                    className="p-1.5 rounded-lg text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <IconTrash className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Filtered count */}
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
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-black text-white rounded-xl text-sm font-medium shadow-2xl"
                    >
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
