"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip,
    IconFileText, IconBook, IconPackage, IconDownload,
    IconX, IconPencil, IconCheck, IconEye, IconBug,
    IconClock, IconLetterCase, IconSettings,
    IconSchool, IconSearch, IconCertificate, IconChartPie,
    IconLink, IconFilePlus, IconUser, IconChevronLeft, IconDatabase, IconMessageCircle, IconTerminal2,
    IconPlus, IconLock, IconRobot, IconBook2
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useAdmin } from "@/components/AdminContext";
import { useRouter } from "next/navigation";

import { DocType, AgentSettings, DEFAULT_SETTINGS, CodeImage, AgentSession } from "./types";
import { AgentSettingsPanel } from "./AgentSettingsPanel";
import { AgentSidebar } from "./AgentSidebar";
import { AgentBillingModal } from "./AgentBillingModal";

function Typewriter({ phrases }: { phrases: string[] }) {
    const [text, setText] = useState("");
    const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");
    const [phraseIndex, setPhraseIndex] = useState(0);

    useEffect(() => {
        const currentPhrase = phrases[phraseIndex];
        let timeout: NodeJS.Timeout;

        if (phase === "typing") {
            if (text.length < currentPhrase.length) {
                timeout = setTimeout(() => setText(currentPhrase.slice(0, text.length + 1)), 50 + Math.random() * 30);
            } else {
                timeout = setTimeout(() => setPhase("pausing"), 2000);
            }
        } else if (phase === "pausing") {
            timeout = setTimeout(() => setPhase("deleting"), 0);
        } else if (phase === "deleting") {
            if (text.length > 0) {
                timeout = setTimeout(() => setText(currentPhrase.slice(0, text.length - 1)), 20 + Math.random() * 10);
            } else {
                setPhraseIndex((i) => (i + 1) % phrases.length);
                setPhase("typing");
            }
        }
        return () => clearTimeout(timeout);
    }, [text, phase, phraseIndex, phrases]);

    return <span className="text-[#A1A1AA] text-sm md:text-base font-mono tracking-tight">{text}<span className="animate-pulse text-gray-400">|</span></span>;
}

