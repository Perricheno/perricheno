"use client";

import { useState, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { 
    IconPlayerPlay, IconPlayerStop, IconTerminal2, 
    IconCode, IconSparkles, IconFolder, IconSettings,
    IconHome, IconShare3, IconChevronRight, IconTerminal
} from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAdmin } from "./AdminContext";

export default function CodeLab() {
    const { user } = useAdmin();
    const [code, setCode] = useState("import pandas as pd\nimport numpy as np\n\nprint(\"Code Lab Initialized.\")\nprint(\"Ready for execution.\")");
    const [language, setLanguage] = useState<'python' | 'r'>('python');
    const [output, setOutput] = useState<{ type: 'log' | 'error', text: string }[]>([
        { type: 'log', text: "Welcome to Perricheno Code Lab." },
        { type: 'log', text: "Kernel: Python 3.10. Execution engine connected." }
    ]);
    const [isRunning, setIsRunning] = useState(false);
    const [aiChatOpen, setAiChatOpen] = useState(false);
    
    // Fake run action using the backend proxy
    const handleRun = async () => {
        if (!code.trim() || isRunning) return;
        setIsRunning(true);
        setOutput(prev => [...prev, { type: 'log', text: `\n> Executing script.py...` }]);
        
        try {
            const endpoint = language === 'python' ? '/api/agent/python-compile' : '/api/agent/r-compile';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            const data = await res.json();
            
            if (data.error) {
                setOutput(prev => [...prev, { type: 'error', text: data.error }]);
                if (data.details) {
                    setOutput(prev => [...prev, { type: 'error', text: data.details }]);
                }
            } else if (data.output) {
                setOutput(prev => [...prev, { type: 'log', text: data.output }]);
            } else {
                setOutput(prev => [...prev, { type: 'log', text: "Executed successfully (no output)." }]);
            }
        } catch (error: any) {
            setOutput(prev => [...prev, { type: 'error', text: `Network/Server Error: ${error.message}` }]);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="flex w-full h-full bg-[#1A1A1A] text-[#D3D4CF] font-sans selection:bg-blue-500/30">
            
            {/* ACTIVITY BAR */}
            <div className="w-12 border-r border-[#2A2A2A] bg-[#141414] flex flex-col items-center py-4 space-y-4 shrink-0">
                <Link href="/" className="w-8 h-8 rounded-lg mb-4 hover:bg-[#2A2A2A] transition-colors flex items-center justify-center text-[#999] hover:text-white">
                    <IconHome size={18} stroke={1.5} />
                </Link>
                <button className="w-8 h-8 rounded-lg bg-[#2A2A2A] text-white flex items-center justify-center relative">
                    <IconFolder size={18} stroke={1.5} />
                    <span className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-white rounded-r-md" />
                </button>
                <button className="w-8 h-8 rounded-lg hover:bg-[#2A2A2A] transition-colors flex items-center justify-center text-[#999] hover:text-white">
                    <IconCode size={18} stroke={1.5} />
                </button>
                <button 
                    onClick={() => setAiChatOpen(!aiChatOpen)}
                    className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${aiChatOpen ? "bg-[#2A2A2A] text-white" : "hover:bg-[#2A2A2A] text-[#999] hover:text-white"}`}
                >
                    <IconSparkles size={18} stroke={1.5} />
                </button>
                
                <div className="mt-auto flex flex-col space-y-4">
                    <button className="w-8 h-8 rounded-lg hover:bg-[#2A2A2A] transition-colors flex items-center justify-center text-[#999] hover:text-white">
                        <IconSettings size={18} stroke={1.5} />
                    </button>
                    {user?.photo_url && (
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-[#2A2A2A] opacity-80 hover:opacity-100 cursor-pointer">
                            <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>
            </div>

            {/* SIDEBAR EXPLORER */}
            <div className="w-56 border-r border-[#2A2A2A] bg-[#181818] hidden md:flex flex-col shrink-0">
                <div className="h-10 flex items-center px-4 border-b border-[#2A2A2A]">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-[#999]">Explorer</span>
                </div>
                <div className="p-2">
                    <div className="py-1 px-2 flex items-center gap-2 hover:bg-[#2A2A2A] rounded cursor-pointer group">
                        <IconChevronRight size={14} className="text-[#666] group-hover:text-white transition-colors" />
                        <span className="text-[11px] font-bold">WORKSPACE</span>
                    </div>
                    <div className="pl-6 pt-1 flex flex-col gap-0.5">
                        <div className="py-1 px-2 flex items-center gap-2 bg-[#2A2A2A] text-white rounded cursor-pointer">
                            <IconCode size={14} className="text-blue-400" />
                            <span className="text-[11px]">script.py</span>
                        </div>
                        <div className="py-1 px-2 flex items-center gap-2 hover:bg-[#2A2A2A] text-[#999] rounded cursor-pointer">
                            <IconCode size={14} className="text-purple-400" />
                            <span className="text-[11px]">analysis.R</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN EDITOR AREA */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#1E1E1E]">
                
                {/* Editor Tabs & Toolbar */}
                <div className="h-10 flex items-center justify-between border-b border-[#2A2A2A] bg-[#181818] pr-4">
                    <div className="flex h-full">
                        <div className="flex items-center gap-2 px-4 border-r border-[#2A2A2A] border-t-2 border-t-blue-500 bg-[#1E1E1E] cursor-pointer">
                            <IconCode size={14} className="text-blue-400" />
                            <span className="text-[11px] font-mono">script.py</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <select 
                            value={language}
                            onChange={(e) => setLanguage(e.target.value as any)}
                            className="bg-[#2A2A2A] text-[10px] font-bold text-white border-0 rounded px-2 py-1 outline-none uppercase tracking-widest cursor-pointer"
                        >
                            <option value="python">Python</option>
                            <option value="r">R Core</option>
                        </select>

                        <button 
                            onClick={handleRun}
                            disabled={isRunning}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all
                                ${isRunning ? 'bg-transparent text-[#666] cursor-not-allowed' : 'bg-transparent text-green-400 hover:bg-green-400/10'}
                            `}
                        >
                            {isRunning ? <IconPlayerStop size={12} className="animate-pulse" /> : <IconPlayerPlay size={12} fill="currentColor" />}
                            {isRunning ? 'Running' : 'Run'}
                        </button>
                        
                        <button className="text-[#666] hover:text-white transition-colors">
                            <IconShare3 size={14} />
                        </button>
                    </div>
                </div>

                {/* Code Editor */}
                <div className="flex-1 overflow-auto relative">
                    <CodeMirror
                        value={code}
                        height="100%"
                        theme={oneDark}
                        onChange={(value) => setCode(value)}
                        className="h-full text-[13px] absolute inset-0"
                        basicSetup={{
                            lineNumbers: true,
                            highlightActiveLineGutter: true,
                            foldGutter: true,
                            tabSize: 4,
                        }}
                    />
                </div>

                {/* Integrated Terminal */}
                <div className="h-[30%] border-t border-[#2A2A2A] bg-[#141414] flex flex-col min-h-[150px]">
                    <div className="h-8 flex items-center px-4 border-b border-[#2A2A2A] shrink-0 gap-6">
                        <button className="text-[10px] uppercase font-bold tracking-widest text-white border-b border-white h-full box-border pt-1">Terminal</button>
                        <button className="text-[10px] uppercase font-bold tracking-widest text-[#666] hover:text-[#999] h-full box-border pt-1">Problems (0)</button>
                        
                        <button 
                            className="ml-auto text-[#666] hover:text-white transition-colors mr-2"
                            onClick={() => setOutput([])}
                        >
                            <IconTerminal size={14} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed">
                        {output.length === 0 && <span className="text-[#666]">Terminal is empty.</span>}
                        {output.map((line, i) => (
                            <div key={i} className={`whitespace-pre-wrap ${line.type === 'error' ? 'text-red-400' : 'text-[#D3D4CF]'}`}>
                                {line.text}
                            </div>
                        ))}
                        {isRunning && (
                            <div className="flex items-center gap-2 mt-2">
                                <div className="w-1.5 h-3 bg-blue-400 animate-pulse" />
                                <span className="text-[#666] text-xs">Waiting for kernel...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* AI CHAT SIDEBAR */}
            <AnimatePresence>
                {aiChatOpen && (
                    <motion.div 
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 320, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="border-l border-[#2A2A2A] bg-[#181818] flex flex-col shrink-0 overflow-hidden"
                    >
                        <div className="h-10 flex items-center justify-between px-4 border-b border-[#2A2A2A] shrink-0 w-[320px]">
                            <div className="flex items-center gap-2">
                                <IconSparkles size={14} className="text-purple-400" />
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[#999]">AI Pair Programmer</span>
                            </div>
                        </div>
                        <div className="flex-1 w-[320px] p-4 flex flex-col items-center justify-center text-center">
                            <IconSparkles size={40} className="text-[#333] mb-4" />
                            <h4 className="text-sm font-bold text-white mb-2">Editor Assistant</h4>
                            <p className="text-[11px] text-[#666] px-4">Highlight code in the editor or type a prompt to ask for explanations, refactoring, or bug fixes.</p>
                            <div className="mt-6 border border-[#2A2A2A] rounded-lg p-3 bg-[#1A1A1A] w-full text-left">
                                <div className="flex gap-2">
                                    <div className="w-1.5 h-3 bg-purple-500 mt-1" />
                                    <input 
                                        className="bg-transparent border-none outline-none text-[11px] text-white w-full placeholder:text-[#444]"
                                        placeholder="Ask AI to write code..."
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
