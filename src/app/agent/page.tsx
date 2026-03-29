"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip,
    IconFileText, IconBook, IconPackage, IconDownload,
    IconX, IconPencil, IconCheck, IconEye, IconBug,
    IconClock, IconLetterCase, IconSettings, IconChevronDown
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import JSZip from "jszip";

type DocType = "research" | "assignment" | "report" | "lab_report" | "literature_review" | "diploma" | "case_study";
type Style = "simple" | "medium" | "phd";
type Language = "en" | "ru";

interface AgentSettings {
    useTemplate: boolean;
    style: Style;
    wordCount: number;
    columns: 1 | 2;
    useReferences: boolean;
    language: Language;
    authorName: string;
    courseName: string;
    dateStr: string;
    groupName: string;
    supervisorName: string;
}

const DEFAULT_SETTINGS: AgentSettings = {
    useTemplate: false,
    style: "medium",
    wordCount: 2000,
    columns: 2,
    useReferences: true,
    language: "en",
    authorName: "",
    courseName: "",
    dateStr: "",
    groupName: "",
    supervisorName: "",
};

export default function AgentPage() {
    const [prompt, setPrompt] = useState("");
    const [docType, setDocType] = useState<DocType>("research");
    const [phase, setPhase] = useState<"idle" | "streaming" | "done">("idle");
    const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editPrompt, setEditPrompt] = useState("");
    const [isFixingErrors, setIsFixingErrors] = useState(false);
    const [errorLogInput, setErrorLogInput] = useState("");
    const [viewerOpen, setViewerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"tex" | "bib">("tex");
    const [mainTex, setMainTex] = useState("");
    const [referencesBib, setReferencesBib] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [topic, setTopic] = useState("");

    // Streaming state
    const [streamText, setStreamText] = useState("");
    const [streamChars, setStreamChars] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamBoxRef = useRef<HTMLDivElement>(null);

    const suggestions: { label: string; type: DocType }[] = [
        { label: "Research Paper", type: "research" },
        { label: "Assignment", type: "assignment" },
        { label: "Lab Report", type: "lab_report" },
        { label: "Literature Review", type: "literature_review" },
        { label: "Diploma Project", type: "diploma" },
        { label: "Case Study", type: "case_study" },
    ];

    useEffect(() => {
        if (streamBoxRef.current) streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight;
    }, [streamText]);

    const startTimer = () => {
        setElapsedTime(0);
        timerRef.current = setInterval(() => setElapsedTime(t => t + 0.1), 100);
    };
    const stopTimer = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    const parseResult = (fullText: string) => {
        let clean = fullText.trim();
        if (clean.startsWith("```")) clean = clean.replace(/^```(?:json)?\s*/, "");
        if (clean.endsWith("```")) clean = clean.replace(/```\s*$/, "");
        const parsed = JSON.parse(clean);
        if (!parsed.main_tex) throw new Error("Invalid output — missing main_tex");
        return { main_tex: parsed.main_tex, references_bib: parsed.references_bib || null };
    };

    const streamGenerate = useCallback(async (body: Record<string, any>, topicText: string) => {
        setError(null);
        setPhase("streaming");
        setTopic(topicText);
        setStreamText("");
        setStreamChars(0);
        setIsEditing(false);
        setIsFixingErrors(false);
        startTimer();

        try {
            const res = await fetch('/api/agent/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(errorData.error || `HTTP ${res.status}`);
            }

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let accumulated = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                accumulated += chunk;
                setStreamText(accumulated);
                setStreamChars(accumulated.length);
            }

            stopTimer();
            const result = parseResult(accumulated);
            setMainTex(result.main_tex);
            setReferencesBib(result.references_bib);
            setActiveTab("tex");
            setPhase("done");
        } catch (err: any) {
            stopTimer();
            setError(err.message);
            setPhase("done");
        }
    }, []);

    const generate = (text: string, type: DocType = docType) => {
        if (!text.trim()) return;
        setDocType(type);
        setPrompt("");
        streamGenerate({
            prompt: text, type,
            ...settings,
        }, text);
    };

    const handleEdit = () => {
        if (!editPrompt.trim()) return;
        const text = editPrompt;
        setEditPrompt("");
        streamGenerate({
            prompt: text, type: docType,
            ...settings,
            currentTex: mainTex, currentBib: referencesBib,
        }, topic + " → edit");
    };

    const fixErrors = () => {
        if (!errorLogInput.trim() || !mainTex) return;
        const log = errorLogInput;
        setErrorLogInput("");
        streamGenerate({
            errorLog: log, type: docType,
            ...settings,
            currentTex: mainTex, currentBib: referencesBib,
        }, topic + " → fix");
    };

    const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    };

    const downloadZip = async () => {
        const zip = new JSZip();
        zip.file("main.tex", mainTex);
        if (referencesBib) zip.file("references.bib", referencesBib);
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `latex_project_${Date.now()}.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    };

    const updateSetting = <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // ── Reusable setting components ──
    const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
            <button
                onClick={() => onChange(!value)}
                className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-[var(--foreground)]' : 'bg-[var(--border)]'}`}
            >
                <div className={`w-4.5 h-4.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm absolute top-[3px] transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
            </button>
        </div>
    );

    const SegmentedControl = ({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: any) => void }) => (
        <div className="flex bg-[var(--background)] rounded-xl p-1 border border-[var(--border)]">
            {options.map(o => (
                <button
                    key={o.value}
                    onClick={() => onChange(o.value)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${value === o.value ? 'bg-white text-[var(--foreground)] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );

    // ─── LANDING ───
    if (phase === "idle") {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center font-sans bg-[var(--background)] overflow-y-auto">
                <div className="w-full max-w-3xl px-6 flex flex-col items-center py-12">
                    <h2 className="text-3xl md:text-4xl font-semibold text-[var(--foreground)] mb-10 text-center tracking-tight">
                        What do you want to research?
                    </h2>

                    {/* Prompt input */}
                    <div className="w-full relative shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[calc(var(--radius)+0.5rem)] bg-[var(--card)] border border-[var(--border)] overflow-hidden mb-4">
                        <div className="px-5 pt-5 pb-16">
                            <span className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wider">Generate LaTeX with AI</span>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(prompt); }
                                }}
                                placeholder={settings.language === 'ru' ? "Исследование ИИ в Казахстане..." : "Research paper on machine learning in healthcare..."}
                                className="w-full h-14 outline-none resize-none bg-transparent text-lg md:text-xl placeholder:text-gray-300 font-medium"
                                autoFocus
                            />
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-2.5 rounded-full transition-colors ${settingsOpen ? 'text-[var(--foreground)] bg-black/5' : 'text-gray-400 hover:text-[var(--foreground)] hover:bg-black/5'}`}>
                                    <IconSettings className="w-5 h-5" />
                                </button>
                                <div className="hidden md:flex flex-wrap gap-2 md:max-w-xl">
                                    {suggestions.map((s, i) => (
                                        <button key={i} onClick={() => setPrompt(s.label + ": ")} className="px-3 py-1.5 text-[13px] font-medium text-gray-500 bg-[var(--background)] hover:bg-black/5 border border-[var(--border)] rounded-full transition-colors whitespace-nowrap">
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={() => generate(prompt)} disabled={!prompt.trim()} className="p-3 rounded-full bg-[var(--foreground)] text-[var(--card)] hover:opacity-90 disabled:opacity-30 transition-all flex items-center justify-center shrink-0 shadow-sm">
                                <IconArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Settings Panel */}
                    <AnimatePresence>
                        {settingsOpen && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="w-full overflow-hidden"
                            >
                                <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-6 space-y-5">

                                    {/* Row 1: Language + Style */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Language</label>
                                            <SegmentedControl
                                                options={[{ label: "English", value: "en" }, { label: "Русский", value: "ru" }]}
                                                value={settings.language}
                                                onChange={(v) => updateSetting("language", v)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Style</label>
                                            <SegmentedControl
                                                options={[{ label: "Simple", value: "simple" }, { label: "Medium", value: "medium" }, { label: "PhD", value: "phd" }]}
                                                value={settings.style}
                                                onChange={(v) => updateSetting("style", v)}
                                            />
                                        </div>
                                    </div>

                                    {/* Row 2: Word count slider */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Word count</label>
                                            <span className="text-sm font-mono font-bold text-[var(--foreground)] tabular-nums">{settings.wordCount.toLocaleString()}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={500}
                                            max={6000}
                                            step={250}
                                            value={settings.wordCount}
                                            onChange={(e) => updateSetting("wordCount", Number(e.target.value))}
                                            className="w-full h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer accent-[var(--foreground)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[var(--foreground)] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
                                        />
                                        <div className="flex justify-between text-[10px] text-gray-300 font-mono">
                                            <span>500</span><span>2000</span><span>4000</span><span>6000</span>
                                        </div>
                                    </div>

                                    {/* Row 3: Toggles */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Columns</label>
                                            <SegmentedControl
                                                options={[{ label: "One", value: "1" }, { label: "Two", value: "2" }]}
                                                value={String(settings.columns)}
                                                onChange={(v) => updateSetting("columns", Number(v) as 1 | 2)}
                                            />
                                        </div>
                                        <div className="space-y-3 pt-5 md:pt-0 md:space-y-2">
                                            <Toggle label="Use Perricheno Template" value={settings.useTemplate} onChange={(v) => updateSetting("useTemplate", v)} />
                                            <Toggle label="Include References" value={settings.useReferences} onChange={(v) => updateSetting("useReferences", v)} />
                                        </div>
                                    </div>

                                    {/* Collapsible details */}
                                    <div>
                                        <button onClick={() => setDetailsOpen(!detailsOpen)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wider">
                                            <IconChevronDown className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
                                            Document details
                                        </button>
                                        <AnimatePresence>
                                            {detailsOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                                                        {[
                                                            { key: "authorName" as const, label: settings.language === 'ru' ? "Автор" : "Author", placeholder: "Amangeldy Shyngyskhan" },
                                                            { key: "courseName" as const, label: settings.language === 'ru' ? "Курс" : "Course", placeholder: "Data Science" },
                                                            { key: "groupName" as const, label: settings.language === 'ru' ? "Группа" : "Group", placeholder: "SE-2201" },
                                                            { key: "supervisorName" as const, label: settings.language === 'ru' ? "Преподаватель" : "Supervisor", placeholder: "Dr. Smith" },
                                                            { key: "dateStr" as const, label: settings.language === 'ru' ? "Дата" : "Date", placeholder: "\\today" },
                                                        ].map(f => (
                                                            <div key={f.key} className="space-y-1">
                                                                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{f.label}</label>
                                                                <input
                                                                    type="text"
                                                                    value={settings[f.key]}
                                                                    onChange={(e) => updateSetting(f.key, e.target.value)}
                                                                    placeholder={f.placeholder}
                                                                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-[var(--foreground)] transition-colors placeholder:text-gray-300"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    }

    // ─── STREAMING ───
    if (phase === "streaming") {
        const estimatedProgress = Math.min(95, Math.round((streamChars / (settings.wordCount * 6)) * 100));
        return (
            <div className="w-full h-full flex flex-col font-sans bg-[var(--background)] p-4 md:p-6 overflow-hidden">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full h-full flex flex-col max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-sm font-mono text-[var(--foreground)]">
                                <IconClock className="w-4 h-4 text-gray-400" />
                                <span className="tabular-nums">{elapsedTime.toFixed(1)}s</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-mono text-[var(--foreground)]">
                                <IconLetterCase className="w-4 h-4 text-gray-400" />
                                <span className="tabular-nums">{streamChars.toLocaleString()}</span>
                                <span className="text-gray-300 text-xs">chars</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-gray-400 tabular-nums">{estimatedProgress}%</span>
                            <div className="w-32 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                                <motion.div className="h-full bg-[var(--foreground)] rounded-full" animate={{ width: `${estimatedProgress}%` }} transition={{ duration: 0.3 }} />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] shadow-sm overflow-hidden flex flex-col">
                        <div className="h-10 bg-white border-b border-[var(--border)] flex items-center px-4 gap-2 shrink-0">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-mono text-gray-400">streaming response</span>
                            <span className="text-xs text-gray-300 ml-auto truncate max-w-[200px]">{topic}</span>
                        </div>
                        <div ref={streamBoxRef} className="flex-1 overflow-auto p-4 md:p-6 font-mono text-[13px] leading-relaxed text-gray-600 bg-gray-50/50">
                            <pre className="m-0 whitespace-pre-wrap break-all">{streamText}<span className="animate-pulse text-[var(--foreground)]">▊</span></pre>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── DONE ───
    const displayedCode = activeTab === "tex" ? mainTex : (referencesBib || "");
    const displayedFilename = activeTab === "tex" ? "main.tex" : "references.bib";

    return (
        <div className="w-full h-full flex flex-col items-center justify-center font-sans bg-[var(--background)] p-6 relative overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="w-full max-w-lg text-center">
                {error ? (
                    <>
                        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6"><IconX className="w-8 h-8 text-red-500" /></div>
                        <h2 className="text-2xl font-bold mb-3">Generation Failed</h2>
                        <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">{error}</p>
                        <button onClick={() => { setPhase("idle"); setError(null); }} className="px-6 py-3 bg-[var(--foreground)] text-[var(--card)] rounded-full font-semibold text-sm hover:opacity-90 transition-opacity">Try Again</button>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6"><IconCheck className="w-8 h-8 text-emerald-500" /></div>
                        <h2 className="text-2xl font-bold mb-2">Document Ready</h2>
                        <p className="text-sm text-gray-400 mb-1 font-medium">{topic}</p>
                        <div className="flex items-center justify-center gap-3 text-xs text-gray-300 mb-8 flex-wrap">
                            <span className="uppercase tracking-wider">{docType.replace("_", " ")}</span>
                            <span>•</span>
                            <span>{settings.style}</span>
                            {referencesBib && <><span>•</span><span>refs</span></>}
                            <span>•</span>
                            <span className="font-mono tabular-nums">{elapsedTime.toFixed(1)}s</span>
                            <span>•</span>
                            <span className="font-mono tabular-nums">{streamChars.toLocaleString()} chars</span>
                        </div>

                        <div className="flex items-center justify-center gap-3 mb-6">
                            <button onClick={() => setViewerOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-[var(--foreground)] text-[var(--card)] rounded-full font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
                                <IconEye className="w-4 h-4" /> View Files
                            </button>
                            <button onClick={downloadZip} className="flex items-center gap-2 px-5 py-3 bg-white text-[var(--foreground)] border border-[var(--border)] rounded-full font-semibold text-sm hover:border-[var(--foreground)] transition-colors">
                                <IconPackage className="w-4 h-4" /> Download ZIP
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-4 mb-2">
                            <button onClick={() => { setIsEditing(!isEditing); setIsFixingErrors(false); }} className={`inline-flex items-center gap-1.5 text-sm transition-colors font-medium ${isEditing ? 'text-[var(--foreground)]' : 'text-gray-400 hover:text-[var(--foreground)]'}`}>
                                <IconPencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <span className="text-gray-200">|</span>
                            <button onClick={() => { setIsFixingErrors(!isFixingErrors); setIsEditing(false); }} className={`inline-flex items-center gap-1.5 text-sm transition-colors font-medium ${isFixingErrors ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}>
                                <IconBug className="w-3.5 h-3.5" /> Fix Errors
                            </button>
                        </div>

                        <AnimatePresence>
                            {isEditing && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full overflow-hidden">
                                    <div className="relative border border-[var(--border)] rounded-[1.25rem] bg-white shadow-sm focus-within:shadow-md focus-within:border-[var(--foreground)] transition-all mt-3">
                                        <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); } }} placeholder={settings.language === 'ru' ? "Добавь больше деталей в методологию..." : "Add more detail to methodology..."} className="w-full bg-transparent p-4 pr-12 outline-none resize-none text-[15px] placeholder:text-gray-300 max-h-32 min-h-[56px] font-medium" rows={1} autoFocus />
                                        <button onClick={handleEdit} disabled={!editPrompt.trim()} className="absolute right-3 bottom-3 p-1.5 rounded-full bg-[var(--foreground)] text-[var(--card)] disabled:opacity-30 transition-colors"><IconArrowRight className="w-4 h-4" /></button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <AnimatePresence>
                            {isFixingErrors && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full overflow-hidden">
                                    <div className="mt-3 border border-red-200 rounded-[1.25rem] bg-red-50/50 shadow-sm overflow-hidden">
                                        <div className="px-4 pt-3 pb-1"><span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Paste compilation errors</span></div>
                                        <textarea value={errorLogInput} onChange={(e) => setErrorLogInput(e.target.value)} placeholder={"Runaway argument?\nExtra ), or forgotten \\endgroup..."} className="w-full bg-transparent px-4 py-2 outline-none resize-none text-[13px] font-mono placeholder:text-red-200 min-h-[100px] max-h-[200px] text-red-700" rows={4} autoFocus />
                                        <div className="px-4 pb-3 flex justify-end">
                                            <button onClick={fixErrors} disabled={!errorLogInput.trim()} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full text-xs font-semibold hover:bg-red-600 disabled:opacity-30 transition-colors">
                                                <IconBug className="w-3.5 h-3.5" /> Fix & Regenerate
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-8 pt-6 border-t border-[var(--border)]">
                            <button onClick={() => { setPhase("idle"); setMainTex(""); setReferencesBib(null); setError(null); }} className="text-xs text-gray-300 hover:text-gray-500 transition-colors font-medium uppercase tracking-wider">New Document</button>
                        </div>
                    </>
                )}
            </motion.div>

            {/* FILE VIEWER MODAL */}
            <AnimatePresence>
                {viewerOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewerOpen(false)} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
                        <motion.div
                            initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed inset-x-0 bottom-0 z-50 h-[85vh] md:inset-4 md:h-auto md:rounded-[var(--radius)] bg-[var(--card)] border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="h-14 bg-white border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setActiveTab("tex")} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${activeTab === "tex" ? "bg-emerald-50 text-emerald-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>
                                        <IconFileText className="w-4 h-4" /> main.tex
                                    </button>
                                    {referencesBib && (
                                        <button onClick={() => setActiveTab("bib")} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${activeTab === "bib" ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>
                                            <IconBook className="w-4 h-4" /> references.bib
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => downloadFile(displayedCode, displayedFilename)} className="flex items-center gap-2 text-xs font-semibold px-3 py-2 text-gray-500 hover:text-[var(--foreground)] hover:bg-gray-50 rounded-lg transition-colors">
                                        <IconDownload className="w-4 h-4" /><span className="hidden sm:inline">{displayedFilename}</span>
                                    </button>
                                    <button onClick={() => setViewerOpen(false)} className="p-2 text-gray-400 hover:text-[var(--foreground)] hover:bg-gray-50 rounded-lg transition-colors"><IconX className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed text-gray-700 bg-gray-50/50">
                                <pre className="m-0 w-full min-h-full whitespace-pre-wrap" tabIndex={0}><code>{displayedCode}</code></pre>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
