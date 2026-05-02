"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconArrowUp, IconLoader2, IconCode, IconX,
    IconCopy, IconCheck, IconRefresh, IconDownload,
    IconPaperclip, IconFile, IconSparkles, IconMaximize,
} from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";
import { useRouter } from "next/navigation";
import RSidebar from "./RSidebar";

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

const SERVER_EXTRACT_EXTS = ["pdf", "doc", "docx", "ppt", "pptx"];
const CLIENT_TEXT_EXTS = ["csv", "tsv", "txt", "md", "json"];
const CLIENT_EXCEL_EXTS = ["xlsx", "xls"];

// ── Encode ArrayBuffer → base64 ───────────────────────────────────────────
function bufToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

// ── Read file: client-side for text/Excel, server-side for PDF/Office ────────
async function readFileAsContext(file: File): Promise<{ content: string; rFileName?: string; fileData?: string; images?: string[] }> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (CLIENT_TEXT_EXTS.includes(ext)) {
        const MAX_BYTES = 10 * 1024 * 1024;
        const buf = await file.arrayBuffer();
        const safeBuf = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
        const raw = new TextDecoder().decode(safeBuf);

        if (ext === "csv" || ext === "tsv") {
            const sep = ext === "tsv" ? "\t" : ",";
            const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
            const header = lines[0] ?? "";
            const totalRows = lines.length - 1;
            const sample = lines.slice(1, 4).join("\n");
            // Schema snippet — just enough for LLM to know columns & types
            const content = [
                `FILE: "${file.name}" — ${totalRows} rows`,
                `COLUMNS: ${header.split(sep).join(" | ")}`,
                `SAMPLE (3 rows):\n${sample}`,
            ].join("\n");
            return { content, fileData: bufToBase64(safeBuf), rFileName: file.name };
        }

        // Plain text / JSON / MD
        const lines = raw.split("\n");
        return { content: lines.length > 800 ? lines.slice(0, 800).join("\n") : raw };
    }

    if (CLIENT_EXCEL_EXTS.includes(ext)) {
        try {
            const { read, utils } = await import("xlsx");
            const buf = await file.arrayBuffer();
            const wb = read(buf);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const csv = utils.sheet_to_csv(ws);
            const lines = csv.split("\n").map(l => l.trim()).filter(Boolean);
            const header = lines[0] ?? "";
            const totalRows = lines.length - 1;
            const sample = lines.slice(1, 4).join("\n");
            const rFileName = file.name.replace(/\.[^.]+$/, ".csv");
            const content = [
                `FILE: "${rFileName}" — ${totalRows} rows (converted from Excel)`,
                `COLUMNS: ${header.split(",").join(" | ")}`,
                `SAMPLE (3 rows):\n${sample}`,
            ].join("\n");
            // Encode CSV text (not raw Excel) so R can read it with read.csv()
            const csvBuf = new TextEncoder().encode(csv).buffer;
            return { content, fileData: bufToBase64(csvBuf), rFileName };
        } catch {
            return { content: "[Excel parsing failed — please convert to CSV]" };
        }
    }

    if (SERVER_EXTRACT_EXTS.includes(ext)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/r/upload", { method: "POST", body: form });
        if (!res.ok) return { content: `[Failed to extract ${file.name}]` };
        const data = await res.json();
        return { content: data.content ?? "", images: data.images ?? [] };
    }

    return { content: "" };
}

// ── Chart card ────────────────────────────────────────────────────────────────

