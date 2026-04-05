"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip,
    IconFileText, IconBook, IconPackage, IconDownload,
    IconX, IconPencil, IconCheck, IconEye, IconBug,
    IconClock, IconLetterCase, IconSettings,
    IconSchool, IconSearch, IconCertificate, IconChartPie,
    IconLink, IconFilePlus, IconUser, IconChevronLeft, IconDatabase, IconMessageCircle, IconTerminal2,
    IconPlus
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import JSZip from "jszip";
import ReactMarkdown from "react-markdown";
import { useAdmin } from "@/components/AdminContext";

import { DocType, AgentSettings, DEFAULT_SETTINGS, CodeImage, AgentSession } from "./types";
import { AgentSettingsPanel } from "./AgentSettingsPanel";
import { AgentSidebar } from "./AgentSidebar";
import { AgentVisualizations } from "./AgentVisualizations";
import { CodeEditorModal } from "./CodeEditorModal";
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

    const [prompt, setPrompt] = useState("");
    const [docType, setDocType] = useState<DocType>("research");
    const [phase, setPhase] = useState<"idle" | "suggesting" | "streaming" | "done">("idle");
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

    // Suggestion step state (Data Analytics)
    const [suggestedCharts, setSuggestedCharts] = useState<string[]>([]);
    const [suggestReasoning, setSuggestReasoning] = useState("");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [analyticsPrompt, setAnalyticsPrompt] = useState("");
    const [isAnalyticsSession, setIsAnalyticsSession] = useState(false);
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
    const [displayStreamText, setDisplayStreamText] = useState("");
    const targetStreamText = useRef("");
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Agent Mode States
    const [isAgentMode, setIsAgentMode] = useState(true);
    const [agentSubMode, setAgentSubMode] = useState<"data_analytics">("data_analytics");
    const [agentDataFiles, setAgentDataFiles] = useState<{name: string, content: string}[]>([]);
    const [agentLogs, setAgentLogs] = useState<{type: string, message: string}[]>([]);
    const [agentSteps, setAgentSteps] = useState<{label: string, status: "pending" | "running" | "done" | "error"}[]>([]);
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
    }, [displayStreamText]);

    // Typing effect for "Ideal Stream"
    useEffect(() => {
        const interval = setInterval(() => {
            if (displayStreamText.length < targetStreamText.current.length) {
                // Add next character
                const nextChar = targetStreamText.current[displayStreamText.length];
                setDisplayStreamText(prev => prev + nextChar);
                setStreamChars(prev => prev + 1);
            }
        }, 15); // Adjust for speed
        return () => clearInterval(interval);
    }, [displayStreamText]);

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
        setDisplayStreamText("");
        targetStreamText.current = "";
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
                        targetStreamText.current = session.stream_text;
                    }

                    if (session.status === 'done') {
                        setMainTex(session.main_tex || "");
                        setReferencesBib(session.references_bib);
                        stopTimer();
                        setActiveTab("tex");
                        setPhase("done");
                        loadSessions(); // refresh history list
                    } else if (session.status === 'generating') {
                        pollRef.current = setTimeout(pollStatus, 400); // More frequent polling for smoother streaming
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

    // ─── STEP 1: Ask AI to suggest chart types ───
    const handleAgentGenerate = async () => {
        setIsSuggesting(true);
        setAnalyticsPrompt(prompt);
        setTopic(prompt);
        setIsAnalyticsSession(true);
        setError(null);
        setPrompt("");

        try {
            const res = await fetch('/api/agent/data-analytics', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    action: 'suggest',
                    prompt, 
                    contextFiles: agentDataFiles 
                })
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
            setPhase("idle");
        } finally {
            setIsSuggesting(false);
        }
    };

    // ─── STEP 2: Start generation with confirmed chart types ───
    const startAnalyticsGenerate = async (charts: string[]) => {
        setPhase("streaming");
        setAgentLogs([]);
        setVisuals([]);
        const steps = charts.map((c, i) => ({ 
            label: `${c.replace("_", " ")} (${i+1}/${charts.length})`, 
            status: "pending" as const 
        }));
        setAgentSteps([
            { label: "Initializing analytics pipeline", status: "done" as const },
            { label: "Processing data context", status: "done" as const },
            ...steps
        ]);
        setIsEditing(false);
        setIsFixingErrors(false);
        startTimer();

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
                if (res.status === 402) { setBillingOpen(true); throw new Error("Quota exceeded!"); }
                const errData = await res.json().catch(() => ({ error: "Unknown API error" }));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder("utf-8");

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
                                if (eventName === 'status') {
                                    setAgentSteps(prev => {
                                        const next = [...prev];
                                        const idx = next.findIndex(s => s.label.includes(data.id?.replace('chart_', '') || '___'));
                                        if (data.id?.startsWith('chart_')) {
                                            const chartIdx = parseInt(data.id.split('_')[1]) + 2; // offset by 2 init steps
                                            if (chartIdx < next.length) {
                                                next[chartIdx] = { ...next[chartIdx], status: data.status };
                                            }
                                        }
                                        return next;
                                    });
                                    if (data.log) {
                                        setAgentLogs(prev => [...prev, { type: data.status === 'error' ? 'error' : data.status === 'done' ? 'success' : 'info', message: data.log }]);
                                    }
                                } else if (eventName === 'code_chunk') {
                                    setAgentLogs(prev => {
                                        const last = prev[prev.length - 1];
                                        if (last && last.type === 'code') {
                                            const updated = [...prev];
                                            updated[updated.length - 1] = { type: 'code', message: last.message + data.delta };
                                            return updated;
                                        }
                                        return [...prev, { type: 'code', message: data.delta }];
                                    });
                                } else if (eventName === 'chart_done') {
                                    setVisuals(prev => [...prev, {
                                        image: data.image,
                                        chart_type: data.chartType,
                                        code: data.code,
                                        language: data.runtime || settings.runtime
                                    }]);
                                    // Clear code log for next chart
                                    setAgentLogs(prev => [...prev, { type: 'success', message: `✓ ${data.chartType} generated successfully` }]);
                                } else if (eventName === 'chart_error') {
                                    setAgentLogs(prev => [...prev, { type: 'error', message: `✗ ${data.chartType} failed: ${data.error}` }]);
                                } else if (eventName === 'all_done') {
                                    // All charts processed
                                } else if (eventName === 'error') {
                                    throw new Error(data.message);
                                }
                            } catch (e: any) {
                                if (e.message && e.message !== 'Unexpected end of JSON input') {
                                    setError(e.message);
                                }
                            }
                        }
                    }
                }
                setPhase("done");
                loadSessions();
                stopTimer();
            }
        } catch (e: any) {
            stopTimer();
            setError(e.message);
            setPhase("done");
        }
    };

    const handleGenerate = () => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;
        if (!isAgentMode) { handleAgentGenerate(); return; }
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
        setIsAgentMode(true);
        setAgentDataFiles([]);
        setAgentLogs([]);
        setAgentSteps([]);
        setSuggestedCharts([]);
        setSuggestReasoning("");
        setIsAnalyticsSession(false);
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
            // Remove data:image/png;base64, prefix if present
            const cleanBase64 = img.image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
            try {
                const binary = atob(cleanBase64);
                const bytes = new Uint8Array(binary.length);
                for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                const ext = img.language === 'Python' ? 'py' : 'R';
                
                // Align with LaTeX template (images/ folder)
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

    const AGENT_MODES: { id: "data_analytics"; label: string; icon: any }[] = [
        { id: "data_analytics", label: "Data Analytics", icon: IconDatabase },
    ];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
            const text = await file.text();
            if (!isAgentMode) {
                setAgentDataFiles(prev => [...prev, { name: file.name, content: text }]);
            } else {
                setSettings(s => ({ 
                    ...s, 
                    referenceFilesText: [...s.referenceFilesText, text],
                    referenceFileNames: [...s.referenceFileNames, file.name]
                }));
            }
        }
    };

    const removeFile = (idx: number) => {
        if (!isAgentMode) {
            setAgentDataFiles(prev => prev.filter((_, i) => i !== idx));
        } else {
            setSettings(s => ({
                ...s,
                referenceFilesText: s.referenceFilesText.filter((_, i) => i !== idx),
                referenceFileNames: s.referenceFileNames.filter((_, i) => i !== idx)
            }));
        }
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
        const activeMode = !isAgentMode 
            ? AGENT_MODES.find(m => m.id === agentSubMode) || AGENT_MODES[0]
            : MODES.find(m => m.id === docType) || MODES[0];

        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#FBFBFC] relative p-6 overflow-hidden">
                <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-[640px] flex flex-col items-center">
                    
                    {/* Branding */}
                    <div className="mb-10 text-center select-none flex flex-col items-center justify-center">
                        <img src="/Vector.svg" alt="Perricheno" className="w-8 h-8 opacity-20 mb-6" />
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
                                "Monitor 1,000,000 char budgets...",
                                "Build complex 3D surface models...",
                                "Secure end-to-end data generation...",
                                "Analyze multi-layer network graphs...",
                                "Plot density ridges with JoyPy style...",
                                "Create interactive Sankey diagrams...",
                                "Map global data with GeoPandas...",
                                "Visualize K-Means cluster results...",
                                "Design advanced Chord diagrams...",
                                "Plot interactive parallel coordinates...",
                                "Generate precise Nightingale Roses...",
                                "Render high-fidelity violin plots...",
                                "Create detailed Dendrogram charts...",
                                "Track precise token usage per task...",
                                "Monitor 1,000,000 char budgets...",
                                "Secure end-to-end data generation...",
                                "Audit resource consumption live...",
                                "Enforce strict API security layers...",
                                "Manage server resource limits...",
                                "Precisely bill every visual render...",
                                "Execute isolated Python kernels...",
                                "Encrypt sensitive analytical data...",
                                "Scale high-load AI agent pipelines...",
                            ]} />
                        </div>
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
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="w-px h-4 bg-[#e5e5e5] mx-1" />

                                <label className="flex items-center gap-2 cursor-pointer ml-1 mr-2">
                                    <div className="relative rounded-full w-8 h-4 transition-colors duration-300" style={{ backgroundColor: isAgentMode ? "#1a1a1a" : "#e5e5e5" }}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${isAgentMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </div>
                                    <span className="text-[13px] font-medium text-[#666]">Agent</span>
                                    <input type="checkbox" className="hidden" checked={isAgentMode} onChange={(e) => setIsAgentMode(e.target.checked)} />
                                </label>

                                <div className="w-px h-4 bg-[#e5e5e5] mx-1" />

                                <label className="cursor-pointer p-2 text-[#999] hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors">
                                    <IconPaperclip className="w-4 h-4" stroke={2} />
                                    <input type="file" className="hidden" multiple accept=".pdf,.txt" onChange={handleFileUpload} />
                                </label>
                                <button onClick={handleLinkAdd} className="p-2 text-[#999] hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors">
                                    <IconLink className="w-4 h-4" stroke={2} />
                                </button>
                                {/* Settings Dropdown Button */}
                                <div className="relative">
                                    <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-2 rounded-lg transition-colors ${settingsOpen ? 'text-[#1a1a1a] bg-[#f5f5f5]' : 'text-[#999] hover:text-[#1a1a1a] hover:bg-[#f5f5f5]'}`} title="Document Settings">
                                        <IconSettings className="w-4 h-4" stroke={2} />
                                    </button>
                                </div>
                                <button onClick={() => user ? setBillingOpen(true) : setShowLogin(true)} className="p-2 text-[#999] hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors" title="Account & Billing">
                                    <IconUser className="w-4 h-4" stroke={2} />
                                </button>
                            </div>

                            {/* Right: Submit */}
                            <button 
                                onClick={handleGenerate} 
                                disabled={!prompt.trim() || isSuggesting} 
                                className="w-8 h-8 bg-[#1a1a1a] text-white rounded-lg flex items-center justify-center disabled:opacity-10 disabled:bg-[#e5e5e5] transition-all hover:bg-black active:scale-95"
                            >
                                {isSuggesting ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Attached files */}
                    {(!isAgentMode ? agentDataFiles.length > 0 : settings.referenceFileNames.length > 0) && (
                        <div className="w-full mt-3 flex flex-wrap gap-2">
                            {(!isAgentMode ? agentDataFiles : settings.referenceFileNames).map((file, idx) => (
                                <div key={idx} className="flex items-center gap-2 pr-1.5 pl-3 py-1.5 bg-white rounded-lg text-[12px] font-medium text-[#666] border border-[#e5e5e5]">
                                    {!isAgentMode ? <IconDatabase className="w-3.5 h-3.5 text-[#999]" /> : <IconFileText className="w-3.5 h-3.5 text-[#999]" />}
                                    <span>{!isAgentMode ? (file as any).name : file}</span>
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

                    {/* Settings Panel */}
                    <AnimatePresence>
                        {settingsOpen && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="w-full overflow-hidden"
                            >
                                <AgentSettingsPanel
                                    settings={settings}
                                    updateSetting={(k, v) => setSettings(s => ({ ...s, [k]: v }))}
                                    detailsOpen={detailsOpen}
                                    setDetailsOpen={setDetailsOpen}
                                    onOpenBilling={() => {
                                        if (!user) setShowLogin(true);
                                        else { setSettingsOpen(false); setBillingOpen(true); }
                                    }}
                                    isAdmin={user?.isAdmin}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                </motion.div>
            </div>
        );
    }

    // ─── SUGGESTING (Data Analytics - Chart Selection) ───
    if (phase === "suggesting") {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#FBFBFC] relative p-6 overflow-hidden">
                <AgentSidebar sessions={sessions} currentSessionId={currentSessionId} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onSelectSession={handleSelectSession} onDeleteSession={handleDeleteSession} onShareSession={handleShareSession} onNewSession={handleNewSession} />

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-xl flex flex-col items-center">
                    
                    <div className="w-20 h-20 rounded-full bg-white border border-gray-100 shadow-xl flex items-center justify-center mx-auto mb-6">
                        <IconChartPie className="w-10 h-10 text-black" stroke={2} />
                    </div>
                    
                    <h2 className="text-2xl font-black text-black tracking-tight mb-2 text-center">Recommended Charts</h2>
                    <p className="text-xs text-[#A1A1AA] font-bold mb-8 text-center max-w-md">{suggestReasoning}</p>

                    {/* Chart toggles */}
                    <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                        {suggestedCharts.map((chart) => (
                            <motion.button
                                key={chart}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => {
                                    setSuggestedCharts(prev => 
                                        prev.includes(chart) && prev.length > 1
                                            ? prev.filter(c => c !== chart) 
                                            : prev.includes(chart) ? prev : [...prev, chart]
                                    );
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-sm hover:border-black transition-all"
                            >
                                <IconCheck className="w-3.5 h-3.5 text-black" stroke={3} />
                                {chart.replace("_", " ")}
                            </motion.button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => { setPhase("idle"); setSuggestedCharts([]); setIsAnalyticsSession(false); }} 
                            className="px-8 py-3 bg-white text-black border border-gray-100 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:border-black transition-all active:scale-95"
                        >
                            Back
                        </button>
                        <button 
                            onClick={() => startAnalyticsGenerate(suggestedCharts)} 
                            disabled={suggestedCharts.length === 0}
                            className="px-10 py-3.5 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-[#1A1A1A] transition-all shadow-2xl active:scale-95 disabled:opacity-20 flex items-center gap-2"
                        >
                            <IconArrowRight className="w-4 h-4" /> Generate {suggestedCharts.length} Chart{suggestedCharts.length !== 1 ? 's' : ''}
                        </button>
                    </div>
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
                        {/* Main Stream Area */}
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
                        {/* Checklist Sidebar */}
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

                    {/* Actions — conditionally hide LaTeX when in analytics mode */}
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
