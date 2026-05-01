"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconArrowUp, IconLoader2, IconCode, IconX,
    IconCopy, IconCheck, IconRefresh, IconDownload,
    IconPaperclip, IconFile, IconSparkles,
} from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";

// ── Chart catalogue ─────────────────────────────────────────────────────────

interface ChartEntry {
    id: string;
    name: string;
    tag: string;
    preview: string;
}

const CHARTS: ChartEntry[] = [
    { id: "bar",        name: "Bar",          tag: "Distribution",  preview: "/previews/bar.png" },
    { id: "histogram",  name: "Histogram",    tag: "Distribution",  preview: "/previews/histogram.png" },
    { id: "boxplot",    name: "Box Plot",     tag: "Distribution",  preview: "/previews/boxplot.png" },
    { id: "violin",     name: "Violin",       tag: "Distribution",  preview: "" },
    { id: "lollipop",   name: "Lollipop",     tag: "Ranking",       preview: "/previews/lollipop.png" },
    { id: "dumbbell",   name: "Dumbbell",     tag: "Change",        preview: "/previews/dumbbell.png" },
    { id: "bubble",     name: "Bubble",       tag: "Correlation",   preview: "/previews/bubble.png" },
    { id: "density2d",  name: "2D Density",   tag: "Correlation",   preview: "/previews/density2d.png" },
    { id: "marginal",   name: "Marginal",     tag: "Correlation",   preview: "/previews/marginal.png" },
    { id: "heatmap",    name: "Heatmap",      tag: "Correlation",   preview: "/previews/heatmap.png" },
    { id: "parallel",   name: "Parallel",     tag: "Multivariate",  preview: "/previews/parallel.png" },
    { id: "radar",      name: "Radar",        tag: "Multivariate",  preview: "/previews/radar.png" },
    { id: "sankey",     name: "Sankey",       tag: "Flow",          preview: "/previews/sankey.png" },
    { id: "chord",      name: "Chord",        tag: "Flow",          preview: "/previews/chord.png" },
    { id: "circlepack", name: "Circle Pack",  tag: "Hierarchy",     preview: "/previews/circlepack.png" },
    { id: "dendrogram", name: "Dendrogram",   tag: "Hierarchy",     preview: "/previews/dendrogram.png" },
    { id: "waffle",     name: "Waffle",       tag: "Part-to-Whole", preview: "/previews/waffle.png" },
    { id: "wordcloud",  name: "Word Cloud",   tag: "Text",          preview: "/previews/wordcloud.png" },
    { id: "3d_scatter", name: "3D Scatter",   tag: "3D",            preview: "/previews/3d_scatter.png" },
    { id: "3d_surface", name: "3D Surface",   tag: "3D",            preview: "/previews/3d_surface.png" },
];

const SERVER_EXTRACT_EXTS = ["pdf", "doc", "docx", "ppt", "pptx"];
const CLIENT_TEXT_EXTS = ["csv", "tsv", "txt", "md", "json"];
const CLIENT_EXCEL_EXTS = ["xlsx", "xls"];

