"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip,
    IconFileText, IconBook, IconPackage, IconDownload,
    IconX, IconPencil, IconCheck, IconEye, IconBug,
    IconClock, IconLetterCase, IconSettings
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import JSZip from "jszip";
import { useAdmin } from "@/components/AdminContext";

import { DocType, AgentSettings, DEFAULT_SETTINGS, RImage, AgentSession } from "./types";
import { AgentSettingsPanel } from "./AgentSettingsPanel";
import { AgentSidebar } from "./AgentSidebar";
import { AgentVisualizations } from "./AgentVisualizations";
import { REditorModal } from "./REditorModal";

export default function AgentPage() {
    const { user, setShowLogin } = useAdmin();

    const [prompt, setPrompt] = useState("");
    const [docType, setDocType] = useState<DocType>("research");
    const [phase, setPhase] = useState<"idle" | "streaming" | "done">("idle");
    const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);

    // Edit/Fix state
    const [isEditing, setIsEditing] = useState(false);
    const [editPrompt, setEditPrompt] = useState("");
    const [isFixingErrors, setIsFixingErrors] = useState(false);
    const [errorLogInput, setErrorLogInput] = useState("");

    // Output state
    const [viewerOpen, setViewerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"tex" | "bib">("tex");
    const [mainTex, setMainTex] = useState("");
    const [referencesBib, setReferencesBib] = useState<string | null>(null);
    const [rImages, setRImages] = useState<RImage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [topic, setTopic] = useState("");

    // Editor modal
    const [activeEditorIndex, setActiveEditorIndex] = useState<number | null>(null);

    // Sessions
    const [sessions, setSessions] = useState<AgentSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Streaming state
    const [streamText, setStreamText] = useState("");
    const [streamChars, setStreamChars] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamBoxRef = useRef<HTMLDivElement>(null);

    const EXPECTED_CHARS = settings.wordCount * 6;

    const suggestions: { label: string; type: DocType }[] = [
        { label: "Research Paper", type: "research" },
        { label: "Literature Review", type: "literature_review" },
        { label: "Data Analysis", type: "report" },
    ];

    useEffect(() => {
        if (user) loadSessions();
    }, [user]);

    useEffect(() => {
        if (streamBoxRef.current) streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight;
    }, [streamText]);

    const loadSessions = async () => {
        try {
            const res = await fetch('/api/agent/sessions');
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions);
            }
        } catch (e) {
            console.error("Failed to load sessions", e);
        }
    };

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
        if (!user) { setShowLogin(true); return; }

        setError(null);
        setPhase("streaming");
        setTopic(topicText);
        setStreamText("");
        setStreamChars(0);
        setIsEditing(false);
        setIsFixingErrors(false);
        startTimer();

        let accumulated = "";
        try {
            const res = await fetch('/api/agent/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: "Unknown API error" }));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                accumulated += decoder.decode(value, { stream: true });
                setStreamText(accumulated);
                setStreamChars(accumulated.length);
            }

            stopTimer();
            const result = parseResult(accumulated);
            setMainTex(result.main_tex);
            setReferencesBib(result.references_bib);

            // Auto-save session
            if (currentSessionId) {
                await fetch(`/api/agent/sessions/${currentSessionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: topicText,
                        main_tex: result.main_tex,
                        references_bib: result.references_bib,
                        settings_json: settings,
                    })
                });
            } else {
                const createRes = await fetch('/api/agent/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: topicText,
                        doc_type: body.type,
                        main_tex: result.main_tex,
                        references_bib: result.references_bib,
                        settings_json: settings,
                        r_images_json: rImages,
                    })
                });
                if (createRes.ok) {
                    const { session } = await createRes.json();
                    setCurrentSessionId(session.id);
                    setSessions(prev => [session, ...prev]);
                }
            }

            setActiveTab("tex");
            setPhase("done");
        } catch (err: any) {
            stopTimer();
            setError(err.message);
            // Even on error, show the stream output for debugging
            setMainTex(accumulated);
            setPhase("done");
        }
    }, [user, setShowLogin, currentSessionId, settings, rImages]);

    const handleGenerate = () => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;
        setDocType(docType);
        streamGenerate({ prompt, type: docType, ...settings }, prompt);
        setPrompt("");
    };

    const handleEdit = () => {
        if (!editPrompt.trim()) return;
        const text = editPrompt;
        setEditPrompt("");
        streamGenerate({ prompt: text, type: docType, ...settings, currentTex: mainTex, currentBib: referencesBib }, topic + " → edit");
    };

    const fixErrors = () => {
        if (!errorLogInput.trim() || !mainTex) return;
        const log = errorLogInput;
        setErrorLogInput("");
        streamGenerate({ errorLog: log, type: docType, ...settings, currentTex: mainTex, currentBib: referencesBib }, topic + " → fix");
    };

    // Session handlers
    const handleSelectSession = (s: AgentSession) => {
        setCurrentSessionId(s.id);
        setTopic(s.title);
        setDocType(s.doc_type);
        setMainTex(s.main_tex || "");
        setReferencesBib(s.references_bib);
        setRImages(s.r_images_json ? JSON.parse(s.r_images_json) : []);
        setSettings(s.settings_json ? JSON.parse(s.settings_json) : DEFAULT_SETTINGS);
        setPhase("done");
        setSidebarOpen(false);
    };

    const handleNewSession = () => {
        setCurrentSessionId(null);
        setTopic("");
        setMainTex("");
        setReferencesBib(null);
        setRImages([]);
        setSettings(DEFAULT_SETTINGS);
        setPrompt("");
        setPhase("idle");
        setSidebarOpen(false);
    };

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this document?")) return;
        await fetch(`/api/agent/sessions/${id}`, { method: 'DELETE' });
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) handleNewSession();
    };

    const handleShareSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const res = await fetch(`/api/agent/sessions/${id}/share`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            if (data.shared) {
                window.prompt("Share link:", window.location.origin + data.share_url);
            } else {
                alert("Unshared");
            }
            loadSessions(); // Reload to get share IDs updated
        }
    };

    const downloadZip = async () => {
        const zip = new JSZip();
        zip.file("main.tex", mainTex);
        if (referencesBib) zip.file("references.bib", referencesBib);
        rImages.forEach((img, i) => {
            const binary = atob(img.image);
            const bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
            zip.file(`figures/fig_${i + 1}_${img.chart_type}.png`, bytes);
            zip.file(`figures/fig_${i + 1}_${img.chart_type}.R`, img.r_code);
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `latex_project_${Date.now()}.zip`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    // ─── LANDING ───
    if (phase === "idle") {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center font-sans bg-[var(--background)] overflow-y-auto relative">
                <AgentSidebar
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    isOpen={sidebarOpen}
                    setIsOpen={setSidebarOpen}
                    onSelectSession={handleSelectSession}
                    onDeleteSession={handleDeleteSession}
                    onShareSession={handleShareSession}
                    onNewSession={handleNewSession}
                />

                <div className="w-full max-w-3xl px-6 flex flex-col items-center py-12">
                    <h2 className="text-3xl md:text-4xl font-semibold text-[var(--foreground)] mb-10 text-center tracking-tight">
                        What do you want to research?
                    </h2>

                    <div className="w-full relative shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[calc(var(--radius)+0.5rem)] bg-[var(--card)] border border-[var(--border)] overflow-hidden mb-4">
                        <div className="px-5 pt-5 pb-16">
                            <span className="text-xs font-semibold text-gray-400 mb-2 block uppercase tracking-wider">Generate LaTeX with AI</span>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
                                }}
                                placeholder={settings.language === 'ru' ? "Исследование ИИ в Казахстане..." : "Research paper..."}
                                className="w-full h-14 outline-none resize-none bg-transparent text-lg md:text-xl placeholder:text-gray-300 font-medium"
                                autoFocus
                            />
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-2.5 rounded-full transition-colors ${settingsOpen ? 'text-[var(--foreground)] bg-black/5' : 'text-gray-400 hover:text-[var(--foreground)] hover:bg-black/5'}`}>
                                    <IconSettings className="w-5 h-5" />
                                </button>
                                <div className="hidden md:flex gap-2">
                                    {suggestions.map((s, i) => (
                                        <button key={i} onClick={() => setPrompt(s.label + ": ")} className="px-3 py-1.5 text-[13px] font-medium text-gray-500 bg-[var(--background)] hover:bg-black/5 border border-[var(--border)] rounded-full transition-colors whitespace-nowrap">
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleGenerate} disabled={!prompt.trim()} className="p-3 rounded-full bg-[var(--foreground)] text-[var(--card)] hover:opacity-90 disabled:opacity-30 flex items-center shrink-0">
                                <IconArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {settingsOpen && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full overflow-hidden">
                                <AgentSettingsPanel
                                    settings={settings}
                                    updateSetting={(k, v) => setSettings({ ...settings, [k]: v })}
                                    detailsOpen={detailsOpen}
                                    setDetailsOpen={setDetailsOpen}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        );
    }

    // ─── STREAMING ───
    if (phase === "streaming") {
        const estimatedProgress = Math.min(95, Math.round((streamChars / EXPECTED_CHARS) * 100));
        return (
            <div className="w-full h-full flex flex-col font-sans bg-[var(--background)] p-4 md:p-6 overflow-hidden relative">
                <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full h-full flex flex-col max-w-4xl mx-auto pl-12 md:pl-0 pt-4 md:pt-0">
                    <div className="flex items-center justify-between mb-4 md:px-1">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-sm font-mono text-[var(--foreground)]">
                                <IconClock className="w-4 h-4 text-gray-400" /> <span className="tabular-nums">{elapsedTime.toFixed(1)}s</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1.5 text-sm font-mono text-[var(--foreground)]">
                                <IconLetterCase className="w-4 h-4 text-gray-400" /> <span className="tabular-nums">{streamChars.toLocaleString()}</span> <span className="text-xs text-gray-300">chars</span>
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
                            <span className="text-xs font-mono text-gray-400">streaming</span>
                            <span className="text-xs text-gray-300 ml-auto truncate max-w-[150px] sm:max-w-xs">{topic}</span>
                        </div>
                        <div ref={streamBoxRef} className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed text-gray-600 bg-gray-50/50">
                            <pre className="m-0 whitespace-pre-wrap break-all">{streamText}<span className="animate-pulse text-[var(--foreground)]">▊</span></pre>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── DONE ───
    return (
        <div className="w-full h-full flex flex-col items-center justify-start py-8 font-sans bg-[var(--background)] p-6 relative overflow-y-auto">
            <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl pt-8 md:pt-0">
                {/* Header Section */}
                <div className="text-center mb-8 max-w-lg mx-auto">
                    {error ? (
                        <>
                            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-100">
                                <IconX className="w-8 h-8 text-red-500" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Generation Failed</h2>
                            <p className="text-sm text-gray-500 mb-6">{error}</p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                                <IconCheck className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2 break-words">{topic}</h2>
                            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400 mb-6 font-medium uppercase tracking-wider">
                                <span>{docType.replace("_", " ")}</span>
                                {referencesBib && <><span>•</span><span>with refs</span></>}
                                <span>•</span><span>{settings.style}</span>
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                        <button onClick={() => setViewerOpen(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[var(--foreground)] text-[var(--card)] rounded-full font-semibold text-sm hover:opacity-90 shadow-sm transition-all focus:scale-95">
                            <IconEye className="w-4 h-4" /> View LaTeX
                        </button>
                        <button onClick={downloadZip} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-[var(--foreground)] border border-[var(--border)] rounded-full font-semibold text-sm hover:bg-gray-50 transition-colors focus:scale-95">
                            <IconPackage className="w-4 h-4" /> Download ZIP
                        </button>
                    </div>

                    {/* Edit / Fix */}
                    <div className="flex items-center justify-center gap-4 text-sm font-medium">
                        <button onClick={() => { setIsEditing(!isEditing); setIsFixingErrors(false); }} className={`flex items-center gap-1.5 transition-colors ${isEditing ? 'text-[var(--foreground)]' : 'text-gray-400 hover:text-[var(--foreground)]'}`}>
                            <IconPencil className="w-4 h-4" /> Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => { setIsFixingErrors(!isFixingErrors); setIsEditing(false); }} className={`flex items-center gap-1.5 transition-colors ${isFixingErrors ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}>
                            <IconBug className="w-4 h-4" /> Fix Errors
                        </button>
                    </div>

                    {/* Inputs */}
                    <AnimatePresence>
                        {isEditing && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full max-w-lg mx-auto mt-4 overflow-hidden px-2">
                                <div className="relative border border-[var(--border)] rounded-2xl bg-white shadow-sm focus-within:shadow-md focus-within:border-[var(--foreground)] transition-all">
                                    <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); } }} placeholder="Add more detail..." className="w-full bg-transparent p-4 pr-12 outline-none resize-none text-[15px] font-medium placeholder:text-gray-300 min-h-[56px] max-h-32" rows={1} autoFocus />
                                    <button onClick={handleEdit} disabled={!editPrompt.trim()} className="absolute right-3 bottom-3 p-1.5 rounded-full bg-[var(--foreground)] text-[var(--card)] disabled:opacity-30"><IconArrowRight className="w-4 h-4" /></button>
                                </div>
                            </motion.div>
                        )}
                        {isFixingErrors && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full max-w-lg mx-auto mt-4 overflow-hidden px-2">
                                <div className="border border-red-200 rounded-2xl bg-red-50 shadow-sm overflow-hidden">
                                    <div className="px-4 py-2 bg-red-100/50 border-b border-red-200"><span className="text-xs font-bold text-red-600 uppercase tracking-wider">Paste compilation errors</span></div>
                                    <textarea value={errorLogInput} onChange={e => setErrorLogInput(e.target.value)} placeholder="Runaway argument? ..." className="w-full bg-transparent p-4 outline-none resize-none text-[13px] font-mono text-red-700 min-h-[100px] max-h-[200px]" rows={4} autoFocus />
                                    <div className="px-4 pb-3 flex justify-end">
                                        <button onClick={fixErrors} disabled={!errorLogInput.trim()} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full text-xs font-bold hover:bg-red-600 disabled:opacity-50"><IconBug className="w-4 h-4" /> Fix</button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Visualizations component */}
                {!error && (
                    <AgentVisualizations
                        topic={topic}
                        language={settings.language}
                        rImages={rImages}
                        setRImages={setRImages}
                        sessionId={currentSessionId}
                        openEditor={setActiveEditorIndex}
                    />
                )}

            </motion.div>

            {/* Editor Modal */}
            <AnimatePresence>
                {activeEditorIndex !== null && rImages[activeEditorIndex] && (
                    <REditorModal
                        image={rImages[activeEditorIndex]}
                        index={activeEditorIndex}
                        onClose={() => setActiveEditorIndex(null)}
                        onSave={(idx, newImg) => {
                            const newArr = [...rImages];
                            newArr[idx] = newImg;
                            setRImages(newArr);
                            // Update DB
                            if (currentSessionId) {
                                fetch(`/api/agent/sessions/${currentSessionId}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ r_images_json: newArr })
                                });
                            }
                        }}
                        sessionId={currentSessionId}
                    />
                )}
            </AnimatePresence>

            {/* LaTeX Viewer Modal */}
            <AnimatePresence>
                {viewerOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewerOpen(false)} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
                        <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed inset-x-0 bottom-0 z-50 h-[85vh] md:inset-4 md:h-auto md:rounded-[var(--radius)] bg-[var(--card)] border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden">
                            <div className="h-14 bg-[var(--background)] border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setActiveTab("tex")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === "tex" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}>
                                        <IconFileText className="w-4 h-4" /> main.tex
                                    </button>
                                    {referencesBib && (
                                        <button onClick={() => setActiveTab("bib")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${activeTab === "bib" ? "bg-blue-50 text-blue-600 border border-blue-100" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}>
                                            <IconBook className="w-4 h-4" /> references.bib
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => {
                                        const blob = new Blob([activeTab === "tex" ? mainTex : referencesBib!], { type: "text/plain" });
                                        const url = URL.createObjectURL(blob); const a = document.createElement("a");
                                        a.href = url; a.download = activeTab === "tex" ? "main.tex" : "references.bib";
                                        a.click(); URL.revokeObjectURL(url);
                                    }} className="flex flex-row gap-1 items-center px-3 py-2 text-xs font-semibold text-gray-500 hover:text-[var(--foreground)] hover:bg-gray-100 rounded-lg transition-colors">
                                        <IconDownload className="w-4 h-4" /> <span className="hidden sm:inline">Download File</span>
                                    </button>
                                    <button onClick={() => setViewerOpen(false)} className="p-2 text-gray-400 hover:text-[var(--foreground)] hover:bg-gray-100 rounded-lg transition-colors"><IconX className="w-5 h-5" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto bg-[#FBFBFC]">
                                <pre className="m-0 p-6 w-full min-h-full whitespace-pre-wrap font-mono text-[13px] text-gray-800" tabIndex={0}>
                                    <code>{activeTab === "tex" ? mainTex : referencesBib}</code>
                                </pre>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
