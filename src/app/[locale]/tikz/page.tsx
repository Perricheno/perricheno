"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconArrowUp, IconLoader2, IconCode, IconX,
    IconCopy, IconCheck, IconDownload, IconRefresh,
    IconChevronDown, IconChevronRight,
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
    // Structure
    { id: "mind_map",        name: "Mind Map",          category: "Structure",  desc: "Radial branches from central concept" },
    { id: "concept_map",     name: "Concept Map",       category: "Structure",  desc: "Labeled semantic links between concepts" },
    { id: "hierarchy",       name: "Hierarchy",         category: "Structure",  desc: "Tree: taxonomy or classification" },
    { id: "onion_model",     name: "Onion Model",       category: "Structure",  desc: "Concentric layers from core outward" },
    { id: "wbs",             name: "WBS",               category: "Structure",  desc: "Work breakdown: project → deliverables" },
    { id: "bracket_tree",    name: "Bracket Tree",      category: "Structure",  desc: "Hierarchical bracket / syntax tree" },
    // Process
    { id: "process_schema",  name: "Process Schema",    category: "Process",    desc: "Sequential methodology phases" },
    { id: "flowchart",       name: "Flowchart",         category: "Process",    desc: "Decision flow with Yes/No branches" },
    { id: "cycle",           name: "Cycle",             category: "Process",    desc: "Circular loop: PDCA, ADDIE, etc." },
    { id: "pipeline_flow",   name: "Pipeline Flow",     category: "Process",    desc: "Processing pipeline with data annotations" },
    { id: "gantt",           name: "Gantt Chart",       category: "Process",    desc: "Task bars on a horizontal time axis" },
    { id: "timeline",        name: "Timeline",          category: "Process",    desc: "Chronological sequence of events" },
    // Conceptual
    { id: "framework",       name: "Framework",         category: "Conceptual", desc: "Theoretical model: inputs → process → outputs" },
    { id: "relationship",    name: "Relationship",      category: "Conceptual", desc: "Entity/factor connection web" },
    { id: "venn",            name: "Venn Diagram",      category: "Conceptual", desc: "Overlapping sets and intersections" },
    { id: "comparison",      name: "Comparison Table",  category: "Conceptual", desc: "Side-by-side structured comparison" },
    { id: "architecture",    name: "Architecture",      category: "Conceptual", desc: "Layered system or model architecture" },
    { id: "ecosystem_map",   name: "Ecosystem Map",     category: "Conceptual", desc: "Focal entity + surrounding actors" },
    // Analysis
    { id: "matrix_2x2",      name: "2×2 Matrix",        category: "Analysis",   desc: "Strategic quadrant map (BCG, priority)" },
    { id: "force_field",     name: "Force Field",       category: "Analysis",   desc: "Lewin: driving vs restraining forces" },
    { id: "fishbone",        name: "Fishbone",          category: "Analysis",   desc: "Ishikawa cause-effect diagram" },
    { id: "causal_loop",     name: "Causal Loop",       category: "Analysis",   desc: "Variables with +/– feedback arcs" },
    { id: "swot",            name: "SWOT",              category: "Analysis",   desc: "Strengths / Weaknesses / Opportunities / Threats" },
    { id: "stakeholder_map", name: "Stakeholder Map",   category: "Analysis",   desc: "Stakeholders by proximity/influence" },
    { id: "value_chain",     name: "Value Chain",       category: "Analysis",   desc: "Porter's primary + support activities" },
    // Academic / Technical
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

// ── Visual type card ──────────────────────────────────────────────────────────

