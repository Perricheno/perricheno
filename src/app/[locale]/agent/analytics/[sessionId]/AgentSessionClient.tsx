"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Loader2, Paperclip, FileText, Book, Package, Download, X, Pencil, Check, Eye, Bug, Clock, Settings, ChartPie, Database, Plus, Lock, RefreshCw, Trash2, Upload, File, AlertTriangle, Play, CloudUpload } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAdmin } from "@/components/AdminContext";
import { useRouter } from "@/i18n/navigation";

import { DocType, AgentSettings, DEFAULT_SETTINGS, CodeImage, AgentSession } from "../../types";
import { AgentSidebar } from "../../AgentSidebar";
import { AgentVisualizations } from "../../AgentVisualizations";
import { CodeEditorModal } from "../../CodeEditorModal";
import { AgentBillingModal } from "../../AgentBillingModal";

interface UploadMeta {
    id: string;
    filename: string;
    charCount: number;
    imageCount: number;
    pageCount: number;
    ocrUsed: boolean;
    expires_at?: string;
}

interface Props {
    initialSession: AgentSession;
    sessions: AgentSession[];
    userId: number;
}

// ── TTL countdown hook ──
function useCountdown(expiresAt: string | undefined) {
    const [remaining, setRemaining] = useState<string>("");
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        if (!expiresAt) { setRemaining(""); return; }
        const update = () => {
            const diff = new Date(expiresAt).getTime() - Date.now();
            if (diff <= 0) { setExpired(true); setRemaining("Expired"); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining(`${h}h ${m}m ${s}s`);
            setExpired(false);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    return { remaining, expired };
}

function FileCard({ file, onDelete }: { file: UploadMeta; onDelete: () => void }) {
    const { remaining, expired } = useCountdown(file.expires_at);
    
    const ext = file.filename.split('.').pop()?.toLowerCase() ?? '';
    const isData = ['csv', 'tsv', 'xlsx', 'xls', 'json'].includes(ext);
    
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
            expired ? 'bg-red-50/50 border-red-200' : 'bg-white border-gray-100 hover:border-gray-200'
        }`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isData ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}>
                {isData ? <Database className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-black truncate">{file.filename}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-gray-400">
                        {file.charCount > 0 ? `${Math.round(file.charCount / 1000)}k chars` : ext.toUpperCase()}
                    </span>
                    {file.pageCount > 1 && (
                        <span className="text-[10px] font-mono text-gray-400">· {file.pageCount} pages</span>
                    )}
                    {file.ocrUsed && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">OCR</span>
                    )}
                </div>
            </div>
            {/* TTL Timer */}
            {remaining && (
                <div className={`flex items-center gap-1 shrink-0 ${expired ? 'text-red-500' : 'text-gray-400'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-mono tabular-nums">{remaining}</span>
                </div>
            )}
            <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100" title="Remove file">
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
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
    let initSettings = DEFAULT_SETTINGS;
    if (initialSession.settings_json) {
        try { initSettings = JSON.parse(initialSession.settings_json); } catch(e) {}
    }

    let initVisuals: CodeImage[] = [];
    if (initialSession.visuals_json) {
        try { initVisuals = JSON.parse(initialSession.visuals_json); } catch(e) {}
    }

    const [settings, setSettings] = useState<AgentSettings>(initSettings);

    // Determine initial phase
    const getInitialPhase = () => {
        if (initialSession.status === 'generating') return 'streaming' as const;
        return 'done' as const;
    };
    const [phase, setPhase] = useState<"idle" | "streaming" | "done">(getInitialPhase());

    // Output state
    const [visuals, setVisuals] = useState<CodeImage[]>(initVisuals);
    const [error, setError] = useState<string | null>(initialSession.status === 'error' ? (initialSession.error_msg || "Pipeline failed") : null);

    // UI states
    const [billingOpen, setBillingOpen] = useState(false);
    const [isRerunning, setIsRerunning] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editPrompt, setEditPrompt] = useState("");

    // Upload state
    const [uploadMeta, setUploadMeta] = useState<UploadMeta[]>(initSettings.uploadMeta ?? []);
    const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    // Editor modal
    const [activeEditorIndex, setActiveEditorIndex] = useState<number | null>(null);

    // Streaming / polling state
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Staged-pipeline progress
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

    const [showDebug, setShowDebug] = useState(false);

    // Load upload metadata with TTL on mount
    useEffect(() => {
        loadUploadMeta();
    }, []);

    // If session is still generating, start polling
    useEffect(() => {
        if (initialSession.status === 'generating') {
            startTimer();
            pollSessionStatus();
        }
        return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    }, []);

    const loadUploadMeta = async () => {
        if (!initSettings.uploadIds || initSettings.uploadIds.length === 0) return;
        try {
            const res = await fetch(`/api/agent/uploads?ids=${initSettings.uploadIds.join(',')}`);
            if (res.ok) {
                const data = await res.json();
                if (data.uploads) {
                    setUploadMeta(data.uploads.map((u: any) => ({
                        id: u.id,
                        filename: u.filename,
                        charCount: u.char_count || 0,
                        imageCount: u.image_count || 0,
                        pageCount: u.page_count || 1,
                        ocrUsed: u.ocr_used || false,
                        expires_at: u.expires_at,
                    })));
                }
            }
        } catch (e) {
            // Use fallback from settings
        }
    };

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
                throw new Error(session.error_msg || "Pipeline crashed.");
            }

            // Stage progress
            if (session.stage_json) {
                const sp = typeof session.stage_json === 'string'
                    ? (() => { try { return JSON.parse(session.stage_json); } catch { return null; } })()
                    : session.stage_json;
                if (sp) setStageProgress(sp);
            }

            if (session.status === 'done' || session.status === 'needs_attention') {
                setVisuals(session.visuals_json ? JSON.parse(session.visuals_json) : []);
                setSettings(session.settings_json ? JSON.parse(session.settings_json) : DEFAULT_SETTINGS);
                stopTimer();
                setPhase("done");
                if (session.status === 'needs_attention') {
                    setError(session.error_msg || "Pipeline completed with issues.");
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

    // ── Re-run pipeline ──
    const handleRerun = async (newPrompt?: string) => {
        if (!user) { setShowLogin(true); return; }
        setIsRerunning(true);
        setError(null);
        setEditMode(false);

        try {
            // Validate uploads still exist
            const validUploads = uploadMeta.filter(u => !u.expires_at || new Date(u.expires_at).getTime() > Date.now());
            if (validUploads.length === 0 && settings.uploadIds.length > 0) {
                throw new Error("All uploaded files have expired. Please upload new data files.");
            }

            const res = await fetch('/api/agent/analytics/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: newPrompt || topic,
                    runtime: settings.runtime,
                    uploadIds: validUploads.map(u => u.id),
                    existingSessionId: currentSessionId,
                })
            });

            if (!res.ok) {
                if (res.status === 402) { setBillingOpen(true); return; }
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            // If same session, just start polling
            setPhase("streaming");
            setVisuals([]);
            setStageProgress(null);
            startTimer();
            
            // Poll new or same session
            const sid = data.sessionId || currentSessionId;
            if (sid !== currentSessionId) {
                router.push(`/agent/analytics/${sid}`);
            } else {
                pollSessionStatus();
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsRerunning(false);
        }
    };

    const handleEditSubmit = () => {
        if (!editPrompt.trim()) return;
        handleRerun(editPrompt.trim());
        setEditPrompt("");
    };

    // ── File Upload ──
    const processFiles = async (files: File[]) => {
        for (const file of files) {
            setUploadingFiles(prev => [...prev, file.name]);
            try {
                const fd = new FormData();
                fd.append('file', file);
                const res = await fetch('/api/agent/attach', { method: 'POST', body: fd });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setError(err?.error || `Upload failed (HTTP ${res.status})`);
                    continue;
                }
                const meta = await res.json();
                if (!meta.uploadId) {
                    setError(`Upload failed: No ID returned for ${file.name}`);
                    continue;
                }
                const newMeta: UploadMeta = {
                    id: meta.uploadId,
                    filename: meta.filename || file.name,
                    charCount: meta.charCount || 0,
                    imageCount: meta.imageCount || 0,
                    pageCount: meta.pageCount || 1,
                    ocrUsed: meta.ocrUsed || false,
                    expires_at: meta.expires_at,
                };
                setUploadMeta(prev => [...prev, newMeta]);
                setSettings(s => ({
                    ...s,
                    uploadIds: [...s.uploadIds, meta.uploadId],
                    uploadMeta: [...(s.uploadMeta || []), newMeta],
                }));
            } catch (err: any) {
                setError(err?.message || 'Upload failed.');
            } finally {
                setUploadingFiles(prev => prev.filter(f => f !== file.name));
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        await processFiles(files);
        e.target.value = '';
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        await processFiles(Array.from(e.dataTransfer.files));
    };

    const removeUpload = async (id: string) => {
        try {
            await fetch(`/api/agent/attach?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch {}
        setUploadMeta(prev => prev.filter(u => u.id !== id));
        setSettings(s => ({
            ...s,
            uploadIds: s.uploadIds.filter(uid => uid !== id),
            uploadMeta: (s.uploadMeta || []).filter((u: any) => u.id !== id),
        }));
    };

    // Navigation
    const handleSelectSession = (s: AgentSession) => {
        setSidebarOpen(false);
        if (s.doc_type === 'chat') router.push(`/agent/chat/${s.id}`);
        else if (s.doc_type === 'literature_search') router.push(`/citations`);
        else if (s.doc_type === 'data_analytics' || s.doc_type === 'data-analytics') router.push(`/agent/analytics/${s.id}`);
        else router.push(`/agent/research/${s.id}`);
    };

    const handleNewSession = () => router.push('/agent');

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this analysis?")) return;
        await fetch(`/api/agent/sessions/${id}`, { method: 'DELETE' });
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) router.push('/agent');
    };

    const handleShareSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const res = await fetch(`/api/agent/sessions/${id}/share`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            if (data.shared) window.prompt("Share link:", window.location.origin + data.share_url);
            else alert("Unshared");
            loadSessions();
        }
    };

    // ─── STREAMING (Pipeline in progress) ───
    if (phase === "streaming") {
        const STAGE_LABELS = ["Analyze", "Extract", "Generate", "Compile", "Validate"];
        const sp = stageProgress;
        const current = sp?.current_stage ?? 0;
        const completed = new Set(sp?.completed_stages ?? []);

        return (
            <div className="w-full h-full flex flex-col font-sans bg-[#FBFBFC] p-4 md:p-6 overflow-y-auto relative">
                <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto my-auto pt-8 md:pt-0">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-3">
                            Data Analytics · {settings.runtime}
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
                                            {isDone ? <Check className="w-3 h-3" strokeWidth={3} /> : stageNum}
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

                        {/* Current label + progress */}
                        <div className="border-t border-gray-100 pt-6">
                            <div className="flex items-center gap-3 mb-3">
                                <Loader2 className="w-4 h-4 animate-spin text-black" />
                                <div className="text-[13px] font-medium text-black flex-1 truncate">
                                    {sp?.label || "Starting analytics pipeline…"}
                                </div>
                                {sp?.progress && (
                                    <div className="text-[11px] font-mono text-gray-400 tabular-nums shrink-0">
                                        {sp.progress.done} / {sp.progress.total}
                                    </div>
                                )}
                                <button onClick={() => setShowDebug(!showDebug)}
                                    className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-400 hover:text-black shrink-0" title="Debug">
                                    <svg className={`w-3 h-3 transition-transform duration-300 ${showDebug ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                            {sp?.progress && (
                                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                                    <div className="h-full bg-black rounded-full transition-[width] duration-500 ease-out"
                                        style={{ width: `${Math.min(100, (sp.progress.done / Math.max(1, sp.progress.total)) * 100)}%` }} />
                                </div>
                            )}

                            {/* Debug panel */}
                            <AnimatePresence>
                                {showDebug && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <pre className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap break-all">
                                                {JSON.stringify(sp, null, 2)}
                                            </pre>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Files being processed */}
                        {sp?.files && sp.files.length > 0 && (
                            <div className="border-t border-gray-100 pt-6 mt-6">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Data Files</div>
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
                                                {f.status === 'ok' ? 'ready' : f.status === 'failed' ? 'failed' : '…'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Retries */}
                        {sp?.retries && Object.keys(sp.retries).length > 0 && (
                            <div className="border-t border-gray-100 pt-4 mt-6 flex flex-wrap gap-2">
                                {Object.entries(sp.retries).map(([k, v]) => (
                                    <span key={k} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-amber-50 text-amber-700 rounded">
                                        {k.replace(/_/g, ' ')} · {v as number}
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
    const hasVisuals = visuals.length > 0;
    const hasExpiredFiles = uploadMeta.some(u => u.expires_at && new Date(u.expires_at).getTime() < Date.now());
    const activeFiles = uploadMeta.filter(u => !u.expires_at || new Date(u.expires_at).getTime() > Date.now());

    return (
        <div className="w-full h-full flex flex-col items-center justify-start font-sans bg-[#FBFBFC] relative overflow-y-auto"
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}>
            
            <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

            {/* Drag overlay */}
            {isDragging && (
                <div className="fixed inset-0 z-50 bg-black/5 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-3 pointer-events-none">
                        <CloudUpload className="w-16 h-16 text-black" strokeWidth={1.5} />
                        <p className="text-sm font-bold text-black">Drop data files here</p>
                    </div>
                </div>
            )}

            <div className="w-full max-w-5xl px-6 py-8 md:py-12">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-2">
                                Data Analytics · {settings.runtime}
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-black break-words mb-1">{topic}</h1>
                            {error && (
                                <div className="flex items-center gap-2 mt-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <p className="text-sm text-amber-600">{error}</p>
                                    <button onClick={() => setError(null)} className="text-amber-400 hover:text-amber-600"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => setEditMode(!editMode)}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border ${
                                    editMode ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                }`}>
                                <Pencil className="w-3.5 h-3.5" /> Modify
                            </button>
                            <button onClick={() => handleRerun()} disabled={isRerunning || activeFiles.length === 0}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-black text-white hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-30"
                                title={activeFiles.length === 0 ? "Upload data files first" : "Re-run pipeline"}>
                                {isRerunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                Re-run
                            </button>
                        </div>
                    </div>

                    {/* Edit prompt */}
                    <AnimatePresence>
                        {editMode && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <textarea value={editPrompt} onChange={e => setEditPrompt(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); } }}
                                            placeholder="Describe what to change... (e.g. 'add correlation matrix', 'use log scale', 'focus on column X')"
                                            className="flex-1 text-[14px] text-black bg-transparent outline-none placeholder:text-gray-300 py-3 px-3 resize-none min-h-[48px] max-h-[120px]" rows={1} autoFocus />
                                        <button onClick={handleEditSubmit} disabled={!editPrompt.trim() || isRerunning}
                                            className="w-9 h-9 bg-black text-white rounded-xl flex items-center justify-center disabled:opacity-10 transition-all hover:bg-gray-800 active:scale-95 shrink-0">
                                            {isRerunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Data Files Section */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                            Data Files
                            <span className="ml-2 text-black">{uploadMeta.length}</span>
                        </h2>
                        <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-white border border-gray-200 hover:border-gray-400 transition-colors cursor-pointer">
                            <Upload className="w-3.5 h-3.5" /> Add File
                            <input type="file" className="hidden" multiple accept=".csv,.xlsx,.xls,.json,.tsv,.txt,.pdf,.docx,.doc,.png,.jpg,.jpeg,.webp" onChange={handleFileUpload} />
                        </label>
                    </div>

                    {uploadMeta.length === 0 && uploadingFiles.length === 0 ? (
                        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
                            <Database className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-300 mb-1">No data files attached</p>
                            <p className="text-xs text-gray-300">Upload CSV, Excel, JSON, or other data files to analyze</p>
                        </div>
                    ) : (
                        <div className="space-y-2 group">
                            {uploadMeta.map(file => (
                                <FileCard key={file.id} file={file} onDelete={() => removeUpload(file.id)} />
                            ))}
                            {uploadingFiles.map((filename, idx) => (
                                <div key={`uploading-${idx}`} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />
                                    <span className="text-[13px] font-medium text-gray-500 truncate">{filename}</span>
                                    <span className="text-[10px] text-gray-400 ml-auto shrink-0">Uploading...</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {hasExpiredFiles && (
                        <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <p className="text-[12px] text-amber-700">Some files have expired. Upload new files before re-running the pipeline.</p>
                        </div>
                    )}
                </motion.div>

                {/* Visualizations */}
                {hasVisuals && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <AgentVisualizations
                            topic={topic}
                            language={settings.language}
                            visuals={visuals}
                            setVisuals={setVisuals}
                            sessionId={currentSessionId}
                            openEditor={setActiveEditorIndex}
                            onAddVisualsToReport={() => {}}
                            runtime={settings.runtime}
                            setRuntime={(r) => setSettings(s => ({ ...s, runtime: r }))}
                        />
                    </motion.div>
                )}

                {/* Empty state when no visuals yet */}
                {!hasVisuals && !error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                        className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
                        <ChartPie className="w-14 h-14 text-gray-200 mx-auto mb-4" strokeWidth={1.5} />
                        <h3 className="text-lg font-bold text-gray-300 mb-2">No visualizations yet</h3>
                        <p className="text-sm text-gray-300 mb-6 max-w-md mx-auto">
                            Upload data files and run the analytics pipeline to generate charts and insights.
                        </p>
                        <button onClick={() => handleRerun()} disabled={activeFiles.length === 0 || isRerunning}
                            className="px-6 py-3 bg-black text-white rounded-xl text-[12px] font-bold hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-20 flex items-center gap-2 mx-auto">
                            {isRerunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Run Analytics Pipeline
                        </button>
                    </motion.div>
                )}
            </div>

            {/* Code Editor Modal */}
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
