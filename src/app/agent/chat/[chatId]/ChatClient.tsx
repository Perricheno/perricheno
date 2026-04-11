"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip, IconUser,
    IconX, IconMenu2, IconFileText, IconTrash, IconShare,
    IconClock, IconLock, IconWand, IconRobot, IconCopy,
    IconCheck, IconChevronDown
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { AgentSession, ChatMessage } from "../../types";
import { AgentBillingModal } from "../../AgentBillingModal";

interface Props {
    initialSession: AgentSession;
    sessions: AgentSession[];
    userId: number;
}

export default function ChatClient({ initialSession, sessions: initialSessions, userId }: Props) {
    const router = useRouter();

    // State
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try { return JSON.parse(initialSession.stream_text || '[]'); }
        catch { return []; }
    });
    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; type: string }[]>([]);
    const [model, setModel] = useState<'gpt' | 'grok'>('gpt');
    const [tokenCount, setTokenCount] = useState(0);
    const [billingOpen, setBillingOpen] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    // Sidebar
    const [sessions, setSessions] = useState<AgentSession[]>(initialSessions);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const currentSessionId = initialSession.id;

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [input]);

    // Auto-send pending message from landing page
    const pendingHandled = useRef(false);
    useEffect(() => {
        if (pendingHandled.current) return;
        const pending = sessionStorage.getItem('pendingChatMessage');
        if (pending) {
            try {
                const data = JSON.parse(pending);
                if (data.sessionId === currentSessionId && data.message) {
                    pendingHandled.current = true;
                    sessionStorage.removeItem('pendingChatMessage');
                    setInput(data.message);
                    if (data.files) setAttachedFiles(data.files);
                    // Trigger auto-send after state update
                    setTimeout(() => {
                        setInput('');
                        // Directly call the send logic
                        const userMessage: ChatMessage = {
                            role: 'user',
                            content: data.message,
                            files: data.files?.map((f: any) => ({ name: f.name, type: f.type || '' })) || [],
                            created_at: new Date().toISOString()
                        };
                        setMessages(prev => [...prev, userMessage]);
                        setIsStreaming(true);
                        setStreamingText('');

                        fetch('/api/agent/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId: currentSessionId,
                                message: data.message,
                                files: data.files || [],
                                model: 'gpt'
                            })
                        }).then(async res => {
                            if (res.status === 402) { setBillingOpen(true); setIsStreaming(false); return; }
                            if (!res.ok) { setIsStreaming(false); return; }
                            
                            const reader = res.body?.getReader();
                            if (!reader) { setIsStreaming(false); return; }
                            
                            const decoder = new TextDecoder();
                            let fullText = '';
                            let buf = '';
                            
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                buf += decoder.decode(value, { stream: true });
                                const lines = buf.split('\n');
                                buf = lines.pop() || '';
                                for (const line of lines) {
                                    if (!line.startsWith('data: ')) continue;
                                    try {
                                        const parsed = JSON.parse(line.slice(6).trim());
                                        if (parsed.delta) { fullText += parsed.delta; setStreamingText(fullText); }
                                        if (parsed.done) setTokenCount(prev => prev + (parsed.tokens || 0));
                                    } catch {}
                                }
                            }
                            
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: fullText,
                                tokens: fullText.length,
                                created_at: new Date().toISOString()
                            }]);
                            setStreamingText('');
                            setIsStreaming(false);
                        }).catch(() => setIsStreaming(false));
                    }, 100);
                }
            } catch {} 
        }
    }, [currentSessionId]);

    // File upload handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList) return;

        for (const file of Array.from(fileList)) {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const binaryFormats = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx'];
            let text = '';

            if (binaryFormats.includes(ext)) {
                try {
                    const formData = new FormData();
                    formData.append('fileInput', file);

                    if (ext === 'pdf') {
                        const res = await fetch('/api/pdf-proxy?type=pdf-to-text', { method: 'POST', body: formData });
                        if (res.ok) text = await res.text();
                    } else {
                        const convRes = await fetch('/api/pdf-proxy?type=file-to-pdf', { method: 'POST', body: formData });
                        if (convRes.ok) {
                            const pdfBlob = await convRes.blob();
                            const textForm = new FormData();
                            textForm.append('fileInput', pdfBlob, file.name.replace(/\.[^.]+$/, '.pdf'));
                            const textRes = await fetch('/api/pdf-proxy?type=pdf-to-text', { method: 'POST', body: textForm });
                            if (textRes.ok) text = await textRes.text();
                        }
                    }
                } catch (err) {
                    console.error(`File extraction failed for ${file.name}:`, err);
                }
                if (!text || text.trim().length < 10) continue;
            } else if (file.type.startsWith('image/')) {
                // For images, convert to base64 text description placeholder
                text = `[Image file: ${file.name}]`;
            } else {
                text = await file.text();
            }

            setAttachedFiles(prev => [...prev, { name: file.name, content: text, type: ext }]);
        }
        e.target.value = '';
    };

    const removeFile = (idx: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
    };

    // Send message
    const handleSend = async () => {
        if (!input.trim() && attachedFiles.length === 0) return;
        if (isStreaming) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: input,
            files: attachedFiles.map(f => ({ name: f.name, type: f.type })),
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setAttachedFiles([]);
        setIsStreaming(true);
        setStreamingText("");

        try {
            const res = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    message: input,
                    files: attachedFiles,
                    model: model
                })
            });

            if (res.status === 402) {
                setBillingOpen(true);
                setIsStreaming(false);
                return;
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errData.error || 'API error');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No stream");

            const decoder = new TextDecoder();
            let fullText = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const dataStr = line.slice(6).trim();

                    try {
                        const parsed = JSON.parse(dataStr);

                        if (parsed.error) throw new Error(parsed.error);
                        if (parsed.delta) {
                            fullText += parsed.delta;
                            setStreamingText(fullText);
                        }
                        if (parsed.done) {
                            setTokenCount(prev => prev + (parsed.tokens || 0));
                        }
                    } catch {}
                }
            }

            // Add assistant message
            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: fullText,
                tokens: fullText.length,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, assistantMessage]);
            setStreamingText("");

        } catch (err: any) {
            console.error('Chat error:', err);
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: `⚠️ Error: ${err.message}`,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsStreaming(false);
        }
    };

    const copyMessage = (text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    // Sidebar handlers
    const handleSelectSession = (s: AgentSession) => {
        setSidebarOpen(false);
        if (s.doc_type === 'chat') {
            router.push(`/agent/chat/${s.id}`);
        } else {
            router.push(`/agent/${s.id}`);
        }
    };

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Delete this chat?")) return;
        await fetch(`/api/agent/sessions/${id}`, { method: 'DELETE' });
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) router.push('/agent');
    };

    const handleNewChat = async () => {
        const res = await fetch('/api/agent/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (res.ok) {
            const data = await res.json();
            router.push(`/agent/chat/${data.sessionId}`);
        }
    };

    return (
        <div className="flex h-full w-full bg-[#FBFBFC]">
            {/* Sidebar toggle */}
            {!sidebarOpen && (
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="fixed top-4 left-4 z-40 p-2 bg-white border border-gray-200 rounded-xl text-gray-500 hover:text-black shadow-sm transition-all hover:shadow-md"
                >
                    <IconMenu2 className="w-5 h-5" />
                </button>
            )}

            {/* Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ x: -288 }}
                        animate={{ x: 0 }}
                        exit={{ x: -288 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 flex flex-col shadow-2xl"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">History</h2>
                            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-black">
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3">
                            <button
                                onClick={handleNewChat}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#222] transition-all"
                            >
                                + New Chat
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {sessions.filter(s => s.doc_type === 'chat').map(s => {
                                const isActive = s.id === currentSessionId;
                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => handleSelectSession(s)}
                                        className={`group p-3 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-black text-white border-transparent' : 'bg-transparent border-transparent hover:bg-gray-50'}`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <IconRobot className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'opacity-80' : 'text-gray-400'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-black'}`}>
                                                    {s.title}
                                                </p>
                                                <div className={`flex items-center gap-2 text-[11px] mt-1 ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                                                    <IconClock className="w-3 h-3" />
                                                    {new Date(s.updated_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => handleDeleteSession(s.id, e)} 
                                                className={`p-1 rounded-md transition-all ${isActive ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50'}`}
                                            >
                                                <IconTrash className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Back to agent link */}
                        <div className="p-3 border-t border-gray-100">
                            <button
                                onClick={() => router.push('/agent')}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-50 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-100 hover:text-black transition-all"
                            >
                                ← Back to Agent
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full max-w-3xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                            <IconRobot className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-black text-black">Perricheno Chat</h1>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                {model === 'gpt' ? 'GPT-5 Mini' : 'Grok 4.1'} · {messages.length} messages
                            </p>
                        </div>
                    </div>

                    {/* Model selector */}
                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-50 p-0.5 rounded-lg border border-gray-100">
                            <button
                                onClick={() => setModel('gpt')}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${model === 'gpt' ? 'bg-white text-black shadow-sm' : 'text-gray-400'}`}
                            >
                                GPT-5 Mini
                            </button>
                            <button
                                disabled
                                className="px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest text-gray-300 cursor-not-allowed flex items-center gap-1"
                            >
                                <IconLock className="w-3 h-3" />
                                Grok 4.1
                            </button>
                        </div>

                        {tokenCount > 0 && (
                            <div className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                ~{(tokenCount / 1000).toFixed(1)}K chars
                            </div>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {messages.length === 0 && !isStreaming && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className="w-16 h-16 bg-white border border-gray-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                <IconRobot className="w-8 h-8 text-gray-300" />
                            </div>
                            <h2 className="text-xl font-black text-black mb-2">Start a conversation</h2>
                            <p className="text-sm text-gray-400 max-w-sm">
                                Ask anything. Attach files for context. Get structured, research-grade answers.
                            </p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center shrink-0 mt-1">
                                    <IconRobot className="w-3.5 h-3.5 text-white" />
                                </div>
                            )}

                            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                                {/* File indicators */}
                                {msg.files && msg.files.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1.5">
                                        {msg.files.map((f, fi) => (
                                            <span key={fi} className="px-2 py-0.5 bg-gray-100 rounded text-[9px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                <IconFileText className="w-3 h-3" />
                                                {f.name}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className={`relative group rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                                    msg.role === 'user'
                                        ? 'bg-black text-white rounded-br-sm'
                                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                                }`}>
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm max-w-none prose-headings:font-black prose-headings:text-black prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-pre:bg-[#1a1a1a] prose-pre:text-gray-200 prose-pre:rounded-xl prose-pre:border prose-pre:border-gray-800">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    )}

                                    {msg.role === 'assistant' && (
                                        <button
                                            onClick={() => copyMessage(msg.content, idx)}
                                            className="absolute -bottom-3 right-2 p-1 bg-white border border-gray-100 rounded-md text-gray-400 hover:text-black opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                        >
                                            {copiedIdx === idx ? <IconCheck className="w-3 h-3 text-green-500" /> : <IconCopy className="w-3 h-3" />}
                                        </button>
                                    )}
                                </div>

                                {msg.tokens && msg.role === 'assistant' && (
                                    <p className="text-[9px] text-gray-300 font-bold mt-1 ml-1 uppercase tracking-widest">
                                        ~{msg.tokens.toLocaleString()} chars
                                    </p>
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center shrink-0 mt-1">
                                    <IconUser className="w-3.5 h-3.5 text-gray-600" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Streaming indicator */}
                    {isStreaming && (
                        <div className="flex gap-3">
                            <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center shrink-0 mt-1">
                                <IconRobot className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="max-w-[85%] bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                                {streamingText ? (
                                    <div className="prose prose-sm max-w-none prose-headings:font-black prose-headings:text-black prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-pre:bg-[#1a1a1a] prose-pre:text-gray-200 prose-pre:rounded-xl">
                                        <ReactMarkdown>{streamingText}</ReactMarkdown>
                                        <span className="inline-block w-2 h-4 bg-black animate-pulse ml-0.5" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        {[0, 1, 2, 3, 4].map(i => (
                                            <div
                                                key={i}
                                                className="w-1.5 h-1.5 bg-black rounded-full animate-bounce"
                                                style={{ animationDelay: `${i * 0.12}s`, animationDuration: '0.8s' }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="shrink-0 px-6 pb-6 pt-2">
                    {/* Attached files */}
                    {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {attachedFiles.map((f, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600">
                                    <IconFileText className="w-3.5 h-3.5 text-gray-400" />
                                    {f.name}
                                    <button onClick={() => removeFile(idx)} className="hover:text-red-500 transition-colors">
                                        <IconX className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-end gap-3">
                        <div className="flex-1 bg-white rounded-2xl border border-gray-200 focus-within:border-gray-400 focus-within:shadow-md transition-all">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Type a message..."
                                className="w-full text-[14px] text-black bg-transparent outline-none placeholder:text-gray-300 resize-none px-4 py-3 max-h-[200px] leading-relaxed"
                                rows={1}
                                disabled={isStreaming}
                            />

                            <div className="flex items-center justify-between px-3 pb-2">
                                <div className="flex items-center gap-1">
                                    <label className="cursor-pointer p-1.5 text-gray-400 hover:text-black rounded-lg hover:bg-gray-50 transition-all">
                                        <IconPaperclip className="w-4 h-4" />
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            multiple
                                            accept=".pdf,.txt,.csv,.xlsx,.xls,.docx,.doc,.json,.tsv,.md,.xml,.pptx,.png,.jpg,.jpeg,.webp"
                                            onChange={handleFileUpload}
                                        />
                                    </label>
                                </div>

                                <button
                                    onClick={handleSend}
                                    disabled={isStreaming || (!input.trim() && attachedFiles.length === 0)}
                                    className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center disabled:opacity-10 transition-all hover:bg-[#222] active:scale-90"
                                >
                                    {isStreaming ? (
                                        <IconLoader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <IconArrowRight className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AgentBillingModal
                isOpen={billingOpen}
                onClose={() => setBillingOpen(false)}
                totalSessions={sessions.length}
            />
        </div>
    );
}
