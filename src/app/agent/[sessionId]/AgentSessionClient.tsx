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
    const [fixGuidance, setFixGuidance] = useState("");
    const [isEditMode, setIsEditMode] = useState(false);
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

    // Staged-pipeline progress (new path). Populated by polling stage_json.
    const [stageProgress, setStageProgress] = useState<{
        current_stage: number;
        total_stages: number;
        label: string;
        progress?: { done: number; total: number };
        completed_stages: number[];
        files?: { name: string; status: "ok" | "failed" | "pending"; claims?: number; error?: string }[];
        retries?: Record<string, number>;
    } | null>(() => {
        const raw = (initialSession as any).stage_json;
        if (!raw) return null;
        if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return null; } }
        return raw;
    });

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
    
    // Debug view state
    const [showDebug, setShowDebug] = useState(false);

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

            // New pipeline: structured progress in stage_json.
            if (session.stage_json) {
                const sp = typeof session.stage_json === 'string'
                    ? (() => { try { return JSON.parse(session.stage_json); } catch { return null; } })()
                    : session.stage_json;
                if (sp) setStageProgress(sp);
            }

            if (session.status === 'done' || session.status === 'needs_attention') {
                setMainTex(session.main_tex || "");
                setReferencesBib(session.references_bib || null);
                setVisuals(session.visuals_json ? JSON.parse(session.visuals_json) : []);
                setSettings(session.settings_json ? JSON.parse(session.settings_json) : DEFAULT_SETTINGS);
                stopTimer();
                setActiveTab("tex");
                setPhase("done");
                if (session.status === 'needs_attention') {
                    setError(session.error_msg || "Document assembled but failed to compile on automatic retries. Open it and review.");
                }
                loadSessions();
            } else if (session.status === 'generating') {
                pollRef.current = setTimeout(pollSessionStatus, 1500);
            }
        } catch (e: any) {
            stopTimer();
            setError(e.message);
            setPhase("done");
        }
    };

    const streamGenerate = useCallback(async (body: Record<string, any>, topicText: string) => {
        if (!user) { setShowLogin(true); return; }

        const editMode = !!(body.currentTex || body.errorLog);
        setIsEditMode(editMode);
        setError(null);
        setPhase("streaming");
        setTopic(topicText);
        setStreamText("");
        setDisplayStreamText("");
        targetStreamText.current = "";
        setStreamChars(0);
        setIsEditing(false);
        setIsFixingErrors(false);
        if (editMode) setStageProgress(null);
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
                    if (session.stage_json) {
                        const sp = typeof session.stage_json === 'string'
                            ? (() => { try { return JSON.parse(session.stage_json); } catch { return null; } })()
                            : session.stage_json;
                        if (sp) setStageProgress(sp);
                    }
                    if (session.status === 'done' || session.status === 'needs_attention') {
                        setMainTex(session.main_tex || "");
                        setReferencesBib(session.references_bib);
                        stopTimer();
                        setActiveTab("tex");
                        setPhase("done");
                        if (session.status === 'needs_attention') {
                            setError(session.error_msg || "Document assembled but failed to compile on automatic retries. Open it and review.");
                        }
                        loadSessions();
                    } else if (session.status === 'generating') {
                        pollRef.current = setTimeout(pollStatus, 1500);
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
        // prompt must come AFTER ...settings — settings.prompt (original generation prompt)
        // would otherwise overwrite the user's edit instruction
        streamGenerate({
            ...settings,
            prompt: text,
            currentTex: mainTex,
            currentBib: referencesBib,
        }, topic + " → edit");
    };

    const fixErrors = () => {
        if (!errorLogInput.trim() || !mainTex) return;
        const log = errorLogInput;
        const guidance = fixGuidance.trim();
        setErrorLogInput("");
        setFixGuidance("");
        streamGenerate({
            language: settings.language,
            errorLog: log,
            prompt: guidance || undefined,
            currentTex: mainTex,
            currentBib: referencesBib,
        }, topic + " → fix");
    };

    const handleAddVisualsToReport = (images: CodeImage[]) => {
        if (!mainTex || images.length === 0) return;
        setViewerOpen(false);
        streamGenerate({
            ...settings,
            prompt: "Please integrate the attached R figures into the report.",
            currentTex: mainTex,
            currentBib: referencesBib,
            useDbImages: true,
        }, topic + " → add visuals");
    };

    // Navigate to a different session
    const handleSelectSession = (s: AgentSession) => {
        setSidebarOpen(false);
        if (s.doc_type === 'chat') {
            router.push(`/agent/chat/${s.id}`);
        } else if (s.doc_type === 'literature_search') {
            router.push(`/agent/scholar/${s.id}`);
        } else if (s.doc_type === 'data_analytics' || s.doc_type === 'data-analytics') {
            router.push(`/agent/analytics/${s.id}`);
        } else {
            router.push(`/agent/research/${s.id}`);
        }
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
                const chartType = img.chart_type || (img as any).chartType || 'chart';
                zip.file(`images/fig_${i + 1}_${chartType}.png`, bytes);
                if (img.code) zip.file(`images/fig_${i + 1}_${chartType}.${ext}`, img.code);
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
        const STAGE_LABELS = ["Plan", "Extract", "Draft", "Assemble", "Validate"];
        const sp = stageProgress;
        const current = sp?.current_stage ?? 0;
        const completed = new Set(sp?.completed_stages ?? []);

        return (
            <div className="w-full h-full flex flex-col font-sans bg-[#FBFBFC] p-4 md:p-6 overflow-y-auto relative">
                <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto my-auto pt-8 md:pt-0">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#A1A1AA] mb-3">
                            {isAgentMode ? `${docType.replace("_", " ")} • ${settings.style}` : 'Analytics Console'}
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-black break-words">
                            {topic}
                        </h2>
                        <div className="text-[11px] font-mono text-gray-400 mt-3 tabular-nums">
                            {elapsedTime.toFixed(1)}s
                        </div>
                    </div>

                    {/* Stepper */}
                    <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm">
                        <div className="flex items-start justify-between mb-8 relative">
                            {/* connector line */}
                            <div className="absolute top-3 left-6 right-6 h-px bg-gray-100" />
                            {STAGE_LABELS.map((label, idx) => {
                                const stageNum = idx + 1;
                                const isDone = completed.has(stageNum);
                                const isActive = current === stageNum && !isDone;
                                return (
                                    <div key={label} className="flex flex-col items-center relative z-10 flex-1">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                                            isDone ? 'bg-black text-white'
                                                : isActive ? 'bg-white border-2 border-black text-black'
                                                : 'bg-white border border-gray-200 text-gray-300'
                                        }`}>
                                            {isDone ? <IconCheck className="w-3 h-3" stroke={3} /> : stageNum}
                                        </div>
                                        <div className={`mt-2 text-[9px] font-bold uppercase tracking-widest ${
                                            isActive ? 'text-black' : isDone ? 'text-gray-500' : 'text-gray-300'
                                        }`}>
                                            {label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Current label + progress bar */}
                        <div className="border-t border-gray-100 pt-6">
                            <div className="flex items-center gap-3 mb-3">
                                <IconLoader2 className="w-4 h-4 animate-spin text-black" />
                                <div className="text-[13px] font-medium text-black flex-1 truncate">
                                    {sp?.label || "Starting…"}
                                </div>
                                {sp?.progress && (
                                    <div className="text-[11px] font-mono text-gray-400 tabular-nums shrink-0">
                                        {sp.progress.done} / {sp.progress.total}
                                    </div>
                                )}
                                {/* Debug toggle button */}
                                <button
                                    onClick={() => setShowDebug(!showDebug)}
                                    className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400 hover:text-black shrink-0"
                                    title="Toggle debug info"
                                >
                                    <svg className={`w-3 h-3 transition-transform duration-300 ${showDebug ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                            {sp?.progress && (
                                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-black rounded-full transition-[width] duration-500 ease-out"
                                        style={{ width: `${Math.min(100, (sp.progress.done / Math.max(1, sp.progress.total)) * 100)}%` }}
                                    />
                                </div>
                            )}
                            
                            {/* Expandable debug view */}
                            <motion.div
                                initial={false}
                                animate={{
                                    height: showDebug ? 'auto' : 0,
                                    opacity: showDebug ? 1 : 0,
                                }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                                        Stage Data
                                    </div>
                                    <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap break-all">
                                        {JSON.stringify(sp, null, 2)}
                                    </pre>
                                </div>
                            </motion.div>
                        </div>

                        {/* Files status */}
                        {sp?.files && sp.files.length > 0 && (
                            <div className="border-t border-gray-100 pt-6 mt-6">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                                    Reference Files
                                </div>
                                <div className="space-y-1.5">
                                    {sp.files.map((f, i) => (
                                        <div key={i} className="flex items-center gap-3 text-[12px]" title={f.error}>
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                f.status === 'ok' ? 'bg-emerald-500'
                                                    : f.status === 'failed' ? 'bg-red-400'
                                                    : 'bg-gray-300 animate-pulse'
                                            }`} />
                                            <span className="font-medium text-gray-700 truncate flex-1">{f.name}</span>
                                            <span className="text-[10px] font-mono text-gray-400 tabular-nums shrink-0">
                                                {f.status === 'ok' && typeof f.claims === 'number' ? `${f.claims} claims`
                                                    : f.status === 'failed' ? 'failed'
                                                    : '…'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Retry badge */}
                        {sp?.retries && Object.keys(sp.retries).length > 0 && (
                            <div className="border-t border-gray-100 pt-4 mt-6 flex flex-wrap gap-2">
                                {Object.entries(sp.retries).map(([k, v]) => (
                                    <span key={k} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-amber-50 text-amber-700 rounded">
                                        {k.replace(/_/g, ' ')} · {v}
                                    </span>
                                ))}
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
                                {mainTex && <><span>•</span><span className="text-emerald-500 font-bold tabular-nums">~{mainTex.length.toLocaleString()} Chars</span></>}
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
                                <div className="border border-gray-100 rounded-[24px] bg-white shadow-2xl overflow-hidden p-2 space-y-2">
                                    <div className="px-5 py-2 text-[9px] font-black text-black uppercase tracking-[0.3em]">Compiler Log</div>
                                    <textarea value={errorLogInput} onChange={e => setErrorLogInput(e.target.value)} placeholder="Paste the compiler log here…" className="w-full bg-[#FAFAFA] p-5 rounded-xl outline-none resize-none text-[12px] font-mono text-black min-h-[100px] max-h-[180px]" rows={4} autoFocus />
                                    <div className="px-5 py-1 text-[9px] font-black text-black uppercase tracking-[0.3em]">Additional guidance <span className="text-gray-300 normal-case font-medium">(optional)</span></div>
                                    <textarea value={fixGuidance} onChange={e => setFixGuidance(e.target.value)} placeholder="e.g. Keep the table structure, don't change fonts…" className="w-full bg-[#FAFAFA] p-5 rounded-xl outline-none resize-none text-[13px] text-black min-h-[52px] max-h-[100px]" rows={2} />
                                    <div className="px-2 pt-1 pb-1 flex justify-end">
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
                                        const blob = new Blob([activeTab === "tex" ? mainTex : referencesBib!], { type: "text/plain;charset=utf-8" });
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
