"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconArrowRight, IconLoader2, IconCode, IconX,
    IconCopy, IconCheck, IconRefresh, IconChartDots2, IconDownload,
} from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";

// ── Chart catalogue ─────────────────────────────────────────────────────────

interface ChartEntry {
    id: string;
    name: string;
    tag: string;
    preview: string;  // path under /r-previews/ or /previews/ fallback
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

// ── Placeholder SVG for charts without a preview image ───────────────────────
function PlaceholderPreview({ name }: { name: string }) {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 gap-1">
            <IconChartDots2 className="w-5 h-5 text-gray-300" stroke={1.5} />
            <span className="text-[9px] text-gray-300 font-medium">{name}</span>
        </div>
    );
}

// ── Chart card ────────────────────────────────────────────────────────────────
function ChartCard({
    chart,
    selected,
    onClick,
}: {
    chart: ChartEntry;
    selected: boolean;
    onClick: () => void;
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
                    ? "border-[#1a1a1a] bg-[#1a1a1a] shadow-md"
                    : "border-[#e8e8e8] bg-white hover:border-[#aaa] hover:shadow-sm"
                }`}
        >
            {/* Hover preview (floated above) */}
            <AnimatePresence>
                {hovered && !selected && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 pointer-events-none
                                   w-44 h-28 rounded-xl overflow-hidden shadow-xl border border-[#e8e8e8] bg-white"
                    >
                        {chart.preview && !imgError ? (
                            <img
                                src={chart.preview}
                                alt={chart.name}
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <PlaceholderPreview name={chart.name} />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Card body */}
            <div className="px-3 py-2.5">
                <p className={`text-[12px] font-semibold leading-tight ${selected ? "text-white" : "text-[#1a1a1a]"}`}>
                    {chart.name}
                </p>
                <p className={`text-[10px] mt-0.5 font-medium ${selected ? "text-gray-300" : "text-gray-400"}`}>
                    {chart.tag}
                </p>
            </div>
        </button>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RPage() {
    const { user, setShowLogin } = useAdmin();

    const [prompt, setPrompt] = useState("");
    const [selectedChart, setSelectedChart] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Result state
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [resultCode, setResultCode] = useState<string>("");
    const [resultChartType, setResultChartType] = useState<string>("");
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);
    const [retrying, setRetrying] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const generate = useCallback(async (retry = false) => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);
        if (!retry) {
            setResultImage(null);
            setResultCode("");
        }

        try {
            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    chartType: selectedChart,
                    ...(retry && resultCode ? { previousCode: resultCode, previousError: error } : {}),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 402) {
                    setError("Quota reached. Please top up your balance.");
                    return;
                }
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            setResultImage(`data:image/png;base64,${data.image}`);
            setResultCode(data.code ?? "");
            setResultChartType(data.chartType ?? selectedChart);
        } catch (e: any) {
            setError(e.message || "Generation failed.");
        } finally {
            setLoading(false);
            setRetrying(false);
        }
    }, [user, prompt, selectedChart, resultCode, error, setShowLogin]);

    const handleRetry = () => {
        setRetrying(true);
        generate(true);
    };

    const handleNew = () => {
        setResultImage(null);
        setResultCode("");
        setError(null);
        setShowCode(false);
        setPrompt("");
        setSelectedChart("");
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
        a.download = `r-plot-${resultChartType || "chart"}.png`;
        a.click();
    };

    const toggleChart = (id: string) => {
        setSelectedChart(prev => prev === id ? "" : id);
    };

    return (
        <div className="min-h-screen bg-[#FAFAFA] flex flex-col">

            {/* ── Header ── */}
            <header className="px-6 pt-8 pb-4 max-w-4xl mx-auto w-full">
                <div className="flex items-end gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] flex items-center justify-center shrink-0">
                        <span className="text-white font-black text-lg leading-none select-none">R</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-[#1a1a1a] tracking-tight leading-none">R Studio</h1>
                        <p className="text-[13px] text-gray-400 font-medium mt-0.5">
                            Statistical visualizations with ggplot2
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full px-6 pb-16 space-y-8">

                {/* ── Prompt input ── */}
                <div className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden">
                    <div className="px-5 pt-4 pb-2">
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
                            placeholder="Describe the visualization… e.g. GDP growth of G20 countries, sales by region, survival analysis…"
                            className="w-full text-[15px] text-[#1a1a1a] bg-transparent outline-none placeholder:text-[#ccc]
                                       resize-none h-[72px] leading-relaxed"
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center justify-between px-4 pb-3 pt-1">
                        <div className="flex items-center gap-2">
                            {selectedChart && (
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-[#1a1a1a] text-white rounded-full
                                                 text-[11px] font-semibold uppercase tracking-wide">
                                    {CHARTS.find(c => c.id === selectedChart)?.name}
                                    <button onClick={() => setSelectedChart("")} className="hover:opacity-70 transition-opacity">
                                        <IconX className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {!selectedChart && (
                                <span className="text-[11px] text-gray-300 font-medium">
                                    Select a chart below — or let the AI choose
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => generate()}
                            disabled={!prompt.trim() || loading}
                            className="w-9 h-9 bg-[#1a1a1a] text-white rounded-xl flex items-center justify-center
                                       disabled:opacity-15 disabled:bg-[#e5e5e5] transition-all hover:bg-black active:scale-95"
                        >
                            {loading
                                ? <IconLoader2 className="w-4 h-4 animate-spin" />
                                : <IconArrowRight className="w-4 h-4" />
                            }
                        </button>
                    </div>
                </div>

                {/* ── Result panel ── */}
                <AnimatePresence mode="popLayout">
                    {(resultImage || loading) && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden"
                        >
                            {/* Image area */}
                            <div className="relative min-h-[320px] flex items-center justify-center bg-[#FAFAFA] border-b border-[#f0f0f0]">
                                {loading && !resultImage && (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-white border border-[#e8e8e8] shadow-sm flex items-center justify-center">
                                            <IconLoader2 className="w-5 h-5 animate-spin text-[#1a1a1a]" />
                                        </div>
                                        <p className="text-[13px] text-gray-400 font-medium">Running R…</p>
                                    </div>
                                )}
                                {resultImage && (
                                    <img
                                        src={resultImage}
                                        alt="R visualization"
                                        className="max-w-full max-h-[520px] object-contain p-4"
                                    />
                                )}
                            </div>

                            {/* Toolbar */}
                            {resultImage && (
                                <div className="flex items-center justify-between px-5 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setShowCode(v => !v)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                                                        uppercase tracking-wide transition-all border
                                                        ${showCode
                                                            ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                                                            : "text-gray-500 border-[#e8e8e8] hover:border-[#aaa]"}`}
                                        >
                                            <IconCode className="w-3.5 h-3.5" />
                                            Code
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                                                       uppercase tracking-wide border border-[#e8e8e8] text-gray-500
                                                       hover:border-[#aaa] transition-all"
                                        >
                                            <IconDownload className="w-3.5 h-3.5" />
                                            PNG
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={handleRetry}
                                            disabled={loading || retrying}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                                                       uppercase tracking-wide border border-[#e8e8e8] text-gray-500
                                                       hover:border-[#aaa] transition-all disabled:opacity-30"
                                        >
                                            <IconRefresh className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
                                            Retry
                                        </button>
                                        <button
                                            onClick={handleNew}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                                                       uppercase tracking-wide bg-[#1a1a1a] text-white hover:bg-black transition-all"
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
                                        key="code-panel"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                        className="overflow-hidden border-t border-[#f0f0f0]"
                                    >
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-[#f8f8f8] border-b border-[#eeeeee]">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">R Code</span>
                                            <button
                                                onClick={handleCopy}
                                                className="flex items-center gap-1 text-[10px] font-semibold text-gray-400
                                                           hover:text-[#1a1a1a] transition-colors uppercase tracking-wide"
                                            >
                                                {copied
                                                    ? <><IconCheck className="w-3.5 h-3.5 text-green-500" /> Copied</>
                                                    : <><IconCopy className="w-3.5 h-3.5" /> Copy</>
                                                }
                                            </button>
                                        </div>
                                        <pre className="px-5 py-4 text-[12px] leading-relaxed overflow-x-auto font-mono
                                                        text-[#1a1a1a] bg-[#f8f8f8] max-h-[380px] thin-scrollbar">
                                            {resultCode}
                                        </pre>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Error ── */}
                <AnimatePresence>
                    {error && !loading && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-start gap-3 px-4 py-3 bg-white border border-red-100 rounded-xl text-sm text-red-600"
                        >
                            <span className="flex-1">{error}</span>
                            <div className="flex items-center gap-1.5">
                                {resultCode && (
                                    <button
                                        onClick={handleRetry}
                                        className="text-[11px] font-semibold text-red-400 hover:text-red-600 uppercase tracking-wide"
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

                {/* ── Chart gallery ── */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                            Chart Types
                        </h2>
                        {selectedChart && (
                            <button
                                onClick={() => setSelectedChart("")}
                                className="text-[11px] text-gray-400 hover:text-[#1a1a1a] transition-colors font-medium"
                            >
                                Clear selection
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                        {CHARTS.map(chart => (
                            <ChartCard
                                key={chart.id}
                                chart={chart}
                                selected={selectedChart === chart.id}
                                onClick={() => toggleChart(chart.id)}
                            />
                        ))}
                    </div>

                    <p className="text-[10px] text-gray-300 mt-3 font-medium">
                        Hover a card to preview · click to select · then write a prompt and generate
                    </p>
                </section>
            </main>
        </div>
    );
}
