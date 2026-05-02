"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconArrowUp, IconLoader2, IconCode, IconX,
    IconCopy, IconCheck, IconRefresh, IconDownload,
    IconPaperclip, IconFile, IconSparkles, IconMaximize,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import RSidebar from "../RSidebar";
import type { RSessionRow, RSessionSummary, RResultItem } from "@/lib/r-db";

// ── Chart catalogue ─────────────────────────────────────────────────────────

interface ChartEntry {
    id: string;
    name: string;
    tag: string;
    preview: string;
}

const CHARTS: ChartEntry[] = [
    // Distribution
    { id: "violin",          name: "Violin",           tag: "Distribution",  preview: "" },
    { id: "density",         name: "Density",          tag: "Distribution",  preview: "" },
    { id: "histogram",       name: "Histogram",        tag: "Distribution",  preview: "" },
    { id: "boxplot",         name: "Box Plot",         tag: "Distribution",  preview: "" },
    { id: "ridgeline",       name: "Ridgeline",        tag: "Distribution",  preview: "" },
    { id: "beeswarm",        name: "Beeswarm",         tag: "Distribution",  preview: "" },
    // Correlation
    { id: "scatter",         name: "Scatter",          tag: "Correlation",   preview: "" },
    { id: "heatmap",         name: "Heatmap",          tag: "Correlation",   preview: "" },
    { id: "correlogram",     name: "Correlogram",      tag: "Correlation",   preview: "" },
    { id: "bubble",          name: "Bubble",           tag: "Correlation",   preview: "" },
    { id: "connected_scatter", name: "Connected Scatter", tag: "Correlation", preview: "" },
    { id: "density2d",       name: "2D Density",       tag: "Correlation",   preview: "" },
    // Ranking
    { id: "bar",             name: "Barplot",          tag: "Ranking",       preview: "" },
    { id: "radar",           name: "Spider / Radar",   tag: "Ranking",       preview: "" },
    { id: "wordcloud",       name: "Word Cloud",       tag: "Ranking",       preview: "" },
    { id: "parallel",        name: "Parallel",         tag: "Ranking",       preview: "" },
    { id: "lollipop",        name: "Lollipop",         tag: "Ranking",       preview: "" },
    { id: "circular_barplot", name: "Circular Bar",    tag: "Ranking",       preview: "" },
    // Part of a whole
    { id: "grouped_bar",     name: "Grouped Bar",      tag: "Part-to-Whole", preview: "" },
    { id: "stacked_bar",     name: "Stacked Bar",      tag: "Part-to-Whole", preview: "" },
    { id: "treemap",         name: "Treemap",          tag: "Part-to-Whole", preview: "" },
    { id: "doughnut",        name: "Doughnut",         tag: "Part-to-Whole", preview: "" },
    { id: "pie",             name: "Pie Chart",        tag: "Part-to-Whole", preview: "" },
    { id: "dendrogram",      name: "Dendrogram",       tag: "Part-to-Whole", preview: "" },
    { id: "circlepack",      name: "Circle Pack",      tag: "Part-to-Whole", preview: "" },
    { id: "waffle",          name: "Waffle",           tag: "Part-to-Whole", preview: "" },
    // Evolution
    { id: "line",            name: "Line Plot",        tag: "Evolution",     preview: "" },
    { id: "area",            name: "Area",             tag: "Evolution",     preview: "" },
    { id: "stacked_area",    name: "Stacked Area",     tag: "Evolution",     preview: "" },
    { id: "streamchart",     name: "Streamchart",      tag: "Evolution",     preview: "" },
    { id: "timeseries",      name: "Time Series",      tag: "Evolution",     preview: "" },
    // Map
    { id: "choropleth",      name: "Choropleth",       tag: "Map",           preview: "" },
    { id: "hexbin_map",      name: "Hexbin Map",       tag: "Map",           preview: "" },
    { id: "cartogram",       name: "Cartogram",        tag: "Map",           preview: "" },
    { id: "connection_map",  name: "Connection Map",   tag: "Map",           preview: "" },
    { id: "bubble_map",      name: "Bubble Map",       tag: "Map",           preview: "" },
    // Flow
    { id: "chord",           name: "Chord",            tag: "Flow",          preview: "" },
    { id: "network",         name: "Network",          tag: "Flow",          preview: "" },
    { id: "sankey",          name: "Sankey",           tag: "Flow",          preview: "" },
    { id: "arc_diagram",     name: "Arc Diagram",      tag: "Flow",          preview: "" },
    { id: "edge_bundling",   name: "Edge Bundling",    tag: "Flow",          preview: "" },
    // Other
    { id: "dumbbell",        name: "Dumbbell",         tag: "Change",        preview: "" },
    { id: "marginal",        name: "Marginal",         tag: "Correlation",   preview: "" },
    { id: "3d_scatter",      name: "3D Scatter",       tag: "3D",            preview: "" },
    { id: "3d_surface",      name: "3D Surface",       tag: "3D",            preview: "" },
];

