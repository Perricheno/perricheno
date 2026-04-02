"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip,
    IconFileText, IconBook, IconPackage, IconDownload,
    IconX, IconPencil, IconCheck, IconEye, IconBug,
    IconClock, IconLetterCase, IconSettings,
    IconSchool, IconSearch, IconCertificate, IconChartPie,
    IconLink, IconFilePlus, IconUser, IconChevronLeft
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import JSZip from "jszip";
import { useAdmin } from "@/components/AdminContext";

import { DocType, AgentSettings, DEFAULT_SETTINGS, CodeImage, AgentSession } from "./types";
import { AgentSettingsPanel } from "./AgentSettingsPanel";
import { AgentSidebar } from "./AgentSidebar";
import { AgentVisualizations } from "./AgentVisualizations";
import { CodeEditorModal } from "./CodeEditorModal";

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
    const [isCompiling, setIsCompiling] = useState(false);
    const [activeTab, setActiveTab] = useState<"tex" | "bib">("tex");
    const [mainTex, setMainTex] = useState("");
    const [referencesBib, setReferencesBib] = useState<string | null>(null);
    const [visuals, setVisuals] = useState<CodeImage[]>([]);
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
    const pollRef = useRef<NodeJS.Timeout | null>(null);
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

    useEffect(() => {
        return () => {
            if (pollRef.current) clearTimeout(pollRef.current);
        };
    }, []);

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

        try {
            // Append current session ID to modify the existing document context if present
            if (currentSessionId) body.sessionId = currentSessionId;
            
            const res = await fetch('/api/agent/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: "Unknown API error" }));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const { sessionId } = await res.json();
            if (!currentSessionId) setCurrentSessionId(sessionId);

            const pollStatus = async () => {
                try {
                    const statusRes = await fetch(`/api/agent/sessions/${sessionId}`);
                    if (!statusRes.ok) throw new Error("Status check failed");
                    
                    const { session } = await statusRes.json();

                    if (session.status === 'error') {
                        throw new Error(session.error_msg || "Background Agent crashed.");
                    }

                    if (session.stream_text) {
                        setStreamText(session.stream_text);
                        setStreamChars(session.stream_text.length);
                    }

                    if (session.status === 'done') {
                        setMainTex(session.main_tex || "");
                        setReferencesBib(session.references_bib);
                        stopTimer();
                        setActiveTab("tex");
                        setPhase("done");
                        loadSessions(); // refresh history list
                    } else if (session.status === 'generating') {
                        pollRef.current = setTimeout(pollStatus, 1500);
                    }
                } catch (e: any) {
                    stopTimer();
                    setError(e.message);
                    setPhase("done");
                }
            };

            // Start polling loop
            pollStatus();

        } catch (err: any) {
            stopTimer();
            setError(err.message);
            setPhase("done");
        }
    }, [user, setShowLogin, currentSessionId, settings, visuals]);

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

    const handleAddVisualsToReport = (images: CodeImage[]) => {
        if (!mainTex || images.length === 0 || !currentSessionId) return;
        setViewerOpen(false);
        streamGenerate({ 
            prompt: "Please integrate the attached R figures into the report. Place them in appropriate sections and write analytical text referencing them.", 
            type: docType, 
            ...settings, 
            currentTex: mainTex, 
            currentBib: referencesBib,
            useDbImages: true  // backend will read images from DB instead of receiving them over HTTP
        }, topic + " → add visuals");
    };

    const handleSelectSession = async (s: AgentSession) => {
        // Set basic fields from sidebar immediately
        setCurrentSessionId(s.id);
        setTopic(s.title);
        setDocType(s.doc_type as DocType);
        setError(null);
        setSidebarOpen(false);

        // If still generating, go straight to polling mode with whatever we have
        if (s.status === 'generating') {
            setPhase("streaming");
            startTimer();
            setStreamText("");
            setStreamChars(0);
            
            const pollStatus = async () => {
                try {
                    const statusRes = await fetch(`/api/agent/sessions/${s.id}`);
                    if (!statusRes.ok) throw new Error("Status check failed");
                    const { session } = await statusRes.json();

                    if (session.status === 'error') throw new Error(session.error_msg || "Background Agent crashed.");

                    if (session.stream_text) {
                        setStreamText(session.stream_text);
                        setStreamChars(session.stream_text.length);
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
                        pollRef.current = setTimeout(pollStatus, 1500);
                    }
                } catch (e: any) {
                    stopTimer();
                    setError(e.message);
                    setPhase("done");
                }
            };
            pollRef.current = setTimeout(pollStatus, 100);
            return;
        }

        // For done/error sessions, fetch full data from API
        try {
            const res = await fetch(`/api/agent/sessions/${s.id}`);
            if (!res.ok) throw new Error("Failed to load session");
            const { session } = await res.json();

            setMainTex(session.main_tex || "");
            setReferencesBib(session.references_bib || null);
            setMainTex(session.main_tex || "");
            setReferencesBib(session.references_bib || null);
            setVisuals(session.visuals_json ? JSON.parse(session.visuals_json) : []);
            setSettings(session.settings_json ? JSON.parse(session.settings_json) : DEFAULT_SETTINGS);

            if (session.status === 'error') {
                setError(session.error_msg || "Session failed");
            }
            setPhase("done");
        } catch (e: any) {
            console.error("Failed to load session:", e);
            setError("Failed to load session data");
            setPhase("done");
        }
    };

    const handleNewSession = () => {
        setCurrentSessionId(null);
        setTopic("");
        setMainTex("");
        setReferencesBib(null);
        setVisuals([]);
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

    const buildZipBlob = async (): Promise<Blob> => {
        const zip = new JSZip();
        zip.file("main.tex", mainTex);
        if (referencesBib) zip.file("references.bib", referencesBib);
        visuals.forEach((img, i) => {
            const binary = atob(img.image);
            const bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
            const ext = img.language === 'Python' ? 'py' : 'R';
            zip.file(`figures/fig_${i + 1}_${img.chart_type}.png`, bytes);
            if (img.code) zip.file(`figures/fig_${i + 1}_${img.chart_type}.${ext}`, img.code);
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
            
            const res = await fetch("/api/agent/compile-pdf", {
                method: "POST",
                body: formData,
            });
            
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

    const MODES: { id: DocType; label: string; icon: any }[] = [
        { id: "research", label: "Research", icon: IconSearch },
        { id: "assignment", label: "Assignment", icon: IconSchool },
        { id: "diploma", label: "Thesis", icon: IconCertificate },
        { id: "report", label: "Report", icon: IconChartPie },
    ];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
            const text = await file.text();
            setSettings(s => ({ 
                ...s, 
                referenceFilesText: [...s.referenceFilesText, text],
                referenceFileNames: [...s.referenceFileNames, file.name]
            }));
        }
    };

    const removeFile = (idx: number) => {
        setSettings(s => ({
            ...s,
            referenceFilesText: s.referenceFilesText.filter((_, i) => i !== idx),
            referenceFileNames: s.referenceFileNames.filter((_, i) => i !== idx)
        }));
    };

    const handleLinkAdd = () => {
        setSettings(s => ({ ...s, referenceLinks: [...s.referenceLinks, ""] }));
    };
    const updateLink = (idx: number, val: string) => {
        const newLinks = [...settings.referenceLinks];
        newLinks[idx] = val;
        setSettings(s => ({ ...s, referenceLinks: newLinks }));
    };

    // ─── LANDING (ULTRA-MINIMALIST CHAT) ───
    if (phase === "idle") {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center font-sans bg-[#FBFBFC] relative p-6 overflow-hidden">
                <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-2xl flex flex-col items-center">
                    
                    {/* Minimal Branding */}
                    <div className="mb-12 text-center select-none">
                        <img src="/Vector.svg" alt="Perricheno" className="w-12 h-12 mx-auto mb-4 opacity-80" />
                        <p className="text-[10px] font-black uppercase tracking-[0.6em] text-gray-300">Intelligence / Rigor</p>
                    </div>

                    {/* Chat Input Shell */}
                    <div className="w-full bg-white border border-gray-100 rounded-[32px] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] focus-within:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] focus-within:border-black transition-all p-3 flex flex-col group relative">
                        
                        <div className="flex items-start gap-4 px-3 pt-3">
                             <textarea 
                                value={prompt} 
                                onChange={e => setPrompt(e.target.value)} 
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                                placeholder="What are we researching today?" 
                                className="flex-1 text-lg font-bold bg-transparent outline-none placeholder:text-gray-100 resize-none h-24 leading-relaxed" 
                                autoFocus 
                            />
                            
                            <button 
                                onClick={handleGenerate} 
                                disabled={!prompt.trim()} 
                                className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center disabled:opacity-5 disabled:bg-gray-100 transition-all hover:bg-[#1A1A1A] active:scale-95 shrink-0 shadow-lg shadow-black/10"
                            >
                                <IconArrowRight className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Chips & Tools Row */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-3 pb-2 pt-2">
                             <div className="flex flex-wrap gap-1.5">
                                {MODES.map((m) => {
                                    const active = docType === m.id;
                                    return (
                                        <button 
                                            key={m.id} 
                                            onClick={() => setDocType(m.id)} 
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${active ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-50 hover:border-gray-200 hover:text-black'}`}
                                        >
                                            <m.icon className="w-3 h-3" stroke={3} />
                                            {m.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-1">
                                <label className="cursor-pointer p-2 text-gray-200 hover:text-black rounded-xl hover:bg-gray-50 transition-all">
                                    <IconPaperclip className="w-4 h-4" />
                                    <input type="file" className="hidden" multiple accept=".pdf,.txt" onChange={handleFileUpload} />
                                </label>
                                <button onClick={handleLinkAdd} className="p-2 text-gray-200 hover:text-black rounded-xl hover:bg-gray-50 transition-all">
                                    <IconLink className="w-4 h-4" />
                                </button>
                                <button onClick={() => setSettingsOpen(true)} className="p-2 text-gray-200 hover:text-black rounded-xl hover:bg-gray-50 transition-all">
                                    <IconSettings className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* File Preview Chips */}
                        {settings.referenceFileNames.length > 0 && (
                            <div className="px-3 pb-3 flex flex-wrap gap-2">
                                {settings.referenceFileNames.map((name, idx) => (
                                    <div key={idx} className="flex items-center gap-2 pr-1.5 pl-3 py-1 bg-gray-50 rounded-lg text-[9px] font-bold text-black border border-gray-100">
                                        <IconFileText className="w-3 h-3 text-gray-400" />
                                        <span>{name}</span>
                                        <button onClick={() => removeFile(idx)} className="p-1 hover:text-red-500 transition-colors">
                                            <IconX className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Metadata Zone (Adaptive & Subtle) */}
                    <AnimatePresence>
                         {(docType !== "research" || settings.authorName) && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full mt-8 flex flex-wrap gap-8 items-start justify-center">
                                <div className="min-w-[120px] pb-2 border-b border-gray-100 focus-within:border-black transition-colors">
                                    <label className="block text-[8px] font-black uppercase tracking-[0.4em] text-gray-300 mb-1">Author</label>
                                    <input value={settings.authorName} onChange={e => setSettings({...settings, authorName: e.target.value})} placeholder="Your Name" className="bg-transparent outline-none text-[11px] font-bold w-full uppercase tracking-widest placeholder:text-gray-100 placeholder:italic" />
                                </div>

                                {docType === "diploma" && (
                                     <div className="min-w-[120px] pb-2 border-b border-gray-100 focus-within:border-black transition-colors">
                                        <label className="block text-[8px] font-black uppercase tracking-[0.4em] text-gray-300 mb-1">Supervisor</label>
                                        <input value={settings.supervisorName} onChange={e => setSettings({...settings, supervisorName: e.target.value})} placeholder="Full Name" className="bg-transparent outline-none text-[11px] font-bold w-full uppercase tracking-widest placeholder:text-gray-100 placeholder:italic" />
                                    </div>
                                )}

                                {docType === "assignment" && (
                                     <div className="min-w-[120px] pb-2 border-b border-gray-100 focus-within:border-black transition-colors">
                                        <label className="block text-[8px] font-black uppercase tracking-[0.4em] text-gray-300 mb-1">Course</label>
                                        <input value={settings.courseName} onChange={e => setSettings({...settings, courseName: e.target.value})} placeholder="Module Code" className="bg-transparent outline-none text-[11px] font-bold w-full uppercase tracking-widest placeholder:text-gray-100 placeholder:italic" />
                                    </div>
                                )}
                            </motion.div>
                         )}
                    </AnimatePresence>

                    {/* Links Section */}
                    {settings.referenceLinks.length > 0 && (
                        <div className="w-full max-w-sm mt-8 space-y-2">
                            {settings.referenceLinks.map((link, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-50 shadow-sm">
                                    <IconLink className="w-3 h-3 text-gray-300 ml-1" />
                                    <input value={link} onChange={e => updateLink(idx, e.target.value)} placeholder="https://..." className="flex-1 bg-transparent outline-none text-[10px] font-medium text-gray-500" />
                                    <button onClick={() => setSettings(s => ({ ...s, referenceLinks: s.referenceLinks.filter((_, i) => i !== idx) }))} className="p-1 hover:text-black transition-colors"><IconX className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}

                </motion.div>

                {/* Technical Footnote */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 opacity-20 pointer-events-none select-none">
                     <span className="text-[9px] font-black uppercase tracking-[0.4em]">Engine v3.0 // Unified Research Logic</span>
                </div>
            </div>
        );
    }

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
                            <div className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#A1A1AA]">
                                <IconLetterCase className="w-4 h-4" stroke={2.5} /> <span className="tabular-nums">{streamChars.toLocaleString()} chars</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-black tabular-nums tracking-widest">{estimatedProgress}%</span>
                            <div className="w-32 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div className="h-full bg-black" animate={{ width: `${estimatedProgress}%` }} transition={{ duration: 0.3 }} />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 bg-white rounded-[32px] border border-gray-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col">
                        <div className="h-12 bg-white border-b border-gray-50 flex items-center px-6 gap-3 shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                            <span className="text-[10px] font-black text-black uppercase tracking-[0.3em]">Agent Logic Stream</span>
                            <span className="text-[10px] font-black text-[#D4D4D8] ml-auto truncate uppercase tracking-widest max-w-[150px] sm:max-w-xs">{topic}</span>
                        </div>
                        <div ref={streamBoxRef} className="flex-1 overflow-auto p-6 font-mono text-[11px] leading-[1.8] text-[#52525B] bg-[#FAFAFA]">
                            <pre className="m-0 whitespace-pre-wrap break-all">{streamText}<span className="animate-pulse text-black font-black">|</span></pre>
                        </div>
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

                    {/* Edit / Fix */}
                    <div className="flex items-center justify-center gap-6">
                        <button onClick={() => { setIsEditing(!isEditing); setIsFixingErrors(false); }} className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isEditing ? 'text-black' : 'text-gray-300 hover:text-black'}`}>
                            <IconPencil className="w-3.5 h-3.5" stroke={2.5} /> Modify
                        </button>
                        <div className="w-1 h-1 rounded-full bg-gray-100" />
                        <button onClick={() => { setIsFixingErrors(!isFixingErrors); setIsEditing(false); }} className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isFixingErrors ? 'text-black underline' : 'text-gray-300 hover:text-black'}`}>
                            <IconBug className="w-3.5 h-3.5" stroke={2.5} /> Fix Errors
                        </button>
                    </div>

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
            {/* Editor Modal */}
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
                            if (currentSessionId) {
                                fetch(`/api/agent/sessions/${currentSessionId}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ visuals_json: newArr })
                                });
                            }
                        }}
                        sessionId={currentSessionId}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
