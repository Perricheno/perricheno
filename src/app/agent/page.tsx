"use client";

import { useState, useRef, useEffect } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip,
    IconFileText, IconBook, IconPackage, IconDownload,
    IconX, IconPencil, IconCheck, IconSparkles, IconEye
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import JSZip from "jszip";

type DocType = "research" | "assignment" | "report" | "lab_report" | "literature_review" | "diploma" | "case_study";

type Stage = {
    label: string;
    progress: number;
    status: "pending" | "active" | "done";
};

export default function AgentPage() {
    const [prompt, setPrompt] = useState("");
    const [docType, setDocType] = useState<DocType>("research");
    const [phase, setPhase] = useState<"idle" | "generating" | "done">("idle");
    const [isEditing, setIsEditing] = useState(false);
    const [editPrompt, setEditPrompt] = useState("");
    const [viewerOpen, setViewerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"tex" | "bib">("tex");
    const [mainTex, setMainTex] = useState("");
    const [referencesBib, setReferencesBib] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [topic, setTopic] = useState("");

    // Progress stages
    const [stages, setStages] = useState<Stage[]>([
        { label: "Analyzing topic", progress: 0, status: "pending" },
        { label: "Structuring sections", progress: 0, status: "pending" },
        { label: "Writing content", progress: 0, status: "pending" },
        { label: "Generating references", progress: 0, status: "pending" },
        { label: "Formatting LaTeX", progress: 0, status: "pending" },
    ]);
    const [overallProgress, setOverallProgress] = useState(0);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const suggestions: { label: string; type: DocType }[] = [
        { label: "Research Paper", type: "research" },
        { label: "Assignment", type: "assignment" },
        { label: "Lab Report", type: "lab_report" },
        { label: "Literature Review", type: "literature_review" },
        { label: "Diploma Project", type: "diploma" },
        { label: "Case Study", type: "case_study" },
    ];

    // Animate progress stages while generating
    const startProgressAnimation = () => {
        let progress = 0;
        const stageThresholds = [15, 35, 70, 85, 95];

        progressIntervalRef.current = setInterval(() => {
            progress += Math.random() * 2 + 0.5;
            if (progress > 95) progress = 95; // Cap at 95 until API returns

            setOverallProgress(Math.round(progress));
            setStages(prev => prev.map((s, i) => {
                const start = i === 0 ? 0 : stageThresholds[i - 1];
                const end = stageThresholds[i];
                const stageProgress = Math.min(100, Math.max(0, ((progress - start) / (end - start)) * 100));

                if (progress >= end) return { ...s, progress: 100, status: "done" };
                if (progress >= start) return { ...s, progress: Math.round(stageProgress), status: "active" };
                return { ...s, progress: 0, status: "pending" };
            }));
        }, 200);
    };

    const stopProgressAnimation = (success: boolean) => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        if (success) {
            setOverallProgress(100);
            setStages(prev => prev.map(s => ({ ...s, progress: 100, status: "done" })));
        }
    };

    const generate = async (text: string, type: DocType = docType, isEdit = false) => {
        if (!text.trim()) return;

        setError(null);
        setPhase("generating");
        setTopic(text);
        setDocType(type);
        setIsEditing(false);
        setOverallProgress(0);
        setStages(prev => prev.map(s => ({ ...s, progress: 0, status: "pending" })));
        startProgressAnimation();

        try {
            const body: any = { prompt: text, type };
            if (isEdit && mainTex) {
                body.currentTex = mainTex;
                body.currentBib = referencesBib;
            }

            const res = await fetch('/api/agent/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Generation failed");

            setMainTex(data.main_tex);
            setReferencesBib(data.references_bib || null);
            stopProgressAnimation(true);

            setTimeout(() => setPhase("done"), 600);
        } catch (err: any) {
            stopProgressAnimation(false);
            setError(err.message);
            setPhase("done");
        }
    };

    const handleEdit = () => {
        if (!editPrompt.trim()) return;
        generate(editPrompt, docType, true);
        setEditPrompt("");
    };

    const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const downloadZip = async () => {
        const zip = new JSZip();
        zip.file("main.tex", mainTex);
        if (referencesBib) zip.file("references.bib", referencesBib);
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `latex_project_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    // ─── LANDING ───
    if (phase === "idle") {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center font-sans bg-[var(--background)]">
                <div className="w-full max-w-3xl px-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h2 className="text-3xl md:text-4xl font-semibold text-[var(--foreground)] mb-10 text-center tracking-tight">
                        What do you want to research?
                    </h2>

                    <div className="w-full relative shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[calc(var(--radius)+0.5rem)] bg-[var(--card)] border border-[var(--border)] overflow-hidden">
                        <div className="px-5 pt-5 pb-16">
                            <span className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wider">Generate LaTeX with AI</span>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        generate(prompt);
                                    }
                                }}
                                placeholder="Research paper on machine learning in healthcare..."
                                className="w-full h-14 outline-none resize-none bg-transparent text-lg md:text-xl placeholder:text-gray-300 font-medium"
                                autoFocus
                            />
                        </div>

                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button className="p-2.5 text-gray-400 hover:text-[var(--foreground)] hover:bg-black/5 rounded-full transition-colors">
                                    <IconPaperclip className="w-5 h-5" />
                                </button>
                                <div className="hidden md:flex flex-wrap gap-2 md:max-w-xl">
                                    {suggestions.map((s, i) => (
                                        <button key={i} onClick={() => setPrompt(s.label + ": ")} className="px-3 py-1.5 text-[13px] font-medium text-gray-500 bg-[var(--background)] hover:bg-black/5 border border-[var(--border)] rounded-full transition-colors whitespace-nowrap">
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={() => generate(prompt)}
                                disabled={!prompt.trim()}
                                className="p-3 rounded-full bg-[var(--foreground)] text-[var(--card)] hover:opacity-90 disabled:opacity-30 transition-all flex items-center justify-center shrink-0 shadow-sm"
                            >
                                <IconArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── GENERATING ───
    if (phase === "generating") {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center font-sans bg-[var(--background)] p-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-lg"
                >
                    {/* Overall progress circle */}
                    <div className="flex flex-col items-center mb-12">
                        <div className="relative w-28 h-28 mb-4">
                            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border)" strokeWidth="6" />
                                <circle
                                    cx="50" cy="50" r="44" fill="none"
                                    stroke="var(--foreground)"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 44}`}
                                    strokeDashoffset={`${2 * Math.PI * 44 * (1 - overallProgress / 100)}`}
                                    className="transition-all duration-300"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-2xl font-bold tracking-tight">{overallProgress}%</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-400 font-medium">{topic}</p>
                    </div>

                    {/* Stages */}
                    <div className="space-y-5">
                        {stages.map((stage, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        {stage.status === "done" ? (
                                            <div className="w-5 h-5 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                                                <IconCheck className="w-3 h-3 text-white" />
                                            </div>
                                        ) : stage.status === "active" ? (
                                            <div className="w-5 h-5 rounded-full border-2 border-[var(--foreground)] flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-[var(--foreground)] animate-pulse" />
                                            </div>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border-2 border-[var(--border)]" />
                                        )}
                                        <span className={`text-sm font-medium ${stage.status === "pending" ? "text-gray-300" : "text-[var(--foreground)]"}`}>
                                            {stage.label}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-mono tabular-nums ${stage.status === "pending" ? "text-gray-300" : "text-gray-500"}`}>
                                        {stage.progress}%
                                    </span>
                                </div>
                                <div className="h-1.5 bg-[var(--border)] rounded-full overflow-hidden ml-7">
                                    <motion.div
                                        className="h-full bg-[var(--foreground)] rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${stage.progress}%` }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── DONE ───
    const displayedCode = activeTab === "tex" ? mainTex : (referencesBib || "");
    const displayedFilename = activeTab === "tex" ? "main.tex" : "references.bib";

    return (
        <div className="w-full h-full flex flex-col items-center justify-center font-sans bg-[var(--background)] p-6 relative">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-lg text-center"
            >
                {error ? (
                    <>
                        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
                            <IconX className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-2xl font-bold mb-3">Generation Failed</h2>
                        <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">{error}</p>
                        <button onClick={() => { setPhase("idle"); setError(null); }} className="px-6 py-3 bg-[var(--foreground)] text-[var(--card)] rounded-full font-semibold text-sm hover:opacity-90 transition-opacity">
                            Try Again
                        </button>
                    </>
                ) : (
                    <>
                        {/* Success state */}
                        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                            <IconCheck className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Document Ready</h2>
                        <p className="text-sm text-gray-400 mb-1 font-medium">{topic}</p>
                        <p className="text-xs text-gray-300 mb-8 uppercase tracking-wider">{docType.replace("_", " ")}{referencesBib ? " • with references" : ""}</p>

                        {/* Action buttons */}
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <button
                                onClick={() => setViewerOpen(true)}
                                className="flex items-center gap-2 px-5 py-3 bg-[var(--foreground)] text-[var(--card)] rounded-full font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm"
                            >
                                <IconEye className="w-4 h-4" /> View Files
                            </button>
                            <button
                                onClick={downloadZip}
                                className="flex items-center gap-2 px-5 py-3 bg-white text-[var(--foreground)] border border-[var(--border)] rounded-full font-semibold text-sm hover:border-[var(--foreground)] transition-colors"
                            >
                                <IconPackage className="w-4 h-4" /> Download ZIP
                            </button>
                        </div>

                        {/* Edit section */}
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[var(--foreground)] transition-colors font-medium"
                            >
                                <IconPencil className="w-3.5 h-3.5" /> Edit document
                            </button>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-4 w-full"
                            >
                                <div className="relative border border-[var(--border)] rounded-[1.25rem] bg-white shadow-sm focus-within:shadow-md focus-within:border-[var(--foreground)] transition-all">
                                    <textarea
                                        value={editPrompt}
                                        onChange={(e) => setEditPrompt(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleEdit();
                                            }
                                        }}
                                        placeholder="Add more detail to methodology..."
                                        className="w-full bg-transparent p-4 pr-12 outline-none resize-none text-[15px] placeholder:text-gray-300 max-h-32 min-h-[56px] font-medium"
                                        rows={1}
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleEdit}
                                        disabled={!editPrompt.trim()}
                                        className="absolute right-3 bottom-3 p-1.5 rounded-full bg-[var(--foreground)] text-[var(--card)] disabled:opacity-30 transition-colors"
                                    >
                                        <IconArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* New generation */}
                        <div className="mt-8 pt-6 border-t border-[var(--border)]">
                            <button
                                onClick={() => { setPhase("idle"); setMainTex(""); setReferencesBib(null); setError(null); }}
                                className="text-xs text-gray-300 hover:text-gray-500 transition-colors font-medium uppercase tracking-wider"
                            >
                                New Document
                            </button>
                        </div>
                    </>
                )}
            </motion.div>

            {/* ═══ FILE VIEWER MODAL ═══ */}
            <AnimatePresence>
                {viewerOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setViewerOpen(false)}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "100%", opacity: 0 }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed inset-x-0 bottom-0 z-50 h-[85vh] md:inset-4 md:h-auto md:rounded-[var(--radius)] bg-[var(--card)] border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Toolbar */}
                            <div className="h-14 bg-white border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setActiveTab("tex")}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                                            activeTab === "tex" ? "bg-emerald-50 text-emerald-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                        }`}
                                    >
                                        <IconFileText className="w-4 h-4" /> main.tex
                                    </button>
                                    {referencesBib && (
                                        <button
                                            onClick={() => setActiveTab("bib")}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                                                activeTab === "bib" ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                            }`}
                                        >
                                            <IconBook className="w-4 h-4" /> references.bib
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => downloadFile(displayedCode, displayedFilename)}
                                        className="flex items-center gap-2 text-xs font-semibold px-3 py-2 text-gray-500 hover:text-[var(--foreground)] hover:bg-gray-50 rounded-lg transition-colors"
                                    >
                                        <IconDownload className="w-4 h-4" />
                                        <span className="hidden sm:inline">{displayedFilename}</span>
                                    </button>
                                    <button
                                        onClick={() => setViewerOpen(false)}
                                        className="p-2 text-gray-400 hover:text-[var(--foreground)] hover:bg-gray-50 rounded-lg transition-colors"
                                    >
                                        <IconX className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Code */}
                            <div className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed text-gray-700 bg-gray-50/50">
                                <pre className="m-0 w-full min-h-full whitespace-pre-wrap" tabIndex={0}>
                                    <code>{displayedCode}</code>
                                </pre>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
