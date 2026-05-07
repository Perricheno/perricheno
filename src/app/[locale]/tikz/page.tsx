"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconArrowUp, IconLoader2, IconCode, IconX,
    IconCopy, IconCheck, IconDownload, IconRefresh,
    IconChevronDown, IconChevronRight, IconLayoutGrid,
} from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";

// ── Type catalogue ─────────────────────────────────────────────────────────────

interface VisualEntry {
    id: string;
    name: string;
    category: string;
    desc: string;
}

const VISUALS: VisualEntry[] = [
    { id: "mind_map",        name: "Mind Map",          category: "Structure",  desc: "Radial branches from central concept" },
    { id: "concept_map",     name: "Concept Map",       category: "Structure",  desc: "Labeled semantic links between concepts" },
    { id: "hierarchy",       name: "Hierarchy",         category: "Structure",  desc: "Tree: taxonomy or classification" },
    { id: "onion_model",     name: "Onion Model",       category: "Structure",  desc: "Concentric layers from core outward" },
    { id: "wbs",             name: "WBS",               category: "Structure",  desc: "Work breakdown: project → deliverables" },
    { id: "bracket_tree",    name: "Bracket Tree",      category: "Structure",  desc: "Hierarchical bracket / syntax tree" },
    { id: "process_schema",  name: "Process Schema",    category: "Process",    desc: "Sequential methodology phases" },
    { id: "flowchart",       name: "Flowchart",         category: "Process",    desc: "Decision flow with Yes/No branches" },
    { id: "cycle",           name: "Cycle",             category: "Process",    desc: "Circular loop: PDCA, ADDIE, etc." },
    { id: "pipeline_flow",   name: "Pipeline Flow",     category: "Process",    desc: "Processing pipeline with data annotations" },
    { id: "gantt",           name: "Gantt Chart",       category: "Process",    desc: "Task bars on a horizontal time axis" },
    { id: "timeline",        name: "Timeline",          category: "Process",    desc: "Chronological sequence of events" },
    { id: "framework",       name: "Framework",         category: "Conceptual", desc: "Theoretical model: inputs → process → outputs" },
    { id: "relationship",    name: "Relationship",      category: "Conceptual", desc: "Entity/factor connection web" },
    { id: "venn",            name: "Venn Diagram",      category: "Conceptual", desc: "Overlapping sets and intersections" },
    { id: "comparison",      name: "Comparison Table",  category: "Conceptual", desc: "Side-by-side structured comparison" },
    { id: "architecture",    name: "Architecture",      category: "Conceptual", desc: "Layered system or model architecture" },
    { id: "ecosystem_map",   name: "Ecosystem Map",     category: "Conceptual", desc: "Focal entity + surrounding actors" },
    { id: "matrix_2x2",      name: "2×2 Matrix",        category: "Analysis",   desc: "Strategic quadrant map (BCG, priority)" },
    { id: "force_field",     name: "Force Field",       category: "Analysis",   desc: "Lewin: driving vs restraining forces" },
    { id: "fishbone",        name: "Fishbone",          category: "Analysis",   desc: "Ishikawa cause-effect diagram" },
    { id: "causal_loop",     name: "Causal Loop",       category: "Analysis",   desc: "Variables with +/– feedback arcs" },
    { id: "swot",            name: "SWOT",              category: "Analysis",   desc: "Strengths / Weaknesses / Opportunities / Threats" },
    { id: "stakeholder_map", name: "Stakeholder Map",   category: "Analysis",   desc: "Stakeholders by proximity/influence" },
    { id: "value_chain",     name: "Value Chain",       category: "Analysis",   desc: "Porter's primary + support activities" },
    { id: "network",         name: "Network Graph",     category: "Academic",   desc: "Labeled edges between many nodes" },
    { id: "state_machine",   name: "State Machine",     category: "Academic",   desc: "Finite automaton: states + transitions" },
    { id: "sequence_diagram",name: "Sequence Diagram",  category: "Academic",   desc: "UML lifelines + message arrows" },
    { id: "er_diagram",      name: "ER Diagram",        category: "Academic",   desc: "Entity-relationship with cardinality" },
    { id: "systems_map",     name: "Systems Map",       category: "Academic",   desc: "System boundary + internal/external flows" },
];

const CATEGORIES = ["Structure", "Process", "Conceptual", "Analysis", "Academic"];