function VisualCard({
    entry, selected, onClick,
}: {
    entry: VisualEntry; selected: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full text-left rounded-xl border transition-all duration-150 px-3 py-2.5
                ${selected
                    ? "border-[#1a1a1a] bg-[#1a1a1a]"
                    : "border-[#ebebeb] bg-white hover:border-[#aaa] hover:shadow-sm"
                }`}
        >
            <p className={`text-[11px] font-bold leading-tight ${selected ? "text-white" : "text-[#1a1a1a]"}`}>
                {entry.name}
            </p>
            <p className={`text-[10px] mt-0.5 font-medium leading-tight ${selected ? "text-gray-300" : "text-gray-400"}`}>
                {entry.desc}
            </p>
        </button>
    );
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({
    category, entries, selected, onSelect, defaultOpen,
}: {
    category: string;
    entries: VisualEntry[];
    selected: string;
    onSelect: (id: string) => void;
    defaultOpen: boolean;
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
                                <VisualCard
                                    key={e.id}
                                    entry={e}
                                    selected={selected === e.id}
                                    onClick={() => onSelect(e.id)}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
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

    const [tikzCode, setTikzCode] = useState("");
    const [pdfBase64, setPdfBase64] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

    const [elapsed, setElapsed] = useState(0);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const prevUrlRef = useRef<string | null>(null);

    // Auto-grow textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }, [prompt]);

    // Revoke old blob URLs to avoid leaks
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
        <div className="flex h-screen bg-white overflow-hidden">
            {/* ── Left sidebar: type catalogue ── */}
            <aside className="w-60 flex-shrink-0 border-r border-[#ebebeb] flex flex-col bg-[#fafafa] overflow-hidden">
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

            {/* ── Main area ── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* ── Top bar ── */}
                <div className="border-b border-[#ebebeb] px-6 py-3 flex items-center gap-3 bg-white">
                    <div className="flex-1 min-w-0">
                        <span className="text-[12px] font-semibold text-[#1a1a1a]">
                            {selectedEntry?.name ?? "Select a type"}
                        </span>
                        <span className="ml-2 text-[11px] text-gray-400">
                            {selectedEntry?.desc}
                        </span>
                    </div>

                    {/* Language selector */}
                    <select
                        value={language}
                        onChange={e => setLanguage(e.target.value)}
                        className="text-[12px] border border-[#ddd] rounded-lg px-2 py-1.5 bg-white text-[#1a1a1a] focus:outline-none focus:border-[#aaa] cursor-pointer"
                    >
                        {LANGUAGES.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                </div>

                {/* ── Content area ── */}
                <div className="flex-1 overflow-auto flex flex-col">
                    {/* Prompt input area */}
                    <div className="px-6 pt-5 pb-3">
                        <div className="relative border border-[#ebebeb] rounded-2xl bg-white shadow-sm overflow-hidden focus-within:border-[#aaa] transition-colors">
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={`Describe the ${selectedEntry?.name ?? "diagram"} you want to create…\n\ne.g. "Research pipeline: data collection → preprocessing → model training → evaluation → deployment"`}
                                className="w-full resize-none px-4 pt-4 pb-12 text-[13px] text-[#1a1a1a] placeholder-gray-300 focus:outline-none leading-relaxed min-h-[80px]"
                                style={{ height: "auto" }}
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
                            <div className="absolute bottom-3.5 left-4 text-[10px] text-gray-300">
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
                                className="mx-6 mb-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2"
                            >
                                <span className="flex-1">{error}</span>
                                <button onClick={() => setError(null)} className="flex-shrink-0 mt-0.5">
                                    <IconX size={13} className="text-red-400 hover:text-red-600" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Result area */}
                    <AnimatePresence>
                        {hasResult && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25 }}
                                className="flex-1 mx-6 mb-6 flex flex-col gap-3 min-h-0"
                            >
                                {/* Action bar */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowCode(s => !s)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors
                                            ${showCode
                                                ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                                                : "bg-white text-[#555] border-[#ddd] hover:border-[#aaa]"
                                            }`}
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
                                        <button
                                            onClick={handleDownloadTex}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors"
                                        >
                                            <IconDownload size={12} />
                                            .tex
                                        </button>
                                    )}
                                    {pdfUrl && (
                                        <button
                                            onClick={handleDownloadPdf}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#ddd] bg-white text-[#555] hover:border-[#aaa] transition-colors"
                                        >
                                            <IconDownload size={12} />
                                            PDF
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

                                {/* Split view: PDF + code */}
                                <div className={`flex gap-3 flex-1 min-h-0 ${showCode ? "" : "flex-col"}`}>
                                    {/* PDF preview */}
                                    {pdfUrl && (
                                        <div className={`${showCode ? "flex-1" : "w-full"} rounded-2xl border border-[#ebebeb] overflow-hidden bg-[#f8f8f8] min-h-[350px]`}>
                                            <iframe
                                                src={pdfUrl}
                                                className="w-full h-full"
                                                style={{ minHeight: "350px", border: "none" }}
                                                title="TikZ diagram preview"
                                            />
                                        </div>
                                    )}

                                    {/* TikZ code panel */}
                                    {showCode && tikzCode && (
                                        <div className={`${pdfUrl ? "w-[45%]" : "w-full"} rounded-2xl border border-[#ebebeb] bg-[#1e1e2e] overflow-hidden flex flex-col min-h-[350px]`}>
                                            <div className="flex items-center justify-between px-4 py-2 border-b border-[#ffffff15]">
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
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center max-w-sm">
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
                                <p className="text-[13px] font-semibold text-[#1a1a1a] mb-1">
                                    Select a diagram type and describe it
                                </p>
                                <p className="text-[12px] text-gray-400 leading-relaxed">
                                    TikZ diagrams compile to PDF and embed in your LaTeX documents.
                                    Supports 30 diagram types across 5 categories.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Loading state */}
                    {loading && !hasResult && (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <IconLoader2 size={28} className="animate-spin text-gray-300 mx-auto mb-3" />
                                <p className="text-[12px] text-gray-400">
                                    Generating {selectedEntry?.name}… {elapsed.toFixed(0)}s
                                </p>
                                <p className="text-[11px] text-gray-300 mt-1">
                                    LLM → TikZ → LaTeX compiler → PDF
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
