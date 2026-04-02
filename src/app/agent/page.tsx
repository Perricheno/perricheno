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
import { AgentBillingModal } from "./AgentBillingModal";

export default function AgentPage() {
    const { user, setShowLogin } = useAdmin();

    const [prompt, setPrompt] = useState("");
    const [docType, setDocType] = useState<DocType>("research");
    const [phase, setPhase] = useState<"idle" | "streaming" | "done">("idle");
    const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [billingOpen, setBillingOpen] = useState(false);

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

    // Mode dropdown
    const [modeOpen, setModeOpen] = useState(false);
    const modeRef = useRef<HTMLDivElement>(null);

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
                if (res.status === 402) {
                    setBillingOpen(true);
                    throw new Error("Quota exceeded! Please buy tokens to continue.");
                }
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

    // Close mode dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ─── LANDING ───
    if (phase === "idle") {
        const activeMode = MODES.find(m => m.id === docType) || MODES[0];

        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#FBFBFC] relative p-6 overflow-hidden">
                <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-[640px] flex flex-col items-center">
                    
                    {/* Branding */}
                    <div className="mb-10 text-center select-none">
                        <img src="/Vector.svg" alt="Perricheno" className="w-10 h-10 mx-auto mb-4 opacity-80" />
                        <h1 className="text-[22px] font-semibold text-[#1a1a1a] tracking-[-0.02em]">Perricheno Intelligence</h1>
                    </div>

                    {/* Input Container */}
                    <div className="w-full bg-white rounded-2xl border border-[#e5e5e5] shadow-sm focus-within:border-[#c0c0c0] focus-within:shadow-md transition-all">
                        
                        {/* Textarea */}
                        <div className="px-5 pt-4 pb-2">
                            <textarea 
                                value={prompt} 
                                onChange={e => setPrompt(e.target.value)} 
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                                placeholder="What would you like to research?" 
                                className="w-full text-[15px] text-[#1a1a1a] bg-transparent outline-none placeholder:text-[#c0c0c0] resize-none h-[88px] leading-relaxed" 
                                autoFocus 
                            />
                        </div>

                        {/* Bottom toolbar */}
                        <div className="flex items-center justify-between px-4 pb-3 pt-1">
                            {/* Left: Mode selector + tools */}
                            <div className="flex items-center gap-1">
                                {/* Mode Dropdown */}
                                <div className="relative" ref={modeRef}>
                                    <button 
                                        onClick={() => setModeOpen(!modeOpen)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#666] hover:bg-[#f5f5f5] transition-colors"
                                    >
                                        <activeMode.icon className="w-4 h-4" stroke={2} />
                                        <span>{activeMode.label}</span>
                                        <svg className={`w-3 h-3 ml-0.5 transition-transform ${modeOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                    </button>

                                    <AnimatePresence>
                                        {modeOpen && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 4, scale: 0.97 }} 
                                                animate={{ opacity: 1, y: 0, scale: 1 }} 
                                                exit={{ opacity: 0, y: 4, scale: 0.97 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute bottom-full left-0 mb-2 w-52 bg-white rounded-xl border border-[#e5e5e5] shadow-lg py-1 z-50"
                                            >
                                                {MODES.map(m => (
                                                    <button 
                                                        key={m.id}
                                                        onClick={() => { setDocType(m.id); setModeOpen(false); }}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors text-left ${m.id === docType ? 'bg-[#f5f5f5] text-[#1a1a1a]' : 'text-[#666] hover:bg-[#fafafa]'}`}
                                                    >
                                                        <m.icon className="w-4 h-4 shrink-0" stroke={2} />
                                                        <span>{m.label}</span>
                                                        {m.id === docType && (
                                                            <IconCheck className="w-4 h-4 ml-auto text-[#1a1a1a]" stroke={2.5} />
                                                        )}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="w-px h-4 bg-[#e5e5e5] mx-1" />

                                <label className="cursor-pointer p-2 text-[#999] hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors">
                                    <IconPaperclip className="w-4 h-4" stroke={2} />
                                    <input type="file" className="hidden" multiple accept=".pdf,.txt" onChange={handleFileUpload} />
                                </label>
                                <button onClick={handleLinkAdd} className="p-2 text-[#999] hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors">
                                    <IconLink className="w-4 h-4" stroke={2} />
                                </button>
                                <button onClick={() => setSettingsOpen(true)} className="p-2 text-[#999] hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors" title="Document Settings">
                                    <IconSettings className="w-4 h-4" stroke={2} />
                                </button>
                                <button onClick={() => setBillingOpen(true)} className="p-2 text-[#999] hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors" title="Account & Billing">
                                    <IconUser className="w-4 h-4" stroke={2} />
                                </button>
                            </div>

                            {/* Right: Submit */}
                            <button 
                                onClick={handleGenerate} 
                                disabled={!prompt.trim()} 
                                className="w-8 h-8 bg-[#1a1a1a] text-white rounded-lg flex items-center justify-center disabled:opacity-10 disabled:bg-[#e5e5e5] transition-all hover:bg-black active:scale-95"
                            >
                                <IconArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Attached files */}
                    {settings.referenceFileNames.length > 0 && (
                        <div className="w-full mt-3 flex flex-wrap gap-2">
                            {settings.referenceFileNames.map((name, idx) => (
                                <div key={idx} className="flex items-center gap-2 pr-1.5 pl-3 py-1.5 bg-white rounded-lg text-[12px] font-medium text-[#666] border border-[#e5e5e5]">
                                    <IconFileText className="w-3.5 h-3.5 text-[#999]" />
                                    <span>{name}</span>
                                    <button onClick={() => removeFile(idx)} className="p-0.5 hover:text-red-500 transition-colors">
                                        <IconX className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Links */}
                    {settings.referenceLinks.length > 0 && (
                        <div className="w-full mt-3 space-y-2">
                            {settings.referenceLinks.map((link, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-[#e5e5e5]">
                                    <IconLink className="w-3.5 h-3.5 text-[#999] shrink-0" />
                                    <input value={link} onChange={e => updateLink(idx, e.target.value)} placeholder="https://..." className="flex-1 bg-transparent outline-none text-[13px] text-[#666]" />
                                    <button onClick={() => setSettings(s => ({ ...s, referenceLinks: s.referenceLinks.filter((_, i) => i !== idx) }))} className="p-1 text-[#ccc] hover:text-[#1a1a1a] transition-colors"><IconX className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}

                </motion.div>
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
            
            <AgentBillingModal 
                isOpen={billingOpen} 
                onClose={() => setBillingOpen(false)} 
                totalSessions={sessions.length} 
            />
        </div>
    );
}
