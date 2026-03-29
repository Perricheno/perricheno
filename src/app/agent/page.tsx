"use client";

import { useState, useRef, useEffect } from "react";
import {
    IconDownload, IconArrowRight, IconLoader2, IconSparkles,
    IconPaperclip, IconCode, IconFileText, IconBook,
    IconPackage
} from "@tabler/icons-react";
import JSZip from "jszip";

type Message = { id: string; role: "user" | "assistant"; text: string };
type DocType = "research" | "assignment" | "report" | "lab_report" | "literature_review" | "diploma" | "case_study";

export default function AgentPage() {
    const [prompt, setPrompt] = useState("");
    const [docType, setDocType] = useState<DocType>("research");
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [mainTex, setMainTex] = useState<string>("");
    const [referencesBib, setReferencesBib] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"tex" | "bib">("tex");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const suggestions: { label: string; type: DocType }[] = [
        { label: "Research Paper", type: "research" },
        { label: "Assignment", type: "assignment" },
        { label: "Lab Report", type: "lab_report" },
        { label: "Literature Review", type: "literature_review" },
        { label: "Diploma Project", type: "diploma" },
        { label: "Case Study", type: "case_study" },
    ];

    const generateDocument = async (userText: string, type: DocType = docType) => {
        if (!userText.trim()) return;

        setIsGenerating(true);
        setDocType(type);
        if (!hasStarted) {
            setHasStarted(true);
            setMessages([{ id: String(Date.now()), role: "user", text: userText }]);
        } else {
            setMessages(prev => [...prev, { id: String(Date.now()), role: "user", text: userText }]);
        }

        setPrompt("");

        try {
            const res = await fetch('/api/agent/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: userText, type })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to generate");

            setMainTex(data.main_tex);
            setReferencesBib(data.references_bib || null);
            setActiveTab("tex");

            const hasRefs = data.references_bib ? " with references" : "";
            setMessages(prev => [...prev, {
                id: String(Date.now()),
                role: "assistant",
                text: `Your ${type.replace("_", " ")} document${hasRefs} is ready. You can download the files or ask me to make changes.`
            }]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: String(Date.now()),
                role: "assistant",
                text: "Sorry, I encountered an error: " + err.message
            }]);
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isGenerating]);

    const downloadFile = (content: string, filename: string, mime = "text/plain") => {
        const blob = new Blob([content], { type: mime });
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
        if (referencesBib) {
            zip.file("references.bib", referencesBib);
        }
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

    // ─── LANDING STATE ───
    if (!hasStarted) {
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
                                        generateDocument(prompt);
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
                                        <button key={i} onClick={() => { setPrompt(s.label + ": "); }} className="px-3 py-1.5 text-[13px] font-medium text-gray-500 bg-[var(--background)] hover:bg-black/5 border border-[var(--border)] rounded-full transition-colors whitespace-nowrap">
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={() => generateDocument(prompt)}
                                disabled={!prompt.trim() || isGenerating}
                                className="p-3 rounded-full bg-[var(--foreground)] text-[var(--card)] hover:opacity-90 disabled:opacity-30 disabled:hover:opacity-30 transition-all flex items-center justify-center shrink-0 shadow-sm"
                            >
                                {isGenerating ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconArrowRight className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── ACTIVE STATE (SPLIT PANE) ───
    const displayedCode = activeTab === "tex" ? mainTex : (referencesBib || "");
    const displayedFilename = activeTab === "tex" ? "main.tex" : "references.bib";

    return (
        <div className="w-full h-full flex flex-col md:flex-row overflow-hidden font-sans bg-[var(--background)]">

            {/* LEFT PANE - CHAT */}
            <div className="w-full md:w-[35%] lg:w-[30%] h-[50vh] md:h-full bg-[var(--card)] border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-col overflow-hidden">
                <div className="h-16 border-b border-[var(--border)] flex items-center px-6 shrink-0 bg-[var(--card)] z-10 justify-between">
                    <h2 className="font-semibold text-[15px] flex items-center gap-2 text-[var(--foreground)]">
                        <IconBook className="w-5 h-5 text-emerald-500" /> LaTeX Agent
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/40 text-emerald-600 uppercase tracking-wider">
                        {docType.replace("_", " ")}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-[1.25rem] px-5 py-3.5 text-[15px] leading-relaxed ${
                                msg.role === 'user'
                                    ? 'bg-[#f4f4f5] text-[var(--foreground)] rounded-br-sm'
                                    : 'bg-transparent text-[var(--foreground)] px-1'
                            }`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isGenerating && (
                        <div className="flex justify-start">
                            <div className="bg-transparent px-3 py-3 rounded-2xl flex gap-1.5 items-center">
                                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 bg-[var(--card)] mt-auto shrink-0 pb-6">
                    <div className="relative border border-[var(--border)] rounded-[1.25rem] bg-[var(--background)] shadow-sm focus-within:shadow-md transition-shadow">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    generateDocument(prompt);
                                }
                            }}
                            disabled={isGenerating}
                            placeholder="Ask for changes or a new document..."
                            className="w-full bg-transparent p-4 pr-12 outline-none resize-none text-[15px] placeholder:text-gray-400 max-h-32 min-h-[56px] font-medium"
                            rows={1}
                        />
                        <button
                            onClick={() => generateDocument(prompt)}
                            disabled={!prompt.trim() || isGenerating}
                            className="absolute right-3 bottom-3 p-1.5 rounded-full bg-[var(--foreground)] text-[var(--card)] disabled:opacity-30 disabled:bg-gray-200 transition-colors"
                        >
                            <IconArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT PANE - CODE PREVIEW */}
            <div className="flex-1 h-[50vh] md:h-full bg-[var(--background)] flex flex-col overflow-hidden relative p-4 md:p-6 pb-20 md:pb-6">
                <div className="w-full h-full bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] shadow-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500 relative">

                    {/* Toolbar */}
                    <div className="h-14 bg-white border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-3">
                            {/* Tab buttons */}
                            <button
                                onClick={() => setActiveTab("tex")}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                                    activeTab === "tex"
                                        ? "bg-emerald-50 text-emerald-600"
                                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                                <IconFileText className="w-4 h-4" />
                                main.tex
                            </button>
                            {referencesBib && (
                                <button
                                    onClick={() => setActiveTab("bib")}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                                        activeTab === "bib"
                                            ? "bg-blue-50 text-blue-600"
                                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                    }`}
                                >
                                    <IconBook className="w-4 h-4" />
                                    references.bib
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => downloadFile(displayedCode, displayedFilename)}
                                disabled={!mainTex || isGenerating}
                                className="flex items-center gap-2 text-xs font-semibold px-3 py-2 text-gray-500 hover:text-[var(--foreground)] hover:bg-gray-50 disabled:opacity-30 rounded-lg transition-colors"
                            >
                                <IconDownload className="w-4 h-4" />
                                <span className="hidden sm:inline">{displayedFilename}</span>
                            </button>
                            <button
                                onClick={downloadZip}
                                disabled={!mainTex || isGenerating}
                                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-[var(--foreground)] hover:bg-opacity-90 disabled:opacity-30 disabled:bg-gray-300 text-[var(--card)] rounded-full transition-colors shadow-sm"
                            >
                                <IconPackage className="w-4 h-4" />
                                <span className="hidden sm:inline">Download ZIP</span>
                            </button>
                        </div>
                    </div>

                    {/* Code Content */}
                    <div className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed text-gray-700 bg-gray-50/50 relative minimal-scrollbar">
                        {isGenerating && !mainTex ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-10 transition-all">
                                <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white shadow-sm border border-[var(--border)] text-gray-600">
                                    <IconLoader2 className="w-5 h-5 animate-spin text-emerald-500" />
                                    <span className="font-sans font-medium text-[15px]">Synthesizing LaTeX document...</span>
                                </div>
                            </div>
                        ) : null}
                        <pre className="m-0 focus:outline-none w-full min-h-full whitespace-pre-wrap" tabIndex={0}>
                            <code>
                                {displayedCode || "% Your LaTeX document will appear here...\n\\documentclass[twocolumn]{article}\n% Waiting for generation..."}
                            </code>
                        </pre>
                    </div>
                </div>
            </div>

        </div>
    );
}