// ── Read file: client-side for text/Excel, server-side for PDF/Office ────────
async function readFileAsContext(file: File): Promise<{ content: string; images?: string[] }> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (CLIENT_TEXT_EXTS.includes(ext)) {
        // Read up to 5 MB to avoid memory issues on huge files
        const MAX_BYTES = 5 * 1024 * 1024;
        const buf = await file.arrayBuffer();
        const safeBuf = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
        const raw = new TextDecoder().decode(safeBuf);

        if (ext === "csv" || ext === "tsv" || raw.includes(",")) {
            const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
            const header = lines[0] ?? "";
            const sample = lines.slice(0, 10);
            const sep = ext === "tsv" ? "\t" : ",";
            const columns = header.split(sep).join(" | ");
            const content =
                `[DATASET SCHEMA DETECTED]\nCOLUMNS: ${columns}\n\n` +
                `[STRUCTURAL SAMPLE (First 10 rows)]:\n===CSV START===\n${sample.join("\n")}\n===CSV END===`;
            return { content };
        }

        // Plain text / JSON / MD — truncate to 800 lines
        const lines = raw.split("\n");
        return { content: lines.length > 800 ? `[TRUNCATED: showing 800 lines]\n\n${lines.slice(0, 800).join("\n")}` : raw };
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
            const sample = lines.slice(0, 10);
            const columns = header.split(",").join(" | ");
            const content =
                `[DATASET SCHEMA DETECTED]\nCOLUMNS: ${columns}\n\n` +
                `[STRUCTURAL SAMPLE (First 10 rows)]:\n===CSV START===\n${sample.join("\n")}\n===CSV END===`;
            return { content };
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

// ── Main ──────────────────────────────────────────────────────────────────────

interface AttachedFile {
    name: string;
    content: string;
    images?: string[];  // base64 pages for PDF/Office files
    size: number;
}

export default function RPage() {
    const { user, setShowLogin } = useAdmin();

    const [prompt, setPrompt] = useState("");
    const [selectedChart, setSelectedChart] = useState("");
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const [uploading, setUploading] = useState(false);

    // Suggest state
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedCharts, setSuggestedCharts] = useState<string[]>([]);
    const [suggestReasoning, setSuggestReasoning] = useState("");

    // Generation states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Result
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [resultCode, setResultCode] = useState("");
    const [resultChartType, setResultChartType] = useState("");
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

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
            const { content, images } = await readFileAsContext(f);
            if (content || images?.length) {
                results.push({ name: f.name, content, images, size: f.size });
            }
        }

        setFiles(prev => [...prev, ...results]);
        setUploading(false);
    };

    const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

    // ── Suggest chart types (called when files attached + no chart selected) ──
    const suggestCharts = useCallback(async (): Promise<string> => {
        if (!files.length) return selectedChart;
        setSuggesting(true);
        try {
            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "suggest",
                    prompt,
                    contextFiles: files.map(f => ({ name: f.name, content: f.content, images: f.images ?? [] })),
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
    }, [prompt, files, selectedChart]);

    // ── Generate ──
    const generate = useCallback(async (retryWithError = false, chartOverride?: string) => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;

        // If files are attached but no chart type chosen, ask AI for suggestion first
        let chartToUse = chartOverride ?? selectedChart;
        if (!retryWithError && files.length > 0 && !chartToUse) {
            chartToUse = await suggestCharts();
        }

        setLoading(true);
        setError(null);
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
                contextFiles: files.map(f => ({ name: f.name, content: f.content, images: f.images ?? [] })),
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

            setResultImage(`data:image/png;base64,${data.image}`);
            setResultCode(data.code ?? "");
            setResultChartType(data.chartType ?? chartToUse);
        } catch (e: any) {
            setError(e.message || "Generation failed.");
        } finally {
            setLoading(false);
        }
    }, [user, prompt, selectedChart, files, resultCode, error, setShowLogin, suggestCharts]);

    const handleRetry = () => generate(true);

    const handleNew = () => {
        setResultImage(null);
        setResultCode("");
        setError(null);
        setShowCode(false);
        setPrompt("");
        setSelectedChart("");
        setSuggestedCharts([]);
        setSuggestReasoning("");
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

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

    return (
        <div className="min-h-screen bg-[#F9F9F9] flex flex-col pb-20 md:pb-0">

            {/* ── Page header ── */}
            <div className="max-w-3xl mx-auto w-full px-5 pt-10 pb-2">
                <p className="text-[11px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-1 font-mono">R Studio</p>
                <h1 className="text-[28px] md:text-[34px] font-black text-[#1a1a1a] tracking-tight leading-none">
                    Statistical Visualization
                </h1>
                <p className="text-[13px] text-gray-400 mt-1.5 font-medium">
                    ggplot2 · greyscale · publication-ready
                </p>
            </div>

            <main className="max-w-3xl mx-auto w-full px-5 pt-6 space-y-6">

                {/* ── Input card ── */}
                <div
                    className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm"
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                >
                    {/* Textarea */}
                    <div className="px-4 pt-4 pb-2">
                        <textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey && !loading) {
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

                            {/* Selected chart chip */}
                            {selectedChart ? (
                                <span className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-[#1a1a1a] text-white
                                                 rounded-lg text-[11px] font-semibold">
                                    {CHARTS.find(c => c.id === selectedChart)?.name}
                                    <button onClick={() => setSelectedChart("")} className="hover:opacity-60 transition-opacity ml-0.5">
                                        <IconX className="w-3 h-3" />
                                    </button>
                                </span>
                            ) : (
                                <span className="text-[11px] text-gray-300 px-1 hidden sm:block">
                                    Select a chart ↓ or let AI choose
                                </span>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            onClick={() => generate()}
                            disabled={!prompt.trim() || loading || suggesting}
                            className="w-8 h-8 bg-[#1a1a1a] text-white rounded-xl flex items-center justify-center
                                       disabled:opacity-15 transition-all hover:bg-black active:scale-95 shrink-0"
                        >
                            {(loading || suggesting)
                                ? <IconLoader2 className="w-4 h-4 animate-spin" />
                                : <IconArrowUp className="w-4 h-4" />
                            }
                        </button>
                    </div>
                </div>

                {/* ── Error banner ── */}
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

                {/* ── Result panel ── */}
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

                {/* ── Chart gallery ── */}
                <section className="pb-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.18em]">
                            Chart Types · {CHARTS.length} available
                        </p>
                        {(selectedChart || suggestedCharts.length > 0) && (
                            <button
                                onClick={() => { setSelectedChart(""); setSuggestedCharts([]); setSuggestReasoning(""); }}
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
                                selected={selectedChart === chart.id}
                                suggested={suggestedCharts.includes(chart.id) && selectedChart !== chart.id}
                                onClick={() => {
                                    setSelectedChart(prev => prev === chart.id ? "" : chart.id);
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
            </main>
        </div>
    );
}
