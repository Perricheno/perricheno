"use client";

import { useState, useEffect, useMemo } from "react";
import { IconBook2, IconLoader2, IconExternalLink, IconUser, IconArrowLeft, IconMenu2, IconFileText, IconCode, IconSearch, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { AgentSession, ScholarArticle } from "../../types";
import { AgentSidebar } from "../../AgentSidebar";

interface Props {
    initialSession: AgentSession;
    sessions: AgentSession[];
    userId: number;
}

export default function ScholarClient({ initialSession, sessions: initialSessions, userId }: Props) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    
    // Parse visuals_json safely - could be a JSON string or already an array
    const parseArticles = (raw: any): ScholarArticle[] => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return []; }
        }
        return [];
    };
    
    const [articles, setArticles] = useState<ScholarArticle[]>(parseArticles(initialSession.visuals_json));
    const [error, setError] = useState("");
    const [queryUsed, setQueryUsed] = useState("");

    // ── Client-side filters (applied over already-fetched results) ──
    type SortKey = "relevance" | "year_desc" | "year_asc";
    const [filterText, setFilterText] = useState("");
    const [filterMinYear, setFilterMinYear] = useState<string>("Any");
    const [sortKey, setSortKey] = useState<SortKey>("relevance");

    const filteredArticles = useMemo(() => {
        const needle = filterText.trim().toLowerCase();
        const minYear = filterMinYear === "Any" ? 0 : parseInt(filterMinYear, 10) || 0;

        let out = articles.filter(a => {
            if (minYear && (a.year || 0) < minYear) return false;
            if (!needle) return true;
            const hay = `${a.title} ${a.summary} ${(a.authors || []).join(" ")}`.toLowerCase();
            return hay.includes(needle);
        });

        if (sortKey === "year_desc") out = [...out].sort((a, b) => (b.year || 0) - (a.year || 0));
        else if (sortKey === "year_asc") out = [...out].sort((a, b) => (a.year || 0) - (b.year || 0));
        return out;
    }, [articles, filterText, filterMinYear, sortKey]);

    const yearOptions = useMemo(() => {
        const years = articles.map(a => a.year).filter(y => typeof y === "number" && y > 0) as number[];
        if (years.length === 0) return ["Any"];
        const min = Math.min(...years);
        const buckets = ["Any", "2023", "2020", "2015", "2010"].filter(v => v === "Any" || parseInt(v, 10) >= min);
        return buckets;
    }, [articles]);
    
    // Sidebar State
    const [sessions, setSessions] = useState<AgentSession[]>(initialSessions);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const currentSessionId = initialSession.id;
    const sessionTitle = initialSession.title || "Literature Search";

    useEffect(() => {
        const existingArticles = parseArticles(initialSession.visuals_json);
        if ((initialSession.status === 'generating' || initialSession.status === 'completed') && existingArticles.length === 0) {
            performSearch();
        }
    }, [currentSessionId]);

    const performSearch = async () => {
        setIsSearching(true);
        try {
            const res = await fetch('/api/agent/scholar/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: currentSessionId })
            });

            if (!res.ok) throw new Error(await res.text());
            const resData = await res.json();
            setArticles(resData.articles || []);
            setQueryUsed(resData.query || "");
            
            // Update local sessions array to mark as completed
            setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, status: 'completed', visuals_json: resData.articles } : s));

        } catch (err: any) {
            setError(err.message || "Failed to search literature.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectSession = (s: AgentSession) => {
        if (s.doc_type === 'chat') {
            router.push(`/agent/chat/${s.id}`);
        } else if (s.doc_type === 'literature_search') {
            router.push(`/agent/scholar/${s.id}`);
        } else {
            router.push(`/agent/${s.id}`);
        }
    };

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSessions(prev => prev.filter(s => s.id !== id));
        await fetch(`/api/agent/scholar/sessions/${id}`, { method: 'DELETE' });
        if (id === currentSessionId) {
            router.push('/agent');
        }
    };

    const handleShareSession = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // Implemented if needed
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[var(--background)]">
                <p className="text-red-500 font-medium">{error}</p>
                <button onClick={() => router.push('/agent')} className="mt-4 text-sm underline text-gray-500">Go back</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--background)] flex">
            
            <AgentSidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onShareSession={handleShareSession}
                onNewSession={() => router.push('/agent')}
                isOpen={sidebarOpen}
                setIsOpen={setSidebarOpen}
            />

            <div className="flex-1 flex flex-col relative w-full max-w-full min-w-0 transition-all duration-300">
                {/* Header */}
                <div className="h-14 border-b border-[var(--border)] bg-[var(--card)] flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm shrink-0">
                    <div className="flex items-center gap-3 ml-10 md:ml-0">
                        <button onClick={() => router.push('/agent')} className="hover:bg-black/5 p-1.5 rounded-lg transition-colors hidden md:block">
                            <IconArrowLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <div className="font-semibold text-[var(--foreground)] truncate max-w-[200px] md:max-w-md text-sm">{sessionTitle}</div>
                    </div>
                    <div className="text-[10px] font-bold px-2.5 py-1 bg-[var(--foreground)] text-[var(--background)] rounded uppercase tracking-wider flex items-center gap-1.5">
                        <IconBook2 className="w-3.5 h-3.5" />
                        Scholar
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isSearching ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                            <div className="bg-[var(--card)] border border-[var(--border)] p-8 rounded-2xl shadow-sm text-center max-w-sm w-full mx-4">
                                <IconBook2 className="w-12 h-12 text-[var(--foreground)] mx-auto mb-4" stroke={1.5} />
                                <IconLoader2 className="w-6 h-6 animate-spin text-[var(--foreground)] mx-auto mb-4" />
                                <h3 className="font-semibold text-[var(--foreground)] mb-2">Formulating Academic Query...</h3>
                                <p className="text-sm text-gray-500">Searching arXiv database for fresh papers related to your topic.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-4xl w-full mx-auto p-4 md:p-8 space-y-6">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">Search Results</h1>
                                    <p className="text-sm text-gray-500 mt-1 font-medium">
                                        Showing {filteredArticles.length} of {articles.length} papers.
                                    </p>
                                </div>
                                {queryUsed && (
                                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2 text-[11px] font-mono text-gray-500 max-w-xs truncate shadow-sm" title={queryUsed}>
                                        <strong className="text-[var(--foreground)] mr-1">QUERY:</strong> {queryUsed}
                                    </div>
                                )}
                            </div>

                            {/* Filter bar - monochrome, matches settings panel style */}
                            {articles.length > 0 && (
                                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-6">
                                    {/* Text filter */}
                                    <div className="flex-1 relative">
                                        <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <input
                                            type="text"
                                            value={filterText}
                                            onChange={(e) => setFilterText(e.target.value)}
                                            placeholder="Filter by title, author, abstract…"
                                            className="w-full pl-9 pr-8 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-[var(--foreground)] transition-colors placeholder:text-gray-400"
                                        />
                                        {filterText && (
                                            <button
                                                onClick={() => setFilterText("")}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/5 transition-colors"
                                                aria-label="Clear filter"
                                            >
                                                <IconX className="w-3.5 h-3.5 text-gray-400" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Min year */}
                                    <div className="flex flex-col gap-1 md:min-w-[180px]">
                                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Year From</label>
                                        <select
                                            value={filterMinYear}
                                            onChange={(e) => setFilterMinYear(e.target.value)}
                                            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-[var(--foreground)] transition-colors cursor-pointer"
                                        >
                                            {yearOptions.map((v) => (
                                                <option key={v} value={v}>{v === "Any" ? "Any year" : `${v}+`}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Sort */}
                                    <div className="flex flex-col gap-1 md:min-w-[200px]">
                                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Sort</label>
                                        <select
                                            value={sortKey}
                                            onChange={(e) => setSortKey(e.target.value as SortKey)}
                                            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-[var(--foreground)] transition-colors cursor-pointer"
                                        >
                                            <option value="relevance">Relevance</option>
                                            <option value="year_desc">Year ↓ (newest)</option>
                                            <option value="year_asc">Year ↑ (oldest)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {filteredArticles.length === 0 ? (
                                <div className="text-center py-20 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm">
                                    <IconBook2 className="w-12 h-12 text-gray-300 mx-auto mb-4" stroke={1.5} />
                                    <h3 className="text-lg font-bold text-[var(--foreground)] mb-1">
                                        {articles.length === 0 ? "No articles found" : "Nothing matches your filters"}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {articles.length === 0
                                            ? "Try adjusting your topic or relaxing the filters in settings."
                                            : "Clear the filter text or lower the minimum year."}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col space-y-4">
                                    {filteredArticles.map((article, idx) => (
                                        <div key={idx} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--foreground)] transition-colors shadow-sm relative group overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--foreground)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="flex items-start justify-between gap-4">
                                                <h3 className="text-[15px] font-bold text-[var(--foreground)] leading-snug">
                                                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-start gap-2">
                                                        {article.title}
                                                    </a>
                                                </h3>
                                                <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono font-bold text-gray-500 bg-[var(--background)] px-2 py-1 rounded border border-[var(--border)]">
                                                    {article.year}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-2 text-[12px] text-gray-500 font-semibold flex-wrap">
                                                <IconUser className="w-3.5 h-3.5 text-gray-400" />
                                                {article.authors.length > 0 ? article.authors.slice(0, 5).join(", ") + (article.authors.length > 5 ? " et al." : "") : "Unknown Authors"}
                                            </div>
                                            
                                            <div className="mt-3 text-[13px] text-gray-600 leading-relaxed bg-[var(--background)] px-4 py-3 rounded-lg border border-[var(--border)]">
                                                <p className="line-clamp-4 hover:line-clamp-none transition-all">{article.summary}</p>
                                            </div>
                                            
                                            <div className="mt-4 flex gap-3 flex-wrap">
                                                <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black uppercase tracking-widest text-[var(--foreground)] bg-[var(--background)] hover:bg-[var(--foreground)] hover:text-white px-4 py-2 rounded-lg transition-colors border border-[var(--border)] flex items-center gap-2 shadow-sm">
                                                    <IconExternalLink className="w-3.5 h-3.5" /> View on arXiv
                                                </a>
                                                {article.url && (
                                                    <>
                                                        <a href={article.url.replace('/abs/', '/pdf/')} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black uppercase tracking-widest text-[var(--foreground)] bg-[var(--background)] hover:bg-[var(--foreground)] hover:text-white px-4 py-2 rounded-lg transition-colors border border-[var(--border)] flex items-center gap-2 shadow-sm">
                                                            <IconFileText className="w-3.5 h-3.5" /> PDF
                                                        </a>
                                                        <a href={article.url.replace('/abs/', '/e-print/')} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black uppercase tracking-widest text-[var(--foreground)] bg-[var(--background)] hover:bg-[var(--foreground)] hover:text-white px-4 py-2 rounded-lg transition-colors border border-[var(--border)] flex items-center gap-2 shadow-sm">
                                                            <IconCode className="w-3.5 h-3.5" /> LaTeX Source
                                                        </a>
                                                    </>
                                                )}
                                                {article.doi && (
                                                    <a href={`https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black uppercase tracking-widest text-[var(--foreground)] bg-[var(--background)] hover:bg-[var(--foreground)] hover:text-white px-4 py-2 rounded-lg transition-colors border border-[var(--border)] flex items-center gap-2 shadow-sm">
                                                        <IconBook2 className="w-3.5 h-3.5" /> DOI
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
