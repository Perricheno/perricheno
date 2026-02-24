"use client";

import { useState, useRef, useEffect } from "react";
import { IconDownload, IconArrowRight, IconLoader2, IconSparkles, IconPaperclip, IconCode } from "@tabler/icons-react";

type Message = { id: string; role: "user" | "assistant"; text: string };

export default function CanvasPage() {
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [canvasJson, setCanvasJson] = useState<string>("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const suggestions = [
        "Project Architecture", "Database Schema", "User Journey", "System Design", "Mind Map", "E-commerce Flow"
    ];

    const generateCanvas = async (userText: string) => {
        if (!userText.trim()) return;
        
        setIsGenerating(true);
        if (!hasStarted) {
            setHasStarted(true);
            setMessages([{ id: String(Date.now()), role: "user", text: userText }]);
        } else {
            setMessages(prev => [...prev, { id: String(Date.now()), role: "user", text: userText }]);
        }

        setPrompt("");

        try {
            const res = await fetch('/api/canvas/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: userText })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || "Failed to generate");
            
            // Format JSON nicely
            const formattedJson = JSON.stringify(data.canvas, null, 2);
            setCanvasJson(formattedJson);
            
            setMessages(prev => [...prev, { 
                id: String(Date.now()), 
                role: "assistant", 
                text: "Here is your updated Canvas design. You can download it to use in Obsidian or ask me to make modifications." 
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

    const handleDownload = () => {
        if (!canvasJson) return;
        const blob = new Blob([canvasJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `canvas_${Date.now()}.canvas`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    if (!hasStarted) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center font-sans bg-[var(--background)]">
                <div className="w-full max-w-4xl px-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-2 text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 pb-2">
                        Hello, Perricheno
                    </h1>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium text-gray-500 mb-12 text-center">
                        What do you want to build?
                    </h2>

                    <div className="w-full relative shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[calc(var(--radius)+0.5rem)] bg-[var(--card)] border border-[var(--border)] overflow-hidden">
                        <div className="px-6 pt-6 pb-20">
                            <span className="text-sm font-semibold text-gray-400 mb-2 block">Prototype a canvas with AI</span>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        generateCanvas(prompt);
                                    }
                                }}
                                placeholder="An app that creates recipes from photos..."
                                className="w-full h-24 outline-none resize-none bg-transparent text-xl md:text-2xl placeholder:text-gray-300 font-medium"
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
                                        <button key={i} onClick={() => generateCanvas(s)} className="px-3 py-1.5 text-[13px] font-medium text-gray-500 bg-[var(--background)] hover:bg-black/5 border border-[var(--border)] rounded-full transition-colors whitespace-nowrap">
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button 
                                onClick={() => generateCanvas(prompt)}
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

    return (
        <div className="w-full h-full flex flex-col md:flex-row overflow-hidden font-sans bg-[var(--background)]">
            
            {/* LEFT PANE - CHAT */}
            <div className="w-full md:w-[35%] lg:w-[30%] h-[50vh] md:h-full bg-[var(--card)] border-b md:border-b-0 md:border-r border-[var(--border)] flex flex-col overflow-hidden">
                <div className="h-16 border-b border-[var(--border)] flex items-center px-6 shrink-0 bg-[var(--card)] z-10 justify-between">
                    <h2 className="font-semibold text-[15px] flex items-center gap-2 text-[var(--foreground)]">
                        <IconSparkles className="w-5 h-5 text-purple-500" /> Canvas Builder
                    </h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {messages.map((msg, i) => (
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
                                    generateCanvas(prompt);
                                }
                            }}
                            disabled={isGenerating}
                            placeholder="Tell me how to improve this..."
                            className="w-full bg-transparent p-4 pr-12 outline-none resize-none text-[15px] placeholder:text-gray-400 max-h-32 min-h-[56px] font-medium"
                            rows={1}
                        />
                        <button 
                            onClick={() => generateCanvas(prompt)}
                            disabled={!prompt.trim() || isGenerating}
                            className="absolute right-3 bottom-3 p-1.5 rounded-full bg-[var(--foreground)] text-[var(--card)] disabled:opacity-30 disabled:bg-gray-200 transition-colors"
                        >
                            <IconArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT PANE - CODE GENERATION */}
            <div className="flex-1 h-[50vh] md:h-full bg-[var(--background)] flex flex-col overflow-hidden relative p-4 md:p-6 pb-20 md:pb-6">
                <div className="w-full h-full bg-[var(--card)] rounded-[var(--radius)] border border-[var(--border)] shadow-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-500 relative">
                    
                    {/* Toolbar */}
                    <div className="h-14 bg-white border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-1.5 bg-blue-50 text-blue-500 rounded-lg">
                                <IconCode className="w-4 h-4 stroke-[2px]" />
                            </div>
                            <span className="text-[var(--foreground)] font-mono text-[13px] tracking-wide font-semibold">canvas_design.json</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={handleDownload} disabled={!canvasJson || isGenerating} className="flex items-center gap-2 text-xs font-semibold px-4 py-2 bg-[var(--foreground)] hover:bg-opacity-90 disabled:opacity-30 disabled:bg-gray-300 text-[var(--card)] rounded-full transition-colors shadow-sm">
                                <IconDownload className="w-4 h-4" /> Download Canvas
                            </button>
                        </div>
                    </div>
                    
                    {/* Code Content */}
                    <div className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed text-gray-700 bg-gray-50/50 relative minimal-scrollbar">
                        {isGenerating && !canvasJson ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-10 transition-all">
                                <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white shadow-sm border border-[var(--border)] text-gray-600">
                                    <IconLoader2 className="w-5 h-5 animate-spin text-blue-500" />
                                    <span className="font-sans font-medium text-[15px]">Synthesizing JSON design...</span>
                                </div>
                            </div>
                        ) : null}
                        <pre className="m-0 focus:outline-none w-full min-h-full" tabIndex={0}>
                            <code className="language-json">
                                {canvasJson || "{\n  \"nodes\": [],\n  \"edges\": []\n}"}
                            </code>
                        </pre>
                    </div>
                </div>
            </div>

        </div>
    );
}
