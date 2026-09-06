"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Code, Copy, Check, Download, RefreshCw } from "lucide-react";

interface Props {
    tikzCode: string;
    pdfUrl: string | null;
    loading: boolean;
    selectedType: string;
    onRegenerate: () => void;
    onDownloadTex: () => void;
    onDownloadPdf: () => void;
}

export default function ResultPanel({
    tikzCode, pdfUrl, loading, selectedType, onRegenerate, onDownloadTex, onDownloadPdf,
}: Props) {
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!tikzCode) return;
        navigator.clipboard.writeText(tikzCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3 flex-1 min-h-0"
        >
            {/* Action bar */}
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                <button
                    onClick={() => setShowCode(s => !s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors
                        ${showCode ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white text-[#555] border-[#ddd] hover:border-[#aaa]"}`}
                >
                    <Code size={12} />
                    TikZ Code
                </button>

                {tikzCode && (
                    <button onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors">
                        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        {copied ? "Copied" : "Copy"}
                    </button>
                )}
                {tikzCode && (
                    <button onClick={onDownloadTex}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors">
                        <Download size={12} /> .tex
                    </button>
                )}
                {pdfUrl && (
                    <button onClick={onDownloadPdf}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors">
                        <Download size={12} /> PDF
                    </button>
                )}
                <button onClick={onRegenerate} disabled={loading}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors disabled:opacity-40">
                    <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    Regenerate
                </button>
            </div>

            {/* Content: mobile always stacked, desktop side-by-side when code shown */}
            <div className={`flex flex-col gap-3 flex-1 min-h-0 ${showCode && pdfUrl ? "md:flex-row" : ""}`}>

                {/* PDF preview */}
                {pdfUrl && (
                    <div className={`${showCode ? "md:flex-1" : "w-full"} rounded-2xl border border-[#ebebeb] overflow-hidden bg-[#f8f8f8] flex-shrink-0 md:flex-shrink`}>
                        {/* Fixed height on mobile, flexible on desktop */}
                        <iframe
                            src={pdfUrl}
                            title="TikZ diagram preview"
                            className="w-full block"
                            style={{ height: "320px", border: "none" }}
                        />
                        {/* Taller on desktop via a utility trick */}
                        <style>{`@media (min-width: 768px) { .tikz-iframe { height: 100% !important; min-height: 360px; } }`}</style>
                    </div>
                )}

                {/* TikZ source */}
                {showCode && tikzCode && (
                    <div className={`${pdfUrl ? "md:w-[45%]" : "w-full"} rounded-2xl border border-[#ebebeb] bg-[#1e1e2e] overflow-hidden flex flex-col flex-shrink-0`}
                        style={{ minHeight: "220px" }}>
                        <div className="flex items-center justify-between px-4 py-2 border-b border-[#ffffff15] flex-shrink-0">
                            <span className="text-[11px] font-medium text-[#aaa]">TikZ source</span>
                            <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-[#aaa] hover:text-white transition-colors">
                                {copied ? <Check size={11} /> : <Copy size={11} />}
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                        <pre className="flex-1 overflow-auto p-4 text-[11px] leading-relaxed text-[#cdd6f4] font-mono whitespace-pre-wrap">
                            {tikzCode}
                        </pre>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
