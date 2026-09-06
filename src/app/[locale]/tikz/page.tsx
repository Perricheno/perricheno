"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Loader2, X, LayoutGrid, ChevronDown } from "lucide-react";
import { useAdmin } from "@/components/AdminContext";
import CategorySection from "./CategorySection";
import TypeSheet from "./TypeSheet";
import ResultPanel from "./ResultPanel";
import { VISUALS, CATEGORIES, LANGUAGES } from "./types";

export default function TikzPage() {
    const { user, setShowLogin } = useAdmin();

    const [prompt, setPrompt] = useState("");
    const [selectedType, setSelectedType] = useState("concept_map");
    const [language, setLanguage] = useState("en");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const [tikzCode, setTikzCode] = useState("");
    const [pdfBase64, setPdfBase64] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [elapsed, setElapsed] = useState(0);

    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const prevUrlRef = useRef<string | null>(null);

    // Auto-grow textarea (capped at 160px)
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }, [prompt]);

    // Build / revoke blob URL from base64
    useEffect(() => {
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        if (!pdfBase64) { setPdfUrl(null); prevUrlRef.current = null; return; }
        const bytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        prevUrlRef.current = url;
        return () => { URL.revokeObjectURL(url); };
    }, [pdfBase64]);

    const handleGenerate = useCallback(async () => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);
        setPdfBase64(null);
        setTikzCode("");
        setElapsed(0);
        const t0 = Date.now();
        elapsedRef.current = setInterval(() => setElapsed((Date.now() - t0) / 1000), 200);

        try {
            const res = await fetch("/api/tikz/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: prompt.trim(), visualType: selectedType, language }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setError(data.details ?? data.error ?? "Generation failed.");
                if (data.tikzCode) setTikzCode(data.tikzCode);
            } else {
                setTikzCode(data.tikzCode ?? "");
                setPdfBase64(data.pdfBase64 ?? null);
            }
        } catch (e: any) {
            setError(e?.message ?? "Network error.");
        } finally {
            if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
            setLoading(false);
        }
    }, [user, setShowLogin, prompt, selectedType, language]);

    const handleDownloadPdf = () => {
        if (!pdfUrl) return;
        const a = document.createElement("a");
        a.href = pdfUrl; a.download = `tikz_${selectedType}.pdf`; a.click();
    };

    const handleDownloadTex = () => {
        if (!tikzCode) return;
        const blob = new Blob([tikzCode], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `tikz_${selectedType}.tex`; a.click();
        URL.revokeObjectURL(url);
    };

    const selectedEntry = VISUALS.find(v => v.id === selectedType);
    const hasResult = !!pdfUrl || !!tikzCode;

    return (
        <div className="flex h-dvh bg-white overflow-hidden">

            {/* ── Desktop sidebar ── */}
            <aside className="hidden md:flex w-60 flex-shrink-0 border-r border-[#ebebeb] flex-col bg-[#fafafa]">
                <div className="px-3 pt-4 pb-2 border-b border-[#ebebeb] flex-shrink-0">
                    <h1 className="text-[13px] font-bold text-[#1a1a1a]">TikZ Studio</h1>
                    <p className="text-[11px] text-gray-400 mt-0.5">Academic diagram generator</p>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2">
                    {CATEGORIES.map((cat, i) => (
                        <CategorySection
                            key={cat}
                            category={cat}
                            entries={VISUALS.filter(v => v.category === cat)}
                            selected={selectedType}
                            onSelect={setSelectedType}
                            defaultOpen={i === 0}
                        />
                    ))}
                </div>
            </aside>

            {/* ── Mobile bottom sheet ── */}
            <TypeSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                selected={selectedType}
                onSelect={setSelectedType}
            />

            {/* ── Main column ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* Top bar */}
                <div className="border-b border-[#ebebeb] px-4 md:px-6 py-3 flex items-center gap-2 bg-white flex-shrink-0">
                    {/* Mobile type picker */}
                    <button
                        onClick={() => setSheetOpen(true)}
                        className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#ebebeb] bg-[#fafafa] active:scale-[0.97] transition-all"
                    >
                        <LayoutGrid size={13} className="text-gray-500 flex-shrink-0" />
                        <span className="text-[12px] font-semibold text-[#1a1a1a] truncate max-w-[130px]">
                            {selectedEntry?.name ?? "Select type"}
                        </span>
                        <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
                    </button>

                    {/* Desktop type + description */}
                    <div className="hidden md:flex flex-1 min-w-0 items-center gap-2">
                        <span className="text-[12px] font-semibold text-[#1a1a1a]">{selectedEntry?.name}</span>
                        <span className="text-[11px] text-gray-400 truncate">{selectedEntry?.desc}</span>
                    </div>
                    <div className="flex-1 md:hidden" />

                    {/* Language */}
                    <select
                        value={language}
                        onChange={e => setLanguage(e.target.value)}
                        className="text-[12px] border border-[#ddd] rounded-lg px-2 py-1.5 bg-white text-[#1a1a1a] focus:outline-none focus:border-[#aaa] flex-shrink-0"
                        style={{ touchAction: "manipulation" }}
                    >
                        {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </div>

                {/* ── Scrollable result area ── */}
                <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mx-4 md:mx-6 mt-4 mb-0 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2 flex-shrink-0"
                            >
                                <span className="flex-1">{error}</span>
                                <button onClick={() => setError(null)}><X size={13} className="text-red-400 flex-shrink-0" /></button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Result */}
                    {hasResult && (
                        <div className="flex-1 px-4 md:px-6 pt-4 pb-4 md:pb-6 flex flex-col min-h-0">
                            <ResultPanel
                                tikzCode={tikzCode}
                                pdfUrl={pdfUrl}
                                loading={loading}
                                selectedType={selectedType}
                                onRegenerate={handleGenerate}
                                onDownloadTex={handleDownloadTex}
                                onDownloadPdf={handleDownloadPdf}
                            />
                        </div>
                    )}

                    {/* Empty state */}
                    {!hasResult && !loading && (
                        <div className="flex-1 flex items-center justify-center px-6 py-12">
                            <div className="text-center max-w-xs">
                                <div className="w-14 h-14 rounded-2xl bg-[#f5f5f5] border border-[#ebebeb] flex items-center justify-center mx-auto mb-4">
                                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="opacity-40">
                                        <rect x="4" y="4" width="8" height="8" rx="1.5" fill="#1a1a1a" />
                                        <rect x="16" y="4" width="8" height="8" rx="1.5" fill="#1a1a1a" />
                                        <rect x="4" y="16" width="8" height="8" rx="1.5" fill="#1a1a1a" />
                                        <rect x="16" y="16" width="8" height="8" rx="1.5" fill="#1a1a1a" />
                                        <line x1="8" y1="12" x2="8" y2="16" stroke="#1a1a1a" strokeWidth="1.5" />
                                        <line x1="20" y1="12" x2="20" y2="16" stroke="#1a1a1a" strokeWidth="1.5" />
                                        <line x1="12" y1="8" x2="16" y2="8" stroke="#1a1a1a" strokeWidth="1.5" />
                                        <line x1="12" y1="20" x2="16" y2="20" stroke="#1a1a1a" strokeWidth="1.5" />
                                    </svg>
                                </div>
                                <p className="text-[13px] font-semibold text-[#1a1a1a] mb-1 md:hidden">
                                    Tap the type button above, then describe it
                                </p>
                                <p className="hidden md:block text-[13px] font-semibold text-[#1a1a1a] mb-1">
                                    Select a type and describe it below
                                </p>
                                <p className="text-[12px] text-gray-400 leading-relaxed">
                                    Compiles to PDF · embeds inline in LaTeX · 30 diagram types
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Loading (no result yet) */}
                    {loading && !hasResult && (
                        <div className="flex-1 flex items-center justify-center py-16">
                            <div className="text-center">
                                <Loader2 size={28} className="animate-spin text-gray-300 mx-auto mb-3" />
                                <p className="text-[12px] text-gray-400">
                                    Generating {selectedEntry?.name}… {elapsed.toFixed(0)}s
                                </p>
                                <p className="text-[11px] text-gray-300 mt-1">LLM → TikZ → LaTeX → PDF</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Sticky bottom input ── */}
                <div className="flex-shrink-0 bg-white border-t border-[#f0f0f0] px-3 md:px-6 pt-3 pb-[calc(76px+4px)] md:pb-5">
                    <div className="flex items-end gap-2">
                        <div
                            className="flex-1 relative rounded-2xl bg-[#f5f5f5] overflow-hidden"
                            style={{ boxShadow: "0 0 0 1.5px rgba(0,0,0,0.06)" }}
                        >
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !loading && prompt.trim()) {
                                        e.preventDefault(); handleGenerate();
                                    }
                                }}
                                placeholder={`Describe the ${selectedEntry?.name ?? "diagram"} you want…`}
                                style={{ fontSize: "16px", touchAction: "manipulation" }}
                                className="w-full resize-none px-4 pt-3.5 pb-3.5 text-[#1a1a1a] placeholder-gray-300 focus:outline-none leading-relaxed min-h-[52px] bg-transparent"
                                disabled={loading}
                            />
                            {loading && (
                                <div className="absolute bottom-2.5 right-3 text-[11px] text-gray-400 tabular-nums pointer-events-none">
                                    {elapsed.toFixed(0)}s
                                </div>
                            )}
                            <div className="absolute bottom-3 left-4 text-[10px] text-gray-300 hidden md:block select-none pointer-events-none">
                                ⌘↵ to generate
                            </div>
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                            style={{ touchAction: "manipulation" }}
                            className={`flex-shrink-0 rounded-2xl w-11 h-11 flex items-center justify-center transition-all mb-0.5
                                ${loading || !prompt.trim()
                                    ? "bg-[#ebebeb] text-gray-300 cursor-not-allowed"
                                    : "bg-[#1a1a1a] text-white hover:bg-[#333] active:scale-95"
                                }`}
                        >
                            {loading
                                ? <Loader2 size={16} className="animate-spin" />
                                : <ArrowUp size={16} />
                            }
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