export default function AgentPage() {
    const { user, setShowLogin } = useAdmin();
    const router = useRouter();

    const [prompt, setPrompt] = useState("");
    const [docType, setDocType] = useState<DocType>("research");
    const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [billingOpen, setBillingOpen] = useState(false);

    // Sessions (sidebar)
    const [sessions, setSessions] = useState<AgentSession[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Mode dropdown
    const [modeOpen, setModeOpen] = useState(false);
    const modeRef = useRef<HTMLDivElement>(null);

    // Agent Mode States
    const [isAgentMode, setIsAgentMode] = useState(true);
    const [agentSubMode, setAgentSubMode] = useState<"data_analytics" | "chat" | "literature_search">("literature_search");
    const [agentDataFiles, setAgentDataFiles] = useState<{name: string, content: string, type?: string}[]>([]);

    // Suggestion step state (Data Analytics)
    const [suggestedCharts, setSuggestedCharts] = useState<string[]>([]);
    const [suggestReasoning, setSuggestReasoning] = useState("");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [analyticsPrompt, setAnalyticsPrompt] = useState("");
    const [phase, setPhase] = useState<"idle" | "suggesting">("idle");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) loadSessions();
    }, [user]);

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

    // Close mode dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const suggestions: { label: string; type: DocType }[] = [
        { label: "Research Paper", type: "research" },
        { label: "Literature Review", type: "literature_review" },
        { label: "Data Analysis", type: "report" },
    ];

    const MODES: { id: DocType; label: string; icon: any }[] = [
        { id: "research", label: "Research", icon: IconSearch },
        { id: "assignment", label: "Assignment", icon: IconSchool },
        { id: "diploma", label: "Thesis", icon: IconCertificate },
        { id: "report", label: "Report", icon: IconChartPie },
    ];

    const AGENT_MODES: { id: "data_analytics" | "chat"; label: string; icon: any }[] = [
        { id: "data_analytics", label: "Data Analytics", icon: IconDatabase },
        { id: "chat", label: "Chat", icon: IconRobot },
    ];

    // ─── Generate (Agent/Report mode) → create session → redirect ───
    const handleGenerate = async () => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;
        if (isGenerating) return;

        setIsGenerating(true);
        if (!isAgentMode) {
            if (agentSubMode === 'chat') {
                try {
                    const res = await fetch('/api/agent/chat/sessions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ initialMessage: prompt })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        // Send the first message immediately after redirect
                        const sessionId = data.sessionId;
                        // Store the message temporarily so the chat page can pick it up
                        // Only the prompt survives the redirect. If the user had
                        // files on the landing, they'll re-attach in chat - chat
                        // now requires server-side ingest via /api/agent/attach.
                        sessionStorage.setItem('pendingChatMessage', JSON.stringify({
                            sessionId,
                            message: prompt,
                        }));
                        router.push(`/agent/chat/${sessionId}`);
                    }
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setIsGenerating(false);
                }
                return;
            } else if (agentSubMode === 'literature_search') {
                try {
                    const res = await fetch('/api/agent/scholar/sessions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt, settings })
                    });
                    if (!res.ok) {
                        if (res.status === 402) { setBillingOpen(true); return; }
                        const errData = await res.json().catch(() => ({ error: "Unknown API error" }));
                        setError(errData.error || `HTTP ${res.status}`);
                        return;
                    }
                    const data = await res.json();
                    router.push(`/agent/scholar/${data.sessionId}`);
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setIsGenerating(false);
                }
                return;
            } else if (agentSubMode === 'data_analytics') {
                // NEW: Analytics Pipeline with proper data verification
                try {
                    if (settings.uploadIds.length === 0) {
                        setError("Please upload data files (CSV, Excel, etc.) before generating visualizations.");
                        setIsGenerating(false);
                        return;
                    }
                    
                    const res = await fetch('/api/agent/analytics/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt,
                            runtime: settings.runtime,
                            uploadIds: settings.uploadIds
                        })
                    });
                    
                    if (!res.ok) {
                        if (res.status === 402) { setBillingOpen(true); return; }
                        const errData = await res.json().catch(() => ({ error: "Unknown API error" }));
                        setError(errData.error || `HTTP ${res.status}`);
                        return;
                    }
                    
                    const data = await res.json();
                    router.push(`/agent/analytics/${data.sessionId}`);
                } catch (err: any) {
                    setError(err.message);
                } finally {
                    setIsGenerating(false);
                }
                return;
            }
            setIsGenerating(false);
            return;
        }

        // Create session and start generation, then redirect
        try {
            const res = await fetch('/api/agent/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, type: docType, ...settings })
            });

            if (!res.ok) {
                if (res.status === 402) { setBillingOpen(true); return; }
                const errData = await res.json().catch(() => ({ error: "Unknown API error" }));
                setError(errData.error || `HTTP ${res.status}`);
                return;
            }

            const { sessionId } = await res.json();
            router.push(`/agent/research/${sessionId}`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // ─── STEP 1: Data Analytics → suggest chart types ───
    const handleAgentGenerate = async () => {
        setIsSuggesting(true);
        setAnalyticsPrompt(prompt);
        setError(null);
        setPrompt("");

        try {
            const res = await fetch('/api/agent/data-analytics', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'suggest', prompt, contextFiles: agentDataFiles })
            });

            if (!res.ok) {
                if (res.status === 402) { setBillingOpen(true); throw new Error("Quota exceeded!"); }
                const errData = await res.json().catch(() => ({ error: "Unknown API error" }));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            setSuggestedCharts(data.charts || ["bar", "scatter", "line"]);
            setSuggestReasoning(data.reasoning || "");
            setPhase("suggesting");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsSuggesting(false);
        }
    };

    // ─── STEP 2: Start analytics generation → create session → redirect ───
    const startAnalyticsGenerate = async (charts: string[]) => {
        try {
            const res = await fetch('/api/agent/data-analytics', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    action: 'generate',
                    prompt: analyticsPrompt, 
                    contextFiles: agentDataFiles,
                    charts,
                    runtime: settings.runtime
                })
            });

            if (!res.ok) {
                if (res.status === 402) { setBillingOpen(true); return; }
                const errData = await res.json().catch(() => ({ error: "Unknown API error" }));
                setError(errData.error || `HTTP ${res.status}`);
                return;
            }

            // For analytics, we save the session after it streams.
            // Read SSE stream in the background, save session on all_done, then redirect.
            const reader = res.body?.getReader();
            const decoder = new TextDecoder("utf-8");
            const collectedVisuals: any[] = [];

            if (reader) {
                let currentChunk = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunkStr = decoder.decode(value, { stream: true });
                    currentChunk += chunkStr;
                    const events = currentChunk.split("\n\n");
                    currentChunk = events.pop() || "";

                    for (const eventStr of events) {
                        const evtLines = eventStr.split("\n");
                        const eventLine = evtLines.find(l => l.startsWith("event:"));
                        const dataLine = evtLines.find(l => l.startsWith("data:"));
                        if (eventLine && dataLine) {
                            const eventName = eventLine.replace("event: ", "").trim();
                            const dataText = dataLine.replace("data: ", "").trim();
                            try {
                                const data = JSON.parse(dataText);
                                if (eventName === 'chart_done') {
                                    collectedVisuals.push({
                                        image: data.image,
                                        chart_type: data.chartType,
                                        code: data.code,
                                        language: data.runtime || settings.runtime
                                    });
                                } else if (eventName === 'all_done') {
                                    // Save session and redirect
                                    const saveRes = await fetch('/api/agent/sessions', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            title: analyticsPrompt.slice(0, 80),
                                            doc_type: 'data_analytics',
                                            settings_json: settings,
                                            visuals_json: collectedVisuals,
                                        })
                                    });
                                    if (saveRes.ok) {
                                        const { session } = await saveRes.json();
                                        router.push(`/agent/${session.id}`);
                                        return;
                                    }
                                }
                            } catch (e) {}
                        }
                    }
                }
            }
            // If we get here without a redirect, just go back to idle
            setPhase("idle");
            loadSessions();
        } catch (e: any) {
            setError(e.message);
            setPhase("idle");
        }
    };

    const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const processFiles = async (files: File[]) => {
        for (const file of files) {
            // Show uploading indicator
            setUploadingFiles(prev => [...prev, file.name]);
            
            try {
                // Use /api/agent/attach for all file types
                const fd = new FormData();
                fd.append('file', file);
                
                const res = await fetch('/api/agent/attach', { 
                    method: 'POST', 
                    body: fd 
                });
                
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                    setError(err?.error || err?.message || `Upload failed (HTTP ${res.status}).`);
                    continue;
                }
                
                const meta = await res.json();
                
                // Validate that we have an uploadId
                if (!meta.uploadId) {
                    setError(`Upload failed: No uploadId returned for ${file.name}`);
                    continue;
                }
                
                // Update state
                setSettings((s: any) => ({
                    ...s,
                    uploadIds: [...s.uploadIds, meta.uploadId],
                    uploadMeta: [...s.uploadMeta, {
                        id: meta.uploadId,
                        filename: meta.filename || file.name,
                        charCount: meta.charCount || 0,
                        imageCount: meta.imageCount || 0,
                        pageCount: meta.pageCount || 1,
                        ocrUsed: meta.ocrUsed || false,
                    }],
                }));
                
            } catch (err: any) {
                console.error(`[upload] ${file.name}:`, err);
                setError(err?.message || 'Upload failed.');
            } finally {
                // Remove from uploading list
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
        const files = Array.from(e.dataTransfer.files);
        await processFiles(files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const removeFile = async (idx: number) => {
        if (!isAgentMode) {
            setAgentDataFiles(prev => prev.filter((_, i) => i !== idx));
            return;
        }
        const target = settings.uploadMeta[idx];
        if (target && target.id) {
            // Best-effort: drop the server-side cached upload too.
            fetch(`/api/agent/ingest-pdf?id=${encodeURIComponent(target.id)}`, { method: 'DELETE' })
                .catch(() => {});
        }
        setSettings(s => ({
            ...s,
            uploadIds: s.uploadIds.filter((_, i) => i !== idx),
            uploadMeta: s.uploadMeta.filter((_, i) => i !== idx),
        }));
    };

    const handleLinkAdd = () => {
        const url = window.prompt("Enter a URL to provide context to the AI:");
        if (url && url.trim() !== "") {
            setSettings(s => ({ ...s, referenceLinks: [...s.referenceLinks, url.trim()] }));
        }
    };
    const updateLink = (idx: number, val: string) => {
        const newLinks = [...settings.referenceLinks];
        newLinks[idx] = val;
        setSettings(s => ({ ...s, referenceLinks: newLinks }));
    };

    // Navigate to session
    const handleSelectSession = (s: AgentSession) => {
        setSidebarOpen(false);
        if (s.doc_type === 'chat') {
            router.push(`/agent/chat/${s.id}`);
        } else if (s.doc_type === 'literature_search') {
            router.push(`/citations`);
        } else if (s.doc_type === 'data_analytics' || s.doc_type === 'data-analytics') {
            router.push(`/agent/analytics/${s.id}`);
        } else {
            router.push(`/agent/research/${s.id}`);
        }
    };

    const handleNewSession = () => {
        setPhase("idle");
        setSuggestedCharts([]);
        setAnalyticsPrompt("");
        setPrompt("");
        setError(null);
    };

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this document?")) return;
        await fetch(`/api/agent/sessions/${id}`, { method: 'DELETE' });
        setSessions(prev => prev.filter(s => s.id !== id));
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

    // ─── SUGGESTING (Data Analytics - Chart Selection) ───
    if (phase === "suggesting") {
        const ALL_CHARTS = [
            "bar","line","scatter","bubble","lollipop","histogram","density2d","ridge","boxplot","violin",
            "joyplot","kdensity","heatmap","marginal","hexbin","pairplot","qqplot","pie","rose","treemap",
            "circlepack","sunburst","waffle","dendrogram","radar","network","sankey","chord","parallel",
            "waterfall","dumbbell","volcano","survival","wordcloud","choropleth","bubble_map","pca","kmeans",
            "roc","regression","arima","3d_surface","3d_scatter"
        ];

        const toggleChart = (chart: string) => {
            setSuggestedCharts(prev => 
                prev.includes(chart) 
                    ? prev.filter(c => c !== chart) 
                    : [...prev, chart]
            );
        };

        return (
            <div className="w-full h-full flex flex-col items-center bg-[#FBFBFC] relative overflow-auto">
                <AgentSidebar sessions={sessions} currentSessionId={null} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-2xl flex flex-col items-center px-4 py-10 md:py-16">
                    
                    <div className="w-16 h-16 rounded-full bg-white border border-gray-100 shadow-xl flex items-center justify-center mx-auto mb-5">
                        <IconChartPie className="w-8 h-8 text-black" stroke={2} />
                    </div>
                    
                    <h2 className="text-2xl font-black text-black tracking-tight mb-1 text-center">Configure Visualizations</h2>
                    <p className="text-xs text-[#A1A1AA] font-medium mb-6 text-center max-w-md">{suggestReasoning}</p>

                    {/* Runtime Toggle */}
                    <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 mb-6 shadow-sm">
                        <button 
                            disabled={['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free')}
                            onClick={() => setSettings(s => ({ ...s, runtime: 'R' }))}
                            className={`px-5 py-2 flex items-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                ['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free')
                                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-50'
                                    : settings.runtime === 'R' 
                                        ? 'bg-black text-white shadow-sm' 
                                        : 'text-gray-400 hover:text-black'
                            }`}>
                            {['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free') && <IconLock className="w-3 h-3" />}
                            R
                        </button>
                        <button 
                            onClick={() => setSettings(s => ({ ...s, runtime: 'Python' }))}
                            className={`px-5 py-2 flex items-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                settings.runtime === 'Python' 
                                    ? 'bg-black text-white shadow-sm' 
                                    : 'text-gray-400 hover:text-black'
                            }`}>
                            Python
                        </button>
                    </div>

                    {/* Chart Selection Grid */}
                    <div className="w-full mb-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">
                            Select chart types · <span className="text-black">{suggestedCharts.length}</span> selected
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {ALL_CHARTS.map((chart) => {
                                const isSelected = suggestedCharts.includes(chart);
                                const isPremium = !["bar", "line", "scatter", "histogram", "pie"].includes(chart);
                                const isLocked = isPremium && (!user?.plan_tier || user.plan_tier.toLowerCase() === "free");
                                return (
                                    <button
                                        key={chart}
                                        onClick={() => !isLocked && toggleChart(chart)}
                                        disabled={isLocked}
                                        className={`px-3 py-1.5 flex items-center gap-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                            isLocked
                                                ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'
                                                : isSelected
                                                    ? 'bg-black text-white border-black shadow-sm'
                                                    : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300 hover:text-gray-600'
                                        }`}
                                    >
                                        {isLocked && <IconLock className="w-3 h-3" stroke={2.5} />}
                                        {chart.replace(/_/g, " ")}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 sticky bottom-4">
                        <button 
                            onClick={() => { setPhase("idle"); setSuggestedCharts([]); }} 
                            className="px-6 py-3 bg-white text-black border border-gray-100 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:border-black transition-all active:scale-95"
                        >
                            Back
                        </button>
                        <button 
                            onClick={() => startAnalyticsGenerate(suggestedCharts)} 
                            disabled={suggestedCharts.length === 0}
                            className="px-8 py-3.5 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] transition-all shadow-2xl active:scale-95 disabled:opacity-20 flex items-center gap-2"
                        >
                            <IconArrowRight className="w-4 h-4" /> Generate {suggestedCharts.length} Chart{suggestedCharts.length !== 1 ? 's' : ''}
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ─── LANDING / IDLE ───
    const activeMode = !isAgentMode 
        ? AGENT_MODES.find(m => m.id === agentSubMode) || AGENT_MODES[0]
        : MODES.find(m => m.id === docType) || MODES[0];

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#FBFBFC] relative p-6 overflow-hidden">
            <AgentSidebar sessions={sessions} currentSessionId={null} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

            {/* Suggesting overlay */}
            <AnimatePresence>
                {isSuggesting && (
                    <motion.div
                        key="suggesting-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 z-30 bg-[#FBFBFC]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                    >
                        <div className="w-14 h-14 rounded-full bg-white border border-gray-100 shadow-xl flex items-center justify-center">
                            <IconLoader2 className="w-6 h-6 text-black animate-spin" />
                        </div>
                        <p className="text-sm font-bold text-black tracking-tight">Analyzing your data...</p>
                        <p className="text-xs text-gray-400">AI is recommending the best chart types</p>
                    </motion.div>
                )}
                {isGenerating && (
                    <motion.div
                        key="generating-overlay"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 z-30 bg-[#FBFBFC]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                    >
                        <div className="w-14 h-14 rounded-full bg-white border border-gray-100 shadow-xl flex items-center justify-center">
                            <IconLoader2 className="w-6 h-6 text-black animate-spin" />
                        </div>
                        <p className="text-sm font-bold text-black tracking-tight">Initializing Session...</p>
                        <p className="text-xs text-gray-400">Preparing your isolated environment</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-[640px] flex flex-col items-center">
                
                {/* Branding */}
                <div className="mb-10 text-center select-none flex flex-col items-center justify-center">
                    <h1 className="text-4xl md:text-5xl font-black text-[#1a1a1a] tracking-tighter mb-2">Perricheno Intelligence.</h1>
                    <div className="h-6 flex items-center justify-center">
                        <Typewriter phrases={[
                            "Write a thesis on quantum physics...",
                            "Analyze Q4 financial statements...",
                            "Draft a literature review on AI...",
                            "Generate interactive data dashboards...",
                            "Compile advanced LaTeX documents...",
                            "Compile peer-reviewed LaTeX papers...",
                            "Render interactive Plotly dashboards...",
                            "Track precise token usage per task...",
                            "Forecast ARIMA time-series trends...",
                            "Generate high-res Seaborn heatmaps...",
                            "Format PhD-level academic theses...",
                        ]} />
                    </div>
                </div>

                {/* Input Container */}
                <div 
                    className="w-full bg-white rounded-2xl border border-[#e5e5e5] shadow-sm focus-within:border-[#c0c0c0] focus-within:shadow-md transition-all relative"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                >
                    {/* Drag & Drop Overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 z-50 bg-[#1a1a1a]/5 backdrop-blur-sm rounded-2xl border-2 border-dashed border-[#1a1a1a] flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <IconPlus className="w-12 h-12 text-[#1a1a1a]" stroke={2.5} />
                                <p className="text-sm font-bold text-[#1a1a1a]">Drop files here</p>
                            </div>
                        </div>
                    )}
                    
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
                                            <AnimatePresence mode="wait" initial={false}>
                                                <motion.div
                                                    key={isAgentMode ? "doc-modes" : "agent-modes"}
                                                    initial={{ opacity: 0, y: -4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 4 }}
                                                    transition={{ duration: 0.12 }}
                                                >
                                                    {(!isAgentMode ? AGENT_MODES : MODES).map((m: any) => (
                                                        <button
                                                            key={m.id}
                                                            onClick={() => { if(!isAgentMode) { setAgentSubMode(m.id); } else { setDocType(m.id); } setModeOpen(false); }}
                                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors text-left ${(!isAgentMode ? m.id === agentSubMode : m.id === docType) ? 'bg-[#f5f5f5] text-[#1a1a1a]' : 'text-[#666] hover:bg-[#fafafa]'}`}
                                                        >
                                                            <m.icon className="w-4 h-4 shrink-0" stroke={2} />
                                                            <span>{m.label}</span>
                                                            {(!isAgentMode ? m.id === agentSubMode : m.id === docType) && (
                                                                <IconCheck className="w-4 h-4 ml-auto text-[#1a1a1a]" stroke={2.5} />
                                                            )}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            </AnimatePresence>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="w-px h-4 bg-[#e5e5e5] mx-1" />

                            <label className="flex items-center gap-1.5 cursor-pointer ml-0.5">
                                <div className="relative rounded-full w-8 h-4 transition-colors duration-300" style={{ backgroundColor: isAgentMode ? "#1a1a1a" : "#e5e5e5" }}>
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${isAgentMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </div>
                                <span className="text-[13px] font-medium text-[#666]">Agent</span>
                                <input type="checkbox" className="hidden" checked={isAgentMode} onChange={(e) => setIsAgentMode(e.target.checked)} />
                            </label>

                            <div className="w-px h-4 bg-[#e5e5e5] mx-0.5" />

                            <label className="cursor-pointer p-1 text-[#999] hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors">
                                <IconPaperclip className="w-4 h-4" stroke={2} />
                                <input type="file" className="hidden" multiple accept=".pdf,.txt,.csv,.xlsx,.xls,.docx,.doc,.json,.tsv,.md,.xml,.pptx,.ppt,.png,.jpg,.jpeg,.webp" onChange={handleFileUpload} />
                            </label>
                            {(!isAgentMode && agentSubMode === "chat") ? null : (
                                <>
                                    <button onClick={handleLinkAdd} className="p-1 text-[#999] hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors">
                                        <IconLink className="w-4 h-4" stroke={2} />
                                    </button>
                                    <div className="relative">
                                        <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-1 rounded-lg transition-colors ${settingsOpen ? 'text-[#1a1a1a] bg-[#f5f5f5]' : 'text-[#999] hover:text-[#1a1a1a] hover:bg-[#f5f5f5]'}`} title="Document Settings">
                                            <IconSettings className="w-4 h-4" stroke={2} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: Submit */}
                        <button 
                            onClick={handleGenerate} 
                            disabled={!prompt.trim() || isSuggesting || isGenerating} 
                            className="w-8 h-8 bg-[#1a1a1a] text-white rounded-lg flex items-center justify-center disabled:opacity-10 disabled:bg-[#e5e5e5] transition-all hover:bg-black active:scale-95"
                        >
                            {(isSuggesting || isGenerating) ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconArrowRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Uploading files indicator */}
                {uploadingFiles.length > 0 && (
                    <div className="w-full mt-3 flex flex-wrap gap-2">
                        {uploadingFiles.map((filename, idx) => (
                            <div key={idx} className="flex items-center gap-2 pr-3 pl-3 py-1.5 bg-[#f5f5f5] rounded-[12px] shadow-sm border border-[#e5e5e5] max-w-[260px]">
                                <IconLoader2 className="w-3.5 h-3.5 text-[#666] animate-spin shrink-0" />
                                <span className="text-[12px] font-medium text-[#1a1a1a] truncate">{filename}</span>
                                <span className="text-[10px] text-[#999] shrink-0">Uploading...</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Attached files */}
                {settings.uploadMeta.length > 0 && (
                    <div className="w-full mt-3 flex flex-wrap gap-2">
                        {settings.uploadMeta.map((u, idx) => (
                            <div key={u.id || idx} className="flex items-center gap-2 pr-1.5 pl-3 py-1.5 bg-white rounded-[12px] shadow-sm border border-[#e5e5e5] max-w-[260px]" title={`${u.charCount.toLocaleString()} chars · ${u.imageCount} images · ${u.pageCount} pages${u.ocrUsed ? " · OCR" : ""}`}>
                                <IconFileText className="w-3.5 h-3.5 text-[#999] shrink-0" />
                                <span className="text-[12px] font-medium text-[#1a1a1a] truncate">{u.filename}</span>
                                <span className="text-[10px] font-mono text-[#999] shrink-0">{Math.round(u.charCount / 1000)}k{u.imageCount > 0 ? ` · ${u.imageCount}🖼` : ""}{u.ocrUsed ? " · OCR" : ""}</span>
                                <button onClick={() => removeFile(idx)} className="p-0.5 text-gray-400 hover:text-[#1a1a1a] transition-colors shrink-0">
                                    <IconX className="w-3.5 h-3.5" />
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

                {/* Settings Panel */}
                <AnimatePresence>
                    {settingsOpen && (
                        <motion.div
                            key="settings-panel"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            className="w-full overflow-hidden"
                        >
                            <AgentSettingsPanel
                                settings={settings}
                                updateSetting={(k, v) => setSettings(s => ({ ...s, [k]: v }))}
                                detailsOpen={detailsOpen}
                                setDetailsOpen={setDetailsOpen}
                                agentSubMode={!isAgentMode ? agentSubMode : null}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

            </motion.div>

            {/* Error display */}
            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium shadow-lg">
                        {error}
                        <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-600"><IconX className="w-4 h-4 inline" /></button>
                    </motion.div>
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