const LANGUAGES = [
    { id: "en", name: "English" },
    { id: "ru", name: "Русский" },
    { id: "de", name: "Deutsch" },
    { id: "fr", name: "Français" },
    { id: "es", name: "Español" },
    { id: "uk", name: "Українська" },
    { id: "kk", name: "Қазақша" },
];

// ── Visual type card (shared) ──────────────────────────────────────────────────

function VisualCard({
    entry, selected, onClick, compact = false,
}: {
    entry: VisualEntry; selected: boolean; onClick: () => void; compact?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-xl border transition-all duration-150
                ${compact ? "px-3 py-2" : "px-3 py-2.5"}
                ${selected
                    ? "border-[#1a1a1a] bg-[#1a1a1a]"
                    : "border-[#ebebeb] bg-white hover:border-[#aaa] active:scale-[0.98]"
                }`}
        >
            <p className={`font-bold leading-tight ${compact ? "text-[12px]" : "text-[11px]"} ${selected ? "text-white" : "text-[#1a1a1a]"}`}>
                {entry.name}
            </p>
            {!compact && (
                <p className={`text-[10px] mt-0.5 font-medium leading-tight ${selected ? "text-gray-300" : "text-gray-400"}`}>
                    {entry.desc}
                </p>
            )}
        </button>
    );
}

// ── Desktop sidebar category section ──────────────────────────────────────────

function CategorySection({
    category, entries, selected, onSelect, defaultOpen,
}: {
    category: string; entries: VisualEntry[]; selected: string;
    onSelect: (id: string) => void; defaultOpen: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="mb-1">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
                <span>{category}</span>
                {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 gap-1 pb-1">
                            {entries.map(e => (
                                <VisualCard key={e.id} entry={e} selected={selected === e.id} onClick={() => onSelect(e.id)} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Mobile type sheet (bottom sheet) ──────────────────────────────────────────

function TypeSheet({
    open, onClose, selected, onSelect,
}: {
    open: boolean; onClose: () => void; selected: string; onSelect: (id: string) => void;
}) {
    const [activeCategory, setActiveCategory] = useState(
        VISUALS.find(v => v.id === selected)?.category ?? "Structure"
    );
    const categoryRef = useRef<HTMLDivElement>(null);

    // Scroll selected category tab into view
    useEffect(() => {
        if (!open) return;
        const cat = VISUALS.find(v => v.id === selected)?.category;
        if (cat) setActiveCategory(cat);
    }, [open, selected]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={onClose}
                    />
                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.8 }}
                        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl md:hidden flex flex-col"
                        style={{ maxHeight: "82vh" }}
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
                            <div className="w-8 h-1 rounded-full bg-[#e0e0e0]" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-4 pb-2 flex-shrink-0">
                            <p className="text-[13px] font-bold text-[#1a1a1a]">Diagram type</p>
                            <button onClick={onClose} className="p-1 text-gray-400 hover:text-[#1a1a1a] transition-colors">
                                <IconX size={18} />
                            </button>
                        </div>

                        {/* Category tabs */}
                        <div
                            ref={categoryRef}
                            className="flex gap-2 overflow-x-auto px-4 pb-3 flex-shrink-0"
                            style={{ scrollbarWidth: "none" }}
                        >
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors
                                        ${activeCategory === cat
                                            ? "bg-[#1a1a1a] text-white"
                                            : "bg-[#f5f5f5] text-[#555] hover:bg-[#eee]"
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-[#f0f0f0] flex-shrink-0" />

                        {/* Type grid */}
                        <div className="overflow-y-auto flex-1 px-4 py-3">
                            <div className="grid grid-cols-2 gap-2 pb-6">
                                {VISUALS.filter(v => v.category === activeCategory).map(entry => (
                                    <VisualCard
                                        key={entry.id}
                                        entry={entry}
                                        selected={selected === entry.id}
                                        compact={false}
                                        onClick={() => { onSelect(entry.id); onClose(); }}
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

    const [elapsed, setElapsed] = useState(0);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const prevUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }, [prompt]);

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
        const startTime = Date.now();
        elapsedRef.current = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 200);

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
        } catch (err: any) {
            setError(err?.message ?? "Network error.");
        } finally {
            if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
            setLoading(false);
        }
    }, [user, setShowLogin, prompt, selectedType, language]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (!loading && prompt.trim()) handleGenerate();
        }
    };

    const handleCopy = () => {
        if (!tikzCode) return;
        navigator.clipboard.writeText(tikzCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const handleDownloadPdf = () => {
        if (!pdfUrl) return;
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = `tikz_${selectedType}.pdf`;
        a.click();
    };

    const handleDownloadTex = () => {
        if (!tikzCode) return;
        const blob = new Blob([tikzCode], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tikz_${selectedType}.tex`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const selectedEntry = VISUALS.find(v => v.id === selectedType);
    const hasResult = !!pdfUrl || !!tikzCode;

    return (
        <div className="flex h-dvh bg-white overflow-hidden">

            {/* ── Desktop sidebar (hidden on mobile) ── */}
            <aside className="hidden md:flex w-60 flex-shrink-0 border-r border-[#ebebeb] flex-col bg-[#fafafa] overflow-hidden">
                <div className="px-3 pt-4 pb-2 border-b border-[#ebebeb]">
                    <h1 className="text-[13px] font-bold text-[#1a1a1a]">TikZ Studio</h1>
                    <p className="text-[11px] text-gray-400 mt-0.5">Academic diagram generator</p>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-gray-200">
                    {CATEGORIES.map((cat, ci) => (
                        <CategorySection
                            key={cat}
                            category={cat}
                            entries={VISUALS.filter(v => v.category === cat)}
                            selected={selectedType}
                            onSelect={setSelectedType}
                            defaultOpen={ci === 0}
                        />
                    ))}
                </div>
            </aside>

            {/* ── Mobile type sheet ── */}
            <TypeSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                selected={selectedType}
                onSelect={setSelectedType}
            />

            {/* ── Main area ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                {/* ── Top bar ── */}
                <div className="border-b border-[#ebebeb] px-4 md:px-6 py-3 flex items-center gap-2 bg-white flex-shrink-0">
                    {/* Mobile: type selector trigger */}
                    <button
                        onClick={() => setSheetOpen(true)}
                        className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#ebebeb] bg-[#fafafa] hover:border-[#aaa] transition-colors active:scale-[0.97] flex-shrink-0"
                    >
                        <IconLayoutGrid size={13} className="text-gray-500" />
                        <span className="text-[12px] font-semibold text-[#1a1a1a] max-w-[120px] truncate">
                            {selectedEntry?.name ?? "Select type"}
                        </span>
                        <IconChevronDown size={11} className="text-gray-400" />
                    </button>

                    {/* Desktop: type name + desc */}
                    <div className="hidden md:flex flex-1 min-w-0 items-center gap-2">
                        <span className="text-[12px] font-semibold text-[#1a1a1a]">{selectedEntry?.name ?? "Select a type"}</span>
                        <span className="text-[11px] text-gray-400 truncate">{selectedEntry?.desc}</span>
                    </div>

                    {/* Spacer on mobile */}
                    <div className="flex-1 md:hidden" />

                    {/* Language selector */}
                    <select
                        value={language}
                        onChange={e => setLanguage(e.target.value)}
                        className="text-[12px] border border-[#ddd] rounded-lg px-2 py-1.5 bg-white text-[#1a1a1a] focus:outline-none focus:border-[#aaa] cursor-pointer flex-shrink-0"
                    >
                        {LANGUAGES.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                </div>

                {/* ── Content area ── */}
                <div className="flex-1 overflow-auto flex flex-col min-h-0">

                    {/* Prompt */}
                    <div className="px-4 md:px-6 pt-4 pb-3 flex-shrink-0">
                        <div className="relative border border-[#ebebeb] rounded-2xl bg-white shadow-sm overflow-hidden focus-within:border-[#aaa] transition-colors">
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={`Describe the ${selectedEntry?.name ?? "diagram"} you want…`}
                                className="w-full resize-none px-4 pt-4 pb-12 text-[13px] text-[#1a1a1a] placeholder-gray-300 focus:outline-none leading-relaxed min-h-[72px]"
                                disabled={loading}
                            />
                            <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                {loading && (
                                    <span className="text-[11px] text-gray-400">{elapsed.toFixed(0)}s</span>
                                )}
                                <button
                                    onClick={handleGenerate}
                                    disabled={loading || !prompt.trim()}
                                    className={`rounded-xl w-9 h-9 flex items-center justify-center transition-all
                                        ${loading || !prompt.trim()
                                            ? "bg-[#f0f0f0] text-gray-300 cursor-not-allowed"
                                            : "bg-[#1a1a1a] text-white hover:bg-[#333] active:scale-95"
                                        }`}
                                >
                                    {loading
                                        ? <IconLoader2 size={16} className="animate-spin" />
                                        : <IconArrowUp size={16} />
                                    }
                                </button>
                            </div>
                            <div className="absolute bottom-3.5 left-4 text-[10px] text-gray-300 hidden md:block">
                                ⌘↵ to generate
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mx-4 md:mx-6 mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2 flex-shrink-0"
                            >
                                <span className="flex-1">{error}</span>
                                <button onClick={() => setError(null)}>
                                    <IconX size={13} className="text-red-400 hover:text-red-600 flex-shrink-0" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Result */}
                    <AnimatePresence>
                        {hasResult && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25 }}
                                className="flex-1 mx-4 md:mx-6 mb-4 md:mb-6 flex flex-col gap-3 min-h-0"
                            >
                                {/* Action bar */}
                                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                                    <button
                                        onClick={() => setShowCode(s => !s)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors
                                            ${showCode ? "bg-[#1a1a1a] text-white border-[#1a1a1a]" : "bg-white text-[#555] border-[#ddd] hover:border-[#aaa]"}`}
                                    >
                                        <IconCode size={12} />
                                        TikZ Code
                                    </button>
                                    {tikzCode && (
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors"
                                        >
                                            {copied ? <IconCheck size={12} className="text-green-500" /> : <IconCopy size={12} />}
                                            {copied ? "Copied" : "Copy"}
                                        </button>
                                    )}
                                    {tikzCode && (
                                        <button onClick={handleDownloadTex}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors">
                                            <IconDownload size={12} /> .tex
                                        </button>
                                    )}
                                    {pdfUrl && (
                                        <button onClick={handleDownloadPdf}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors">
                                            <IconDownload size={12} /> PDF
                                        </button>
                                    )}
                                    <button
                                        onClick={handleGenerate}
                                        disabled={loading}
                                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors disabled:opacity-40"
                                    >
                                        <IconRefresh size={12} className={loading ? "animate-spin" : ""} />
                                        Regenerate
                                    </button>
                                </div>

                                {/* PDF + code panel
                                    Mobile: always stacked (flex-col)
                                    Desktop: side by side when code shown  */}
                                <div className={`flex flex-col md:flex-row gap-3 flex-1 min-h-0`}>
                                    {pdfUrl && (
                                        <div className={`${showCode ? "md:flex-1" : "w-full"} rounded-2xl border border-[#ebebeb] overflow-hidden bg-[#f8f8f8]`}
                                            style={{ minHeight: "280px" }}>
                                            <iframe
                                                src={pdfUrl}
                                                className="w-full h-full"
                                                style={{ minHeight: "280px", border: "none" }}
                                                title="TikZ diagram preview"
                                            />
                                        </div>
                                    )}

                                    {showCode && tikzCode && (
                                        <div className={`${pdfUrl ? "md:w-[45%]" : "w-full"} rounded-2xl border border-[#ebebeb] bg-[#1e1e2e] overflow-hidden flex flex-col`}
                                            style={{ minHeight: "220px" }}>
                                            <div className="flex items-center justify-between px-4 py-2 border-b border-[#ffffff15] flex-shrink-0">
                                                <span className="text-[11px] font-medium text-[#aaa]">TikZ source</span>
                                                <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-[#aaa] hover:text-white transition-colors">
                                                    {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
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
                        )}
                    </AnimatePresence>

                    {/* Empty state */}
                    {!hasResult && !loading && (
                        <div className="flex-1 flex items-center justify-center px-6">
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
                                {/* Mobile hint */}
                                <p className="text-[13px] font-semibold text-[#1a1a1a] mb-1 md:hidden">
                                    Tap the type button to choose a diagram
                                </p>
                                <p className="hidden md:block text-[13px] font-semibold text-[#1a1a1a] mb-1">
                                    Select a type and describe the diagram
                                </p>
                                <p className="text-[12px] text-gray-400 leading-relaxed">
                                    Compiles to PDF and embeds inline in LaTeX. 30 diagram types across 5 categories.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && !hasResult && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <IconLoader2 size={28} className="animate-spin text-gray-300 mx-auto mb-3" />
                                <p className="text-[12px] text-gray-400">
                                    Generating {selectedEntry?.name}… {elapsed.toFixed(0)}s
                                </p>
                                <p className="text-[11px] text-gray-300 mt-1">LLM → TikZ → LaTeX compiler → PDF</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