// ── Multi result card ─────────────────────────────────────────────────────────

interface GeneratedChart {
    chartType: string;
    name: string;
    image: string;
    code: string;
    status: "pending" | "generating" | "done" | "error";
    error?: string;
}

function MultiChartCard({
    chart,
    index,
    onRetry,
}: {
    chart: GeneratedChart;
    index: number;
    onRetry: (index: number, chartType: string) => void;
}) {
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const handleCopy = () => {
        if (!chart.code) return;
        navigator.clipboard.writeText(chart.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const handleDownload = () => {
        if (!chart.image) return;
        const a = document.createElement("a");
        a.href = `data:image/png;base64,${chart.image}`;
        a.download = `r-${chart.chartType || "plot"}.png`;
        a.click();
    };

    return (
        <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden flex flex-col">
            {/* Image area */}
            <div className="relative bg-[#FAFAFA] border-b border-[#f0f0f0] min-h-[180px] flex items-center justify-center group">
                {chart.status === "generating" && (
                    <div className="flex flex-col items-center gap-2 py-8">
                        <div className="w-8 h-8 rounded-full bg-white border border-[#e8e8e8] shadow-sm flex items-center justify-center">
                            <IconLoader2 className="w-3.5 h-3.5 animate-spin text-[#1a1a1a]" />
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium">Running R…</p>
                    </div>
                )}
                {chart.status === "error" && (
                    <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
                        <p className="text-[11px] text-red-400 font-medium leading-snug">{chart.error || "Generation failed."}</p>
                        <button
                            onClick={() => onRetry(index, chart.chartType)}
                            className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-400 hover:text-[#1a1a1a] transition-colors"
                        >
                            <IconRefresh className="w-3 h-3" /> Retry
                        </button>
                    </div>
                )}
                {chart.status === "done" && chart.image && (
                    <>
                        <img
                            src={`data:image/png;base64,${chart.image}`}
                            alt={chart.name}
                            className="max-w-full max-h-[280px] object-contain p-3 cursor-zoom-in"
                            onClick={() => setExpanded(true)}
                        />
                        <button
                            onClick={() => setExpanded(true)}
                            className="absolute top-2 right-2 p-1 bg-white/80 hover:bg-white rounded-lg border border-[#e8e8e8] text-gray-400 hover:text-[#1a1a1a] transition-all opacity-0 group-hover:opacity-100"
                            title="Expand"
                        >
                            <IconMaximize className="w-3 h-3" />
                        </button>
                    </>
                )}
            </div>

            {/* Card footer */}
            <div className="px-3 py-2 flex-1 flex flex-col gap-1.5">
                <p className="text-[11px] font-bold text-[#1a1a1a]">{chart.name}</p>

                {chart.status === "done" && (
                    <div className="flex items-center gap-1 flex-wrap">
                        <button
                            onClick={() => setShowCode(v => !v)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all
                                ${showCode ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "border-[#ebebeb] text-gray-400 hover:border-[#aaa] hover:text-[#1a1a1a]"}`}
                        >
                            <IconCode className="w-3 h-3" />
                            Code
                        </button>
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border border-[#ebebeb] text-gray-400 hover:border-[#aaa] hover:text-[#1a1a1a] transition-all"
                        >
                            <IconDownload className="w-3 h-3" />
                            PNG
                        </button>
                        <button
                            onClick={() => onRetry(index, chart.chartType)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border border-[#ebebeb] text-gray-400 hover:border-[#aaa] hover:text-[#1a1a1a] transition-all"
                        >
                            <IconRefresh className="w-3 h-3" />
                            Retry
                        </button>
                    </div>
                )}
            </div>

            {/* Collapsible code panel */}
            <AnimatePresence>
                {showCode && chart.code && (
                    <motion.div
                        key="code"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-[#f0f0f0]"
                    >
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#f8f8f8] border-b border-[#eeeeee]">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">R Code</span>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-[#1a1a1a] transition-colors uppercase tracking-wide"
                            >
                                {copied
                                    ? <><IconCheck className="w-3 h-3 text-green-500" /> Copied</>
                                    : <><IconCopy className="w-3 h-3" /> Copy</>
                                }
                            </button>
                        </div>
                        <pre className="px-4 py-3 text-[11px] leading-relaxed overflow-x-auto font-mono text-[#1a1a1a] bg-[#f8f8f8] max-h-[260px] thin-scrollbar whitespace-pre-wrap">
                            {chart.code}
                        </pre>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expanded image lightbox */}
            <AnimatePresence>
                {expanded && chart.image && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
                        onClick={() => setExpanded(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.92 }}
                            className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#f0f0f0]">
                                <span className="text-[11px] font-bold text-[#1a1a1a]">{chart.name}</span>
                                <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-[#1a1a1a] transition-colors">
                                    <IconX className="w-4 h-4" />
                                </button>
                            </div>
                            <img
                                src={`data:image/png;base64,${chart.image}`}
                                alt={chart.name}
                                className="w-full object-contain max-h-[80vh]"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
    initialSession: RSessionRow;
    sessions: RSessionSummary[];
    userId: number;
}

export default function RSessionClient({ initialSession, sessions: initialSessions, userId }: Props) {
    const router = useRouter();

    // Parse results from session
    const [multiResults, setMultiResults] = useState<GeneratedChart[]>(() => {
        try {
            const results: RResultItem[] = JSON.parse(initialSession.results_json || '[]');
            return results.map(r => ({
                chartType: r.chartType,
                name: r.name,
                image: r.image,
                code: r.code,
                status: r.status,
                error: r.error,
            }));
        } catch {
            return [];
        }
    });

    const [sessions, setSessions] = useState<RSessionSummary[]>(initialSessions);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [multiLoading, setMultiLoading] = useState(initialSession.status === 'generating');
    const [elapsed, setElapsed] = useState(0);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const currentSessionId = initialSession.id;

    // ── Stop polling helper ──
    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    }, []);

    // ── Poll session until done ──
    const pollSession = useCallback((sessionId: string, startedAt?: number) => {
        stopPolling();
        const startTime = startedAt ?? Date.now();
        setElapsed((Date.now() - startTime) / 1000);
        elapsedRef.current = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 100);

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/r/sessions/${sessionId}`);
                if (!res.ok) return;
                const data = await res.json();
                const s = data.session;

                const results: GeneratedChart[] = (s.results ?? []).map((r: any) => ({
                    chartType: r.chartType,
                    name: r.name || r.chartType.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    image: r.image ?? "",
                    code: r.code ?? "",
                    status: r.status ?? "done",
                    error: r.error,
                }));

                setMultiResults(results);

                if (s.status === "done" || s.status === "error") {
                    stopPolling();
                    setMultiLoading(false);
                }
            } catch { /* ignore transient errors */ }
        }, 2500);
    }, [stopPolling]);

    // Start polling if session is generating
    useEffect(() => {
        if (initialSession.status === 'generating') {
            pollSession(currentSessionId, new Date(initialSession.created_at).getTime());
        }
        return () => stopPolling();
    }, [currentSessionId, initialSession.status, initialSession.created_at, pollSession, stopPolling]);

    // Retry a single chart
    const retryMultiChart = async (index: number, chartType: string) => {
        // This would need implementation - for now just a placeholder
        console.log('Retry chart:', index, chartType);
    };

    const loadSession = (id: string) => {
        router.push(`/r/${id}`);
    };

    const handleNewSession = () => {
        router.push('/r');
    };

    const chartsPlanned = multiResults.map(r => r.chartType);

    return (
        <div className="h-full relative flex flex-col bg-[#F9F9F9]">
            <RSidebar
                open={sidebarOpen}
                onToggle={() => setSidebarOpen(v => !v)}
                activeSessionId={currentSessionId}
                refreshTrigger={0}
                onSelectSession={loadSession}
                onNewSession={handleNewSession}
            />

            {/* ── Page header ── */}
            <div className="max-w-3xl mx-auto w-full px-5 pt-10 pb-2 shrink-0">
                <div className="flex items-end gap-4">
                    {/* Spacer for hamburger when sidebar closed */}
                    <div className="w-8 shrink-0" />
                    <div>
                        <p className="text-[11px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-1 font-mono">R Studio</p>
                        <h1 className="text-[28px] md:text-[34px] font-black text-[#1a1a1a] tracking-tight leading-none">
                            {initialSession.title}
                        </h1>
                    </div>
                </div>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <main className="max-w-3xl mx-auto w-full px-5 pt-6 space-y-6 pb-6">

                    {/* ── Multi: stepper + results ── */}
                    <AnimatePresence mode="popLayout">
                        {(multiLoading || multiResults.length > 0) && (
                            <motion.div
                                key="multi"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                className="space-y-4"
                            >
                                {/* ── Progress card (while polling) ── */}
                                {multiLoading && (() => {
                                    const done = multiResults.filter(c => c.status === "done").length;
                                    const total = chartsPlanned.length || multiResults.length;
                                    const pct = total > 0 ? (done / total) * 100 : 0;
                                    return (
                                        <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 shadow-sm">
                                            <div className="flex items-center gap-3 mb-4">
                                                <IconLoader2 className="w-4 h-4 animate-spin text-[#1a1a1a] shrink-0" />
                                                <p className="text-[13px] font-bold text-[#1a1a1a] flex-1">
                                                    {done === 0 ? "Generating visualizations…" : `${done} of ${total} charts ready`}
                                                </p>
                                                <span className="text-[11px] font-mono text-gray-300 tabular-nums shrink-0">
                                                    {elapsed.toFixed(1)}s
                                                </span>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="w-full bg-[#f5f5f5] h-1 rounded-full overflow-hidden mb-4">
                                                <motion.div
                                                    className="h-full bg-[#1a1a1a] rounded-full"
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                                />
                                            </div>

                                            {/* Per-chart status list */}
                                            {(multiResults.length > 0 || chartsPlanned.length > 0) && (
                                                <div className="space-y-1">
                                                    {(chartsPlanned.length > 0 ? chartsPlanned : multiResults.map(c => c.chartType)).map((ct, i) => {
                                                        const res = multiResults[i];
                                                        const status = res?.status ?? "pending";
                                                        const name = (res?.name) || ct.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
                                                        return (
                                                            <div key={i} className="flex items-center gap-2.5 px-1">
                                                                <div className="shrink-0 w-4 flex justify-center">
                                                                    {status === "generating" && <IconLoader2 className="w-3 h-3 animate-spin text-gray-400" />}
                                                                    {status === "done" && <IconCheck className="w-3 h-3 text-[#1a1a1a]" stroke={2.5} />}
                                                                    {status === "error" && <IconX className="w-3 h-3 text-red-400" />}
                                                                    {status === "pending" && <div className="w-2 h-2 rounded-full bg-[#e0e0e0]" />}
                                                                </div>
                                                                <p className={`text-[11px] font-medium flex-1 ${status === "done" ? "text-[#1a1a1a]" : "text-gray-400"}`}>
                                                                    {name}
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ── Header when done ── */}
                                {!multiLoading && multiResults.length > 0 && (
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.18em]">
                                            {multiResults.filter(c => c.status === "done").length} charts · {elapsed.toFixed(1)}s
                                        </p>
                                    </div>
                                )}

                                {/* ── Results grid ── */}
                                {multiResults.some(c => c.status === "done") && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {multiResults.filter(c => c.status === "done").map((chart, i) => (
                                            <MultiChartCard
                                                key={`done-${i}`}
                                                chart={chart}
                                                index={multiResults.indexOf(chart)}
                                                onRetry={retryMultiChart}
                                            />
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                </main>
            </div>
        </div>
    );
}
