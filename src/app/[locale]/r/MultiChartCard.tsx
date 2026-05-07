"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconLoader2, IconRefresh, IconCode, IconDownload,
    IconCopy, IconCheck, IconMaximize, IconX,
} from "@tabler/icons-react";
import type { GeneratedChart } from "./charts";

interface Props {
    chart: GeneratedChart;
    index: number;
    onRetry: (index: number, chartType: string) => void;
}

export default function MultiChartCard({ chart, index, onRetry }: Props) {
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