function ChartCard({
    chart, selected, suggested, onClick,
}: {
    chart: ChartEntry; selected: boolean; suggested: boolean; onClick: () => void;
}) {
    const [imgError, setImgError] = useState(false);
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`relative group text-left rounded-xl border transition-all duration-150 overflow-visible
                ${selected
                    ? "border-[#1a1a1a] bg-[#1a1a1a] shadow-sm"
                    : suggested
                        ? "border-[#1a1a1a] bg-[#f8f8f8] shadow-sm ring-1 ring-[#1a1a1a]/20"
                        : "border-[#ebebeb] bg-white hover:border-[#aaa] hover:shadow-sm"
                }`}
        >
            {/* Hover preview */}
            <AnimatePresence>
                {hovered && !selected && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.14 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 pointer-events-none
                                   w-48 h-32 rounded-xl overflow-hidden shadow-xl border border-[#e8e8e8] bg-white"
                    >
                        {chart.preview && !imgError ? (
                            <img
                                src={chart.preview}
                                alt={chart.name}
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#f8f8f8]">
                                <span className="text-[10px] text-gray-300 font-medium">{chart.name}</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="px-3 py-2.5">
                <p className={`text-[11px] font-bold leading-tight ${selected ? "text-white" : "text-[#1a1a1a]"}`}>
                    {chart.name}
                </p>
                <p className={`text-[10px] mt-0.5 font-medium ${selected ? "text-gray-300" : suggested ? "text-[#555]" : "text-gray-400"}`}>
                    {suggested && !selected ? "✦ AI pick" : chart.tag}
                </p>
            </div>
        </button>
    );
}

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
            <div className="relative bg-[#FAFAFA] border-b border-[#f0f0f0] min-h-[180px] flex items-center justify-center">
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

// ── Main ──────────────────────────────────────────────────────────────────────

interface AttachedFile {
    name: string;
    content: string;       // schema snippet for LLM context
    rFileName?: string;    // filename R will use (may differ for Excel→CSV)
    fileData?: string;     // base64 of full file for R compiler
    images?: string[];
    size: number;
}

export default function RPage() {
    const { user, setShowLogin } = useAdmin();
    const router = useRouter();

    const [prompt, setPrompt] = useState("");
    const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const [uploading, setUploading] = useState(false);

    // Suggest state
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedCharts, setSuggestedCharts] = useState<string[]>([]);
    const [suggestReasoning, setSuggestReasoning] = useState("");

    // Single generation states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Single result
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [resultCode, setResultCode] = useState("");
    const [resultChartType, setResultChartType] = useState("");
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

    // Multi generation state
    const [multiResults, setMultiResults] = useState<GeneratedChart[]>([]);
    const [multiLoading, setMultiLoading] = useState(false);
    const [multiError, setMultiError] = useState<string | null>(null);
    const [chartsPlanned, setChartsPlanned] = useState<string[]>([]);

    // Elapsed timer
    const [elapsed, setElapsed] = useState(0);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Polling ref for background session
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sidebar + session state
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [sidebarRefresh, setSidebarRefresh] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-grow textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }, [prompt]);

    // ── File handling ──
    const handleFiles = async (rawFiles: FileList | File[]) => {
        if (!user) { setShowLogin(true); return; }
        setUploading(true);
        const arr = Array.from(rawFiles);
        const results: AttachedFile[] = [];

        for (const f of arr) {
            const { content, rFileName, fileData, images } = await readFileAsContext(f);
            if (content || images?.length) {
                results.push({ name: f.name, content, rFileName, fileData, images, size: f.size });
            }
        }

        setFiles(prev => [...prev, ...results]);
        setUploading(false);
    };

    const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

    // ── Suggest chart types (called when files attached + no chart selected) ──
    const suggestCharts = useCallback(async (): Promise<string> => {
        if (!files.length) return selectedCharts[0] ?? "";
        setSuggesting(true);
        try {
            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "suggest",
                    prompt,
                    contextFiles: files.map(f => ({ name: f.name, content: f.content, rFileName: f.rFileName, fileData: f.fileData, images: f.images ?? [] })),
                }),
            });
            if (!res.ok) return "";
            const data = await res.json();
            const charts: string[] = data.charts ?? [];
            setSuggestedCharts(charts);
            setSuggestReasoning(data.reasoning ?? "");
            return charts[0] ?? "";
        } catch {
            return "";
        } finally {
            setSuggesting(false);
        }
    }, [prompt, files, selectedCharts]);

    // ── Stop polling helper ──
    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    }, []);

    // ── Poll a session until done ──
    // startedAt: epoch ms of session creation — timer counts from there so reloads don't reset it
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
                    setSidebarRefresh(n => n + 1);
                    if (s.status === "error" && results.length === 0) {
                        setMultiError("Generation failed. Please try again.");
                    }
                }
            } catch { /* ignore transient errors */ }
        }, 2500);
    }, [stopPolling]);

    // ── Multi polling flow ──
    const runMulti = useCallback(async () => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;

        setMultiLoading(true);
        setMultiError(null);
        setMultiResults([]);
        setChartsPlanned([]);
        setElapsed(0);
        setResultImage(null);
        setResultCode("");
        setError(null);
        stopPolling();

        try {
            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "multi",
                    prompt,
                    contextFiles: files.map(f => ({ name: f.name, content: f.content, rFileName: f.rFileName, fileData: f.fileData, images: f.images ?? [] })),
                    ...(selectedCharts.length > 0 ? { chartTypes: selectedCharts } : {}),
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setMultiError(res.status === 402 ? "Quota reached. Please top up your balance." : data.error || `HTTP ${res.status}`);
                setMultiLoading(false);
                return;
            }

            const { sessionId, chartsPlanned: planned = [] } = data;
            
            // Redirect to session page immediately
            router.push(`/r/${sessionId}`);

        } catch (e: any) {
            setMultiError(e.message || "Multi-generation failed.");
            setMultiLoading(false);
        }
    }, [user, prompt, files, selectedCharts, setShowLogin, stopPolling, pollSession]);

    // Retry a single chart within multi results
    const retryMultiChart = useCallback(async (index: number, chartType: string) => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;

        setMultiResults(prev => prev.map((c, i) =>
            i === index ? { ...c, status: "generating", error: undefined } : c
        ));

        try {
            const body: any = {
                action: "generate",
                prompt,
                chartType,
                contextFiles: files.map(f => ({ name: f.name, content: f.content, rFileName: f.rFileName, fileData: f.fileData, images: f.images ?? [] })),
            };

            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) {
                setMultiResults(prev => prev.map((c, i) =>
                    i === index ? { ...c, status: "error", error: data.error || `HTTP ${res.status}` } : c
                ));
                return;
            }

            const name = (data.chartType || chartType).replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
            setMultiResults(prev => prev.map((c, i) =>
                i === index ? { ...c, chartType: data.chartType || chartType, name, image: data.image, code: data.code, status: "done", error: undefined } : c
            ));
        } catch (e: any) {
            setMultiResults(prev => prev.map((c, i) =>
                i === index ? { ...c, status: "error", error: e.message || "Retry failed." } : c
            ));
        }
    }, [user, prompt, files, setShowLogin]);

    // ── Generate (single) ──
    const generate = useCallback(async (retryWithError = false, chartOverride?: string) => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;

        // 2+ charts selected, or no chart selected + files → use multi flow
        if (!retryWithError && !chartOverride && (selectedCharts.length >= 2 || (selectedCharts.length === 0 && files.length > 0))) {
            await runMulti();
            return;
        }

        // Single chart: use selection or ask AI
        let chartToUse = chartOverride ?? selectedCharts[0] ?? "";
        if (!retryWithError && files.length > 0 && !chartToUse) {
            chartToUse = await suggestCharts();
        }

        setLoading(true);
        setError(null);
        // Clear multi results when running single
        setMultiResults([]);
        setMultiError(null);
        if (!retryWithError) {
            setResultImage(null);
            setResultCode("");
            setResultChartType("");
        }

        try {
            const body: any = {
                action: "generate",
                prompt,
                chartType: chartToUse,
                contextFiles: files.map(f => ({ name: f.name, content: f.content, rFileName: f.rFileName, fileData: f.fileData, images: f.images ?? [] })),
            };

            if (retryWithError && resultCode) {
                body.previousCode = resultCode;
                body.previousError = error;
            }

            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 402) {
                    setError("Quota reached. Please top up your balance.");
                    if (data.code) setResultCode(data.code);
                    return;
                }
                if (res.status === 422 && data.code) {
                    setResultCode(data.code);
                    setError(data.error || "R execution failed.");
                    return;
                }
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            // Redirect to session page
            if (data.sessionId) {
                router.push(`/r/${data.sessionId}`);
            }
        } catch (e: any) {
            setError(e.message || "Generation failed.");
        } finally {
            setLoading(false);
        }
    }, [user, prompt, selectedCharts, files, resultCode, error, setShowLogin, suggestCharts, runMulti]);

    const handleRetry = () => generate(true);

    const handleNew = () => {
        setResultImage(null);
        setResultCode("");
        setError(null);
        setShowCode(false);
        setPrompt("");
        setSelectedCharts([]);
        setSuggestedCharts([]);
        setSuggestReasoning("");
        setMultiResults([]);
        setMultiError(null);
        setActiveSessionId(null);
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

    const loadSession = useCallback((id: string) => {
        router.push(`/r/${id}`);
    }, [router]);

    const handleCopy = () => {
        if (!resultCode) return;
        navigator.clipboard.writeText(resultCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const handleDownload = () => {
        if (!resultImage) return;
        const a = document.createElement("a");
        a.href = resultImage;
        a.download = `r-${resultChartType || "plot"}.png`;
        a.click();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    };

    // Determine whether submit will trigger multi
    const willRunMulti = selectedCharts.length >= 2 || (selectedCharts.length === 0 && files.length > 0);

    return (
        <div className="h-full relative flex flex-col bg-[#F9F9F9]" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>

            <RSidebar
                open={sidebarOpen}
                onToggle={() => setSidebarOpen(v => !v)}
                activeSessionId={activeSessionId}
                refreshTrigger={sidebarRefresh}
                onSelectSession={loadSession}
                onNewSession={handleNew}
            />

            {/* ── Page header ── */}
            <div className="max-w-3xl mx-auto w-full px-5 pt-10 pb-2 shrink-0">
                <div className="flex items-end gap-4">
                    {/* Spacer for hamburger when sidebar closed */}
                    <div className="w-8 shrink-0" />
                    <div>
                        <p className="text-[11px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-1 font-mono">R Studio</p>
                        <h1 className="text-[28px] md:text-[34px] font-black text-[#1a1a1a] tracking-tight leading-none">
                            Statistical Visualization
                        </h1>
                    </div>
                </div>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <main className="max-w-3xl mx-auto w-full px-5 pt-6 space-y-6 pb-6">

                {/* ── Chart gallery (first) ── */}
                <section className="pb-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.18em]">
                            Chart Types · {CHARTS.length} available
                        </p>
                        {(selectedCharts.length > 0 || suggestedCharts.length > 0) && (
                            <button
                                onClick={() => { setSelectedCharts([]); setSuggestedCharts([]); setSuggestReasoning(""); }}
                                className="text-[11px] text-gray-400 hover:text-[#1a1a1a] font-medium transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* AI reasoning banner */}
                    <AnimatePresence>
                        {suggestReasoning && suggestedCharts.length > 0 && !loading && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-start gap-2 px-3 py-2 mb-3 bg-[#f5f5f5] rounded-xl border border-[#e8e8e8]"
                            >
                                <IconSparkles className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-gray-500 leading-snug">{suggestReasoning}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        {CHARTS.map(chart => (
                            <ChartCard
                                key={chart.id}
                                chart={chart}
                                selected={selectedCharts.includes(chart.id)}
                                suggested={suggestedCharts.includes(chart.id) && !selectedCharts.includes(chart.id)}
                                onClick={() => {
                                    setSelectedCharts(prev =>
                                        prev.includes(chart.id)
                                            ? prev.filter(c => c !== chart.id)
                                            : [...prev, chart.id]
                                    );
                                    setSuggestedCharts([]);
                                    setSuggestReasoning("");
                                }}
                            />
                        ))}
                    </div>

                    <p className="text-[10px] text-gray-300 mt-3 font-medium">
                        Hover to preview · click to select · attach CSV, Excel, PDF or Word for real-data plots
                    </p>
                </section>

                {/* ── Single error banner ── */}
                <AnimatePresence>
                    {error && !loading && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-start gap-3 px-4 py-3 bg-white border border-red-100 rounded-2xl
                                       text-[13px] text-red-500 shadow-sm"
                        >
                            <span className="flex-1 leading-snug">{error}</span>
                            <div className="flex items-center gap-2 shrink-0">
                                {resultCode && (
                                    <button
                                        onClick={handleRetry}
                                        className="text-[11px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wide"
                                    >
                                        Retry
                                    </button>
                                )}
                                <button onClick={() => setError(null)} className="text-red-300 hover:text-red-500 transition-colors">
                                    <IconX className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Multi error banner ── */}
                <AnimatePresence>
                    {multiError && !multiLoading && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-start gap-3 px-4 py-3 bg-white border border-red-100 rounded-2xl
                                       text-[13px] text-red-500 shadow-sm"
                        >
                            <span className="flex-1 leading-snug">{multiError}</span>
                            <button onClick={() => setMultiError(null)} className="text-red-300 hover:text-red-500 transition-colors">
                                <IconX className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Single result panel ── */}
                <AnimatePresence mode="popLayout">
                    {(loading || resultImage) && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden"
                        >
                            {/* Image */}
                            <div className="min-h-[280px] flex items-center justify-center bg-[#FAFAFA] border-b border-[#f0f0f0]">
                                {loading && !resultImage ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white border border-[#e8e8e8] shadow-sm
                                                        flex items-center justify-center">
                                            <IconLoader2 className="w-4 h-4 animate-spin text-[#1a1a1a]" />
                                        </div>
                                        <p className="text-[12px] text-gray-400 font-medium">
                                            {suggesting ? "Analysing data…" : "Running R…"}
                                        </p>
                                    </div>
                                ) : resultImage ? (
                                    <img
                                        src={resultImage}
                                        alt="R visualization"
                                        className="max-w-full max-h-[520px] object-contain p-4"
                                    />
                                ) : null}
                            </div>

                            {/* Toolbar */}
                            {resultImage && (
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setShowCode(v => !v)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold
                                                        uppercase tracking-wide transition-all border
                                                        ${showCode
                                                            ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                                                            : "text-gray-400 border-[#ebebeb] hover:border-[#aaa] hover:text-[#1a1a1a]"}`}
                                        >
                                            <IconCode className="w-3.5 h-3.5" />
                                            Code
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold
                                                       uppercase tracking-wide border border-[#ebebeb] text-gray-400
                                                       hover:border-[#aaa] hover:text-[#1a1a1a] transition-all"
                                        >
                                            <IconDownload className="w-3.5 h-3.5" />
                                            PNG
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={handleRetry}
                                            disabled={loading}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold
                                                       uppercase tracking-wide border border-[#ebebeb] text-gray-400
                                                       hover:border-[#aaa] hover:text-[#1a1a1a] transition-all disabled:opacity-30"
                                        >
                                            <IconRefresh className="w-3.5 h-3.5" />
                                            Retry
                                        </button>
                                        <button
                                            onClick={handleNew}
                                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide
                                                       bg-[#1a1a1a] text-white hover:bg-black transition-all"
                                        >
                                            New
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Code panel */}
                            <AnimatePresence>
                                {showCode && resultCode && (
                                    <motion.div
                                        key="code"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden border-t border-[#f0f0f0]"
                                    >
                                        <div className="flex items-center justify-between px-4 py-2 bg-[#f8f8f8] border-b border-[#eeeeee]">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">R Code</span>
                                            <button
                                                onClick={handleCopy}
                                                className="flex items-center gap-1 text-[10px] font-bold text-gray-400
                                                           hover:text-[#1a1a1a] transition-colors uppercase tracking-wide"
                                            >
                                                {copied
                                                    ? <><IconCheck className="w-3.5 h-3.5 text-green-500" /> Copied</>
                                                    : <><IconCopy className="w-3.5 h-3.5" /> Copy</>
                                                }
                                            </button>
                                        </div>
                                        <pre className="px-5 py-4 text-[12px] leading-relaxed overflow-x-auto font-mono
                                                        text-[#1a1a1a] bg-[#f8f8f8] max-h-[360px] thin-scrollbar whitespace-pre-wrap">
                                            {resultCode}
                                        </pre>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                                    <button onClick={handleNew} className="text-[11px] text-gray-400 hover:text-[#1a1a1a] font-medium transition-colors">
                                        Clear
                                    </button>
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

            {/* ── Bottom input (sticky) ── */}
            <div className="shrink-0 bg-[#F9F9F9]/95 backdrop-blur-sm border-t border-[#f0f0f0] pt-3 pb-[76px] md:pb-4">
                <div className="max-w-3xl mx-auto w-full px-5">
                    <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm">
                        {/* Textarea */}
                        <div className="px-4 pt-4 pb-2">
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && !e.shiftKey && !loading && !multiLoading) {
                                        e.preventDefault();
                                        generate();
                                    }
                                }}
                                placeholder="Describe the visualization — topic, data shape, or insight…"
                                className="w-full text-[14px] leading-relaxed text-[#1a1a1a] bg-transparent outline-none
                                           placeholder:text-[#bbb] resize-none min-h-[52px]"
                                autoFocus
                            />
                        </div>

                        {/* Attached files row */}
                        {(files.length > 0 || uploading) && (
                            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                                {files.map((f, i) => (
                                    <span
                                        key={i}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f3f3f3] rounded-lg
                                                   text-[11px] font-medium text-[#444] border border-[#e8e8e8]"
                                    >
                                        <IconFile className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="truncate max-w-[120px]">{f.name}</span>
                                        <button
                                            onClick={() => removeFile(i)}
                                            className="text-gray-300 hover:text-gray-600 transition-colors"
                                        >
                                            <IconX className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                {uploading && (
                                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f3f3f3] rounded-lg text-[11px] text-gray-400">
                                        <IconLoader2 className="w-3 h-3 animate-spin" />
                                        Reading…
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                            <div className="flex items-center gap-1 flex-wrap">
                                {/* Attach */}
                                <label className="cursor-pointer p-1.5 text-gray-400 hover:text-[#1a1a1a] rounded-lg
                                                  hover:bg-[#f5f5f5] transition-colors" title="Attach CSV / Excel">
                                    <IconPaperclip className="w-4 h-4" stroke={1.8} />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        multiple
                                        accept=".csv,.tsv,.xlsx,.xls,.txt,.json,.pdf,.doc,.docx,.ppt,.pptx"
                                        onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
                                    />
                                </label>

                                {/* Selected chart chips */}
                                {selectedCharts.length > 0 ? (
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {selectedCharts.map(id => (
                                            <span key={id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-[#1a1a1a] text-white
                                                             rounded-lg text-[11px] font-semibold">
                                                {CHARTS.find(c => c.id === id)?.name ?? id}
                                                <button onClick={() => setSelectedCharts(prev => prev.filter(c => c !== id))} className="hover:opacity-60 transition-opacity ml-0.5">
                                                    <IconX className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : willRunMulti ? (
                                    <span className="flex items-center gap-1 px-2 py-1 bg-[#f5f5f5] text-[#555] border border-[#e8e8e8]
                                                     rounded-lg text-[11px] font-semibold">
                                        <IconSparkles className="w-3 h-3" />
                                        Multi-chart
                                    </span>
                                ) : (
                                    <span className="text-[11px] text-gray-300 px-1 hidden sm:block">
                                        Select chart(s) above or let AI choose
                                    </span>
                                )}
                            </div>

                            {/* Submit */}
                            <button
                                onClick={() => generate()}
                                disabled={!prompt.trim() || loading || suggesting || multiLoading}
                                className="w-8 h-8 bg-[#1a1a1a] text-white rounded-xl flex items-center justify-center
                                           disabled:opacity-15 transition-all hover:bg-black active:scale-95 shrink-0"
                            >
                                {(loading || suggesting || multiLoading)
                                    ? <IconLoader2 className="w-4 h-4 animate-spin" />
                                    : <IconArrowUp className="w-4 h-4" />
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
