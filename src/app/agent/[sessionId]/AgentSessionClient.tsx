"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip,
    IconFileText, IconBook, IconPackage, IconDownload,
    IconX, IconPencil, IconCheck, IconEye, IconBug,
    IconClock, IconLetterCase, IconSettings,
    IconSchool, IconSearch, IconCertificate, IconChartPie,
    IconLink, IconFilePlus, IconUser, IconChevronLeft, IconDatabase, IconMessageCircle, IconTerminal2,
    IconPlus, IconLock
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import JSZip from "jszip";
import ReactMarkdown from "react-markdown";
import { useAdmin } from "@/components/AdminContext";
import { useRouter } from "next/navigation";

import { DocType, AgentSettings, DEFAULT_SETTINGS, CodeImage, AgentSession } from "../types";
import { AgentSettingsPanel } from "../AgentSettingsPanel";
import { AgentSidebar } from "../AgentSidebar";
import { AgentVisualizations } from "../AgentVisualizations";
import { CodeEditorModal } from "../CodeEditorModal";
import { AgentBillingModal } from "../AgentBillingModal";

interface Props {
    initialSession: AgentSession;
    sessions: AgentSession[];
    userId: number;
}

export default function AgentSessionClient({ initialSession, sessions: initialSessions, userId }: Props) {
    const { user, setShowLogin } = useAdmin();
    const router = useRouter();

    // Session list for sidebar
    const [sessions, setSessions] = useState<AgentSession[]>(initialSessions);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Current session
    const currentSessionId = initialSession.id;
    const [topic, setTopic] = useState(initialSession.title);

    // Parse initial data
    const initDocType = (initialSession.doc_type === 'data-analytics' ? 'data_analytics' : initialSession.doc_type) as DocType;
    const initIsAnalytics = initDocType === 'data_analytics';
    let initSettings = DEFAULT_SETTINGS;
    if (initialSession.settings_json) {
        try { initSettings = JSON.parse(initialSession.settings_json); } catch(e) {}
    }

    let initVisuals = [];
    if (initialSession.visuals_json) {
        try { initVisuals = JSON.parse(initialSession.visuals_json); } catch(e) {}
    }

    const [docType, setDocType] = useState<DocType>(initDocType);
    const [isAnalyticsSession, setIsAnalyticsSession] = useState(initIsAnalytics);
    const [isAgentMode, setIsAgentMode] = useState(!initIsAnalytics);
    const [settings, setSettings] = useState<AgentSettings>(initSettings);

    // Determine initial phase
    const getInitialPhase = () => {
        if (initialSession.status === 'generating') return 'streaming' as const;
        if (initialSession.status === 'done' || initialSession.status === 'error') return 'done' as const;
        return 'done' as const;
    };
    const [phase, setPhase] = useState<"idle" | "suggesting" | "streaming" | "done">(getInitialPhase());

    // Output state
    const [mainTex, setMainTex] = useState(initialSession.main_tex || "");
    const [referencesBib, setReferencesBib] = useState<string | null>(initialSession.references_bib || null);
    const [visuals, setVisuals] = useState<CodeImage[]>(initVisuals);
    const [error, setError] = useState<string | null>(initialSession.status === 'error' ? (initialSession.error_msg || "Session failed") : null);

    // UI states
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [billingOpen, setBillingOpen] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"tex" | "bib">("tex");
    const [isEditing, setIsEditing] = useState(false);
    const [editPrompt, setEditPrompt] = useState("");
    const [isFixingErrors, setIsFixingErrors] = useState(false);
    const [errorLogInput, setErrorLogInput] = useState("");
    const [isCompiling, setIsCompiling] = useState(false);

    // Editor modal
    const [activeEditorIndex, setActiveEditorIndex] = useState<number | null>(null);

    // Streaming state
    const [streamText, setStreamText] = useState("");
    const [streamChars, setStreamChars] = useState(0);
    const [displayStreamText, setDisplayStreamText] = useState("");
    const targetStreamText = useRef("");
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Agent Mode States
    const [agentDataFiles, setAgentDataFiles] = useState<{name: string, content: string}[]>([]);
    const [agentLogs, setAgentLogs] = useState<{type: string, message: string}[]>([]);
    const [agentSteps, setAgentSteps] = useState<{label: string, status: "pending" | "running" | "done" | "error"}[]>([]);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const streamBoxRef = useRef<HTMLDivElement>(null);

    // Suggestion states
    const [suggestedCharts, setSuggestedCharts] = useState<string[]>([]);
    const [suggestReasoning, setSuggestReasoning] = useState("");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [analyticsPrompt, setAnalyticsPrompt] = useState("");

    const EXPECTED_CHARS = settings.wordCount * 6;

    useEffect(() => {
        if (streamBoxRef.current) streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight;
    }, [displayStreamText]);

    // Typing effect for stream
    useEffect(() => {
        const interval = setInterval(() => {
            if (displayStreamText.length < targetStreamText.current.length) {
                const nextChar = targetStreamText.current[displayStreamText.length];
                setDisplayStreamText(prev => prev + nextChar);
                setStreamChars(prev => prev + 1);
            }
        }, 15);
        return () => clearInterval(interval);
    }, [displayStreamText]);

    // If session is still generating, start polling immediately
    useEffect(() => {
        if (initialSession.status === 'generating') {
            startTimer();
            pollSessionStatus();
        }
        return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const pollSessionStatus = async () => {
        try {
            const statusRes = await fetch(`/api/agent/sessions/${currentSessionId}`);
            if (!statusRes.ok) throw new Error("Status check failed");
            const { session } = await statusRes.json();

            if (session.status === 'error') {
                throw new Error(session.error_msg || "Background Agent crashed.");
            }

            if (session.stream_text) {
                targetStreamText.current = session.stream_text;
            }

            if (session.status === 'done') {
                setMainTex(session.main_tex || "");
                setReferencesBib(session.references_bib || null);
                setVisuals(session.visuals_json ? JSON.parse(session.visuals_json) : []);
                setSettings(session.settings_json ? JSON.parse(session.settings_json) : DEFAULT_SETTINGS);
                stopTimer();
                setActiveTab("tex");
                setPhase("done");
                loadSessions();
            } else if (session.status === 'generating') {
                pollRef.current = setTimeout(pollSessionStatus, 400);
            }
        } catch (e: any) {
            stopTimer();
            setError(e.message);
            setPhase("done");
        }
    };

    const streamGenerate = useCallback(async (body: Record<string, any>, topicText: string) => {
        if (!user) { setShowLogin(true); return; }

        setError(null);
        setPhase("streaming");
        setTopic(topicText);
        setStreamText("");
        setDisplayStreamText("");
        targetStreamText.current = "";
        setStreamChars(0);
        setIsEditing(false);
        setIsFixingErrors(false);
        startTimer();

        try {
            body.sessionId = currentSessionId;
            
            const res = await fetch('/api/agent/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                if (res.status === 402) {
                    setBillingOpen(true);
                    throw new Error("Quota exceeded! Please buy tokens to continue.");
                }
                const errData = await res.json().catch(() => ({ error: "Unknown API error" }));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const { sessionId } = await res.json();

            const pollStatus = async () => {
                try {
                    const statusRes = await fetch(`/api/agent/sessions/${sessionId}`);
                    if (!statusRes.ok) throw new Error("Status check failed");
                    const { session } = await statusRes.json();

                    if (session.status === 'error') {
                        throw new Error(session.error_msg || "Background Agent crashed.");
                    }
                    if (session.stream_text) {
                        targetStreamText.current = session.stream_text;
                    }
                    if (session.status === 'done') {
                        setMainTex(session.main_tex || "");
                        setReferencesBib(session.references_bib);
                        stopTimer();
                        setActiveTab("tex");
                        setPhase("done");
                        loadSessions();
                    } else if (session.status === 'generating') {
                        pollRef.current = setTimeout(pollStatus, 400);
                    }
                } catch (e: any) {
                    stopTimer();
                    setError(e.message);
                    setPhase("done");
                }
            };
            pollStatus();
        } catch (err: any) {
            stopTimer();
            setError(err.message);
            setPhase("done");
        }
    }, [user, setShowLogin, currentSessionId, settings, visuals]);

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

    const handleAddVisualsToReport = (images: CodeImage[]) => {
        if (!mainTex || images.length === 0) return;
        setViewerOpen(false);
        streamGenerate({ 
            prompt: "Please integrate the attached R figures into the report.", 
            type: docType, ...settings, currentTex: mainTex, currentBib: referencesBib, useDbImages: true
        }, topic + " → add visuals");
    };

    // Navigate to a different session
    const handleSelectSession = (s: AgentSession) => {
        setSidebarOpen(false);
        router.push(`/agent/${s.id}`);
    };

    const handleNewSession = () => {
        router.push('/agent');
    };

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this document?")) return;
        await fetch(`/api/agent/sessions/${id}`, { method: 'DELETE' });
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) router.push('/agent');
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
            loadSessions();
        }
    };

    const buildZipBlob = async (): Promise<Blob> => {
        const zip = new JSZip();
        zip.file("main.tex", mainTex);
        if (referencesBib) zip.file("references.bib", referencesBib);
        visuals.forEach((img, i) => {
            const cleanBase64 = img.image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
            try {
                const binary = atob(cleanBase64);
                const bytes = new Uint8Array(binary.length);
                for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                const ext = img.language === 'Python' ? 'py' : 'R';
                zip.file(`images/fig_${i + 1}_${img.chart_type}.png`, bytes);
                if (img.code) zip.file(`images/fig_${i + 1}_${img.chart_type}.${ext}`, img.code);
            } catch (e) {
                console.error("Failed to decode visual image base64:", e);
            }
        });
        return await zip.generateAsync({ type: "blob" });
    };

    const downloadZip = async () => {
        const blob = await buildZipBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `latex_project_${Date.now()}.zip`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    const compilePdf = async () => {
        if (!mainTex) return;
        setIsCompiling(true);
        setError(null);
        try {
            const blob = await buildZipBlob();
            const formData = new FormData();
            formData.append("file", blob, "project.zip");
            const res = await fetch("/api/agent/compile-pdf", { method: "POST", body: formData });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server Error ${res.status}`);
            }
            const pdfBlob = await res.blob();
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement("a");
            a.href = url; a.download = `compiled_research_${Date.now()}.pdf`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to compile PDF via server.");
        } finally {
            setIsCompiling(false);
        }
    };

    // ─── STREAMING ───
    if (phase === "streaming") {
        const estimatedProgress = Math.min(95, Math.round((streamChars / EXPECTED_CHARS) * 100));
        return (
            <div className="w-full h-full flex flex-col font-sans bg-[#FBFBFC] p-4 md:p-6 overflow-hidden relative">
                <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full h-full flex flex-col max-w-4xl mx-auto pl-12 md:pl-0 pt-4 md:pt-0">
                    <div className="flex items-center justify-between mb-6 md:px-1">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#A1A1AA]">
                                <IconClock className="w-3.5 h-3.5" stroke={2.5} /> <span className="tabular-nums">{elapsedTime.toFixed(1)}s</span>
                            </div>
                            {isAgentMode && <div className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#A1A1AA]">
                                <IconLetterCase className="w-4 h-4" stroke={2.5} /> <span className="tabular-nums">{streamChars.toLocaleString()} chars</span>
                            </div>}
                        </div>
                        {isAgentMode && <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-black tabular-nums tracking-widest">{estimatedProgress}%</span>
                            <div className="w-32 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div className="h-full bg-black" animate={{ width: `${estimatedProgress}%` }} transition={{ duration: 0.3 }} />
                            </div>
                        </div>}
                    </div>
                    <div className="flex-1 flex gap-4 overflow-hidden">
                        <div className="flex-1 bg-white rounded-[32px] border border-gray-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col">
                            <div className="h-12 bg-white border-b border-gray-50 flex items-center px-6 gap-3 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                                <span className="text-[10px] font-black text-black uppercase tracking-[0.3em]">{!isAgentMode ? "Agent Analytics Console" : "Agent Logic Stream"}</span>
                                <span className="text-[10px] font-black text-[#D4D4D8] ml-auto truncate uppercase tracking-widest max-w-[150px] sm:max-w-xs">{topic}</span>
                            </div>
                            <div ref={streamBoxRef} className="flex-1 overflow-auto p-6 bg-[#FAFAFA]">
                                {isAgentMode ? (
                                    <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:text-gray-100 font-sans text-[#52525B]">
                                        <ReactMarkdown>{displayStreamText}</ReactMarkdown>
                                        {displayStreamText.length < targetStreamText.current.length && (
                                            <span className="inline-block w-1 h-4 bg-black ml-1 animate-pulse" />
                                        )}
                                    </div>
                                ) : (
                                    <div className="font-mono text-xs text-gray-800 space-y-1 pb-4">
                                        {agentLogs.map((log, i) => (
                                            <div key={i} className={`p-1 rounded ${
                                                log.type === 'error' ? 'text-red-600 bg-red-50' : (
                                                log.type === 'success' ? 'text-green-600 bg-green-50' : (
                                                log.type === 'code' ? 'text-[#1a1a1a] bg-gray-100' : 'text-[#666]'
                                            ))}`}>
                                                <span className="opacity-50 select-none">[{new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" })}]</span> {log.message}
                                            </div>
                                        ))}
                                        <div className="p-2 text-gray-400 flex items-center gap-2 mt-2">
                                            <IconLoader2 className="w-3 h-3 animate-spin" /> {agentSteps.some(s => s.status === 'running') ? "Processing..." : "Awaiting agent thought..."}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {!isAgentMode && (
                            <div className="hidden md:flex w-72 shrink-0 bg-white rounded-[32px] border border-gray-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] overflow-hidden flex-col">
                                <div className="h-12 bg-white border-b border-gray-50 flex items-center px-6 gap-2 shrink-0">
                                    <IconCheck className="w-4 h-4 text-black" stroke={2.5} />
                                    <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Progression</span>
                                </div>
                                <div className="flex-1 p-6 overflow-y-auto space-y-5">
                                    {agentSteps.map((step, i) => (
                                        <div key={i} className={`flex items-start gap-3 text-sm font-bold ${step.status === 'done' ? 'text-black' : step.status === 'running' ? 'text-[#3b82f6]' : step.status === 'error' ? 'text-red-500' : 'text-[#D4D4D8]'}`}>
                                            <div className="mt-[3px] shrink-0">
                                                {step.status === 'done' ? <IconCheck className="w-4 h-4" stroke={3} /> : 
                                                 step.status === 'running' ? <IconLoader2 className="w-4 h-4 animate-spin" stroke={3} /> : 
                                                 step.status === 'error' ? <IconX className="w-4 h-4" stroke={3} /> : 
                                                 <div className="w-2.5 h-2.5 rounded-full bg-gray-100 ml-0.5" />}
                                            </div>
                                            <span className="leading-snug">{step.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── DONE ───
    return (
        <div className="w-full h-full flex flex-col items-center justify-start py-10 font-sans bg-[#FBFBFC] p-6 relative overflow-y-auto">
            <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-4xl pt-8 md:pt-0">
                {/* Header Section */}
                <div className="text-center mb-10 max-w-2xl mx-auto">
                    {error ? (
                        <>
                            <div className="w-20 h-20 rounded-full bg-white border border-gray-100 shadow-xl flex items-center justify-center mx-auto mb-6">
                                <IconX className="w-10 h-10 text-black" stroke={2.5} />
                            </div>
                            <h2 className="text-2xl font-black mb-3 text-black">Process Interrupted</h2>
                            <p className="text-sm text-[#A1A1AA] font-bold uppercase tracking-widest mb-8">{error}</p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 rounded-full bg-white border border-gray-100 shadow-xl flex items-center justify-center mx-auto mb-6">
                                <IconCheck className="w-10 h-10 text-black" stroke={2.5} />
                            </div>
                            <h2 className="text-3xl font-black mb-4 break-words text-black tracking-tight">{topic}</h2>
                            <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-[#D4D4D8] mb-8 font-black uppercase tracking-[0.25em]">
                                <span className="text-black">{docType.replace("_", " ")}</span>
                                <span>•</span>
                                <span>{settings.style}</span>
                                {referencesBib && <><span>•</span><span className="text-black">Refs Attached</span></>}
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    {isAnalyticsSession ? (
                        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                            <button onClick={handleNewSession} className="flex items-center gap-2 px-8 py-3 bg-white text-black border border-gray-100 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:border-black transition-all shadow-sm active:scale-95">
                                <IconPlus className="w-4 h-4" /> New Analysis
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                                <button onClick={() => setViewerOpen(true)} className="flex items-center gap-2 px-8 py-3 bg-white text-black border border-gray-100 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:border-black transition-all shadow-sm active:scale-95">
                                    <IconEye className="w-4 h-4" /> View LaTeX
                                </button>
                                <button onClick={downloadZip} className="flex items-center gap-2 px-8 py-3 bg-white text-black border border-black rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-xl active:scale-95">
                                    <IconPackage className="w-4 h-4" /> Project ZIP
                                </button>
                                <button onClick={compilePdf} disabled={isCompiling} className="flex items-center gap-2 px-10 py-3.5 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] transition-all shadow-2xl active:scale-95 disabled:opacity-5">
                                    {isCompiling ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconFileText className="w-4 h-4" />}
                                    {isCompiling ? "Compiling..." : "Generate PDF"}
                                </button>
                            </div>
                        </>
                    )}

                    {/* Edit / Fix */}
                    {!isAnalyticsSession && (
                        <div className="flex items-center justify-center gap-6">
                            <button onClick={() => { setIsEditing(!isEditing); setIsFixingErrors(false); }} className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isEditing ? 'text-black' : 'text-gray-300 hover:text-black'}`}>
                                <IconPencil className="w-3.5 h-3.5" stroke={2.5} /> Modify
                            </button>
                            <div className="w-1 h-1 rounded-full bg-gray-100" />
                            <button onClick={() => { setIsFixingErrors(!isFixingErrors); setIsEditing(false); }} className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isFixingErrors ? 'text-black underline' : 'text-gray-300 hover:text-black'}`}>
                                <IconBug className="w-3.5 h-3.5" stroke={2.5} /> Fix Errors
                            </button>
                        </div>
                    )}

                    {/* Inputs */}
                    <AnimatePresence>
                        {isEditing && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full max-w-lg mx-auto mt-8 overflow-hidden">
                                <div className="relative border border-gray-100 rounded-[24px] bg-white shadow-2xl focus-within:border-black transition-all p-2">
                                    <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEdit(); } }} placeholder="Direct the modification..." className="w-full bg-transparent px-5 py-4 pr-14 outline-none resize-none text-[15px] font-bold text-black placeholder:text-gray-100 min-h-[64px] max-h-32" rows={1} autoFocus />
                                    <button onClick={handleEdit} disabled={!editPrompt.trim()} className="absolute right-4 bottom-4 p-2.5 rounded-xl bg-black text-white disabled:opacity-5 transition-all active:scale-90"><IconArrowRight className="w-4 h-4" /></button>
                                </div>
                            </motion.div>
                        )}
                        {isFixingErrors && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="w-full max-w-lg mx-auto mt-8 overflow-hidden">
                                <div className="border border-gray-100 rounded-[24px] bg-white shadow-2xl overflow-hidden p-2">
                                    <div className="px-5 py-2 text-[9px] font-black text-black uppercase tracking-[0.3em]">Compiler Log</div>
                                    <textarea value={errorLogInput} onChange={e => setErrorLogInput(e.target.value)} placeholder="Paste the log here..." className="w-full bg-[#FAFAFA] p-5 rounded-xl outline-none resize-none text-[12px] font-mono text-black min-h-[120px] max-h-[200px]" rows={4} autoFocus />
                                    <div className="px-2 pt-2 flex justify-end">
                                        <button onClick={fixErrors} disabled={!errorLogInput.trim()} className="px-6 py-2.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#222] transition-all flex items-center gap-2">Identify & Solve <IconBug className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Visualizations component */}
                <AgentVisualizations
                    topic={topic}
                    language={settings.language}
                    visuals={visuals}
                    setVisuals={setVisuals}
                    sessionId={currentSessionId}
                    openEditor={setActiveEditorIndex}
                    onAddVisualsToReport={handleAddVisualsToReport}
                    runtime={settings.runtime}
                    setRuntime={(r) => setSettings(s => ({ ...s, runtime: r }))}
                />
            </motion.div>

            {/* LaTeX Viewer Modal */}
            <AnimatePresence>
                {viewerOpen && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewerOpen(false)} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md" />
                        <motion.div initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", damping: 35, stiffness: 400 }} className="fixed inset-x-0 bottom-0 z-[100] h-[90vh] md:inset-6 md:h-auto md:rounded-[40px] bg-white border border-gray-100 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden">
                            <div className="h-20 bg-white border-b border-gray-50 flex items-center justify-between px-8 shrink-0">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setActiveTab("tex")} className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "tex" ? "bg-black text-white shadow-xl" : "text-gray-300 hover:text-black border border-transparent hover:border-gray-50"}`}>
                                        <IconFileText className="w-4 h-4" /> Main Body
                                    </button>
                                    {referencesBib && (
                                        <button onClick={() => setActiveTab("bib")} className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "bib" ? "bg-black text-white shadow-xl" : "text-gray-300 hover:text-black border border-transparent hover:border-gray-50"}`}>
                                            <IconBook className="w-4 h-4" /> Bibliography
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => {
                                        const blob = new Blob([activeTab === "tex" ? mainTex : referencesBib!], { type: "text/plain" });
                                        const url = URL.createObjectURL(blob); const a = document.createElement("a");
                                        a.href = url; a.download = activeTab === "tex" ? "main.tex" : "references.bib";
                                        a.click(); URL.revokeObjectURL(url);
                                    }} className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#D4D4D8] hover:text-black transition-all border border-transparent hover:border-gray-50 rounded-xl">
                                        <IconDownload className="w-4 h-4 inline mr-2" /> Download
                                    </button>
                                    <button onClick={() => setViewerOpen(false)} className="p-3 text-gray-300 hover:text-black transition-colors"><IconX className="w-6 h-6" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto bg-[#FBFBFC]">
                                <pre className="m-0 p-10 w-full min-h-full whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[#52525B]" tabIndex={0}>
                                    <code>{activeTab === "tex" ? mainTex : referencesBib}</code>
                                </pre>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {activeEditorIndex !== null && visuals[activeEditorIndex] && (
                    <CodeEditorModal
                        image={visuals[activeEditorIndex]}
                        index={activeEditorIndex}
                        onClose={() => setActiveEditorIndex(null)}
                        onSave={(idx, newImg) => {
                            const newArr = [...visuals];
                            newArr[idx] = newImg;
                            setVisuals(newArr);
                            fetch(`/api/agent/sessions/${currentSessionId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ visuals_json: newArr })
                            });
                        }}
                        sessionId={currentSessionId}
                    />
                )}
            </AnimatePresence>
            
            <AgentBillingModal 
                isOpen={billingOpen} 
                onClose={() => setBillingOpen(false)} 
                totalSessions={sessions.length} 
            />
        </div>
    );
}
