"use client";

import { useState, useRef, useEffect } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip, IconUser,
    IconX, IconMenu2, IconFileText, IconTrash,
    IconClock, IconLock, IconRobot, IconCopy,
    IconCheck, IconPlus, IconBolt
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

    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try { return JSON.parse(initialSession.stream_text || '[]'); }
        catch { return []; }
    });
    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState("");
    const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; type: string }[]>([]);
    const [model] = useState<'gpt'>('gpt');
    const [tokenCount, setTokenCount] = useState(0);
    const [billingOpen, setBillingOpen] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    const [sessions, setSessions] = useState<AgentSession[]>(initialSessions);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const currentSessionId = initialSession.id;

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pendingHandled = useRef(false);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [input]);

    // ─── Auto-send pending message from landing page ───
    useEffect(() => {
        if (pendingHandled.current) return;
        const pending = sessionStorage.getItem('pendingChatMessage');
        if (!pending) return;
        try {
            const data = JSON.parse(pending);
            if (data.sessionId === currentSessionId && data.message) {
                pendingHandled.current = true;
                sessionStorage.removeItem('pendingChatMessage');
                setTimeout(() => sendMessage(data.message, data.files || []), 200);
            }
        } catch {}
    }, [currentSessionId]);

    // ─── File upload ───
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList) return;
        for (const file of Array.from(fileList)) {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const binaryFormats = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx'];
            let text = '';
            
            // For images, we can convert to base64 so they can be processed by vision models later
            if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
                try {
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve) => {
                        reader.onload = (e) => resolve(e.target?.result as string);
                    });
                    reader.readAsDataURL(file);
                    text = await base64Promise;
                } catch (err) {
                    console.error("Image read failed", err);
                }
            } else if (binaryFormats.includes(ext)) {
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
                            const tf = new FormData();
                            tf.append('fileInput', pdfBlob, file.name.replace(/\.[^.]+$/, '.pdf'));
                            const textRes = await fetch('/api/pdf-proxy?type=pdf-to-text', { method: 'POST', body: tf });
                            if (textRes.ok) text = await textRes.text();
                        }
                    }
                } catch (err) { console.error(`File extraction failed: ${file.name}`, err); }
            } else {
                try {
                    text = await file.text();
                } catch (err) { console.error("Text read failed", err); }
            }

            // Always add to UI so user sees it, even if empty/binary
            setAttachedFiles(prev => [...prev, { name: file.name, content: text || "binary_file_or_empty", type: ext }]);
        }
        e.target.value = '';
    };

    // ─── Core send ───
    const sendMessage = async (messageText: string, files: any[] = []) => {
        if (isStreaming) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: messageText,
            files: files.map((f: any) => ({ name: f.name, type: f.type || '', content: f.content })),
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
                body: JSON.stringify({ sessionId: currentSessionId, message: messageText, files, model })
            });

            if (res.status === 402) { setBillingOpen(true); setIsStreaming(false); return; }
            if (!res.ok) { throw new Error("API error"); }

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
                    try {
                        const parsed = JSON.parse(line.slice(6).trim());
                        if (parsed.delta) { fullText += parsed.delta; setStreamingText(fullText); }
                        if (parsed.done) setTokenCount(prev => prev + (parsed.tokens || 0));
                    } catch {}
                }
            }

            setMessages(prev => [...prev, {
                role: 'assistant', content: fullText,
                tokens: fullText.length, created_at: new Date().toISOString()
            }]);
            setStreamingText("");
        } catch (err: any) {
            setMessages(prev => [...prev, {
                role: 'assistant', content: `⚠️ ${err.message}`, created_at: new Date().toISOString()
            }]);
        } finally {
            setIsStreaming(false);
        }
    };

    const handleSend = () => {
        if (!input.trim() && attachedFiles.length === 0) return;
        sendMessage(input, attachedFiles);
    };

    const copyMessage = (text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    const handleSelectSession = (s: AgentSession) => {
        setSidebarOpen(false);
        if (s.doc_type === 'chat') {
            router.push(`/agent/chat/${s.id}`);
        } else if (s.doc_type === 'literature_search') {
            router.push(`/agent/scholar/${s.id}`);
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
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
        });
        if (res.ok) { const data = await res.json(); router.push(`/agent/chat/${data.sessionId}`); }
    };

    return (
        <div className="flex h-full w-full bg-[#f9f9fa] relative overflow-hidden [&::-webkit-scrollbar]:hidden">
            {/* Sidebar Toggle is now in the header only */}

            {/* Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }} transition={{ duration: 0.2 }}
                        className="absolute inset-y-0 left-0 z-50 w-72 bg-[var(--card)] border-r border-[var(--border)] flex flex-col shadow-xl">
                        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                            <h2 className="font-semibold text-[15px]">Chat History</h2>
                            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-[var(--foreground)]">
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4">
                            <button onClick={handleNewChat}
                                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm font-semibold hover:border-[var(--foreground)] transition-colors">
                                <IconPlus className="w-4 h-4" /> New Chat
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {sessions.filter(s => s.doc_type === 'chat').length === 0 ? (
                                <div className="p-4 text-center text-xs text-gray-400">No chats yet.</div>
                            ) : sessions.filter(s => s.doc_type === 'chat').map(s => {
                                const isActive = s.id === currentSessionId;
                                return (
                                    <div key={s.id} onClick={() => handleSelectSession(s)}
                                        className={`group p-3 rounded-xl cursor-pointer transition-colors border ${isActive ? 'bg-[var(--foreground)] text-[var(--card)] border-transparent' : 'bg-transparent border-transparent hover:bg-black/5'}`}>
                                        <div className="flex items-start gap-2">
                                            <IconRobot className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'opacity-80' : 'text-gray-400'}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${isActive ? 'text-[var(--card)]' : 'text-[var(--foreground)]'}`}>
                                                    {s.title}
                                                </p>
                                                <div className={`flex items-center gap-2 text-[11px] mt-1 ${isActive ? 'text-[var(--card)] opacity-70' : 'text-gray-400'}`}>
                                                    <IconClock className="w-3 h-3" />
                                                    {new Date(s.updated_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <button onClick={(e) => handleDeleteSession(s.id, e)}
                                                className={`p-1.5 rounded-md ${isActive ? 'text-[var(--card)] hover:bg-white/10' : 'text-gray-500 opacity-40 hover:opacity-100 hover:text-red-500 hover:bg-red-500/10'}`}>
                                                <IconTrash className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-3 border-t border-[var(--border)]">
                            <button onClick={() => router.push('/agent')}
                                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--background)] text-gray-500 rounded-lg text-xs font-semibold hover:text-[var(--foreground)] transition-colors">
                                ← Back to Agent
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Chat */}
            <div className="flex-1 flex flex-col h-full max-w-5xl mx-auto w-full relative">
                {/* Header */}
                <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-[var(--border)] bg-white shrink-0 sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors">
                            <IconMenu2 className="w-5 h-5" />
                        </button>
                        <img src="/Vector.svg" alt="P" className="w-5 h-5 opacity-40 ml-1 md:ml-0" />
                        <div>
                            <h1 className="text-[15px] font-bold text-[#1a1a1a]">Chat</h1>
                            <p className="text-[11px] font-medium text-gray-400">{messages.length} messages{tokenCount > 0 ? ` · ~${(tokenCount/1000).toFixed(1)}K chars` : ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-xl border border-[var(--border)]">
                        <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-white text-black shadow-sm ring-1 ring-gray-200/50">GPT-5 Mini</span>
                        <span className="px-3 py-1 rounded-lg text-[11px] font-bold text-gray-400 flex items-center gap-1.5 cursor-not-allowed hidden sm:flex">
                            <IconLock className="w-3.5 h-3.5" /> Grok 4.1
                        </span>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {messages.length === 0 && !isStreaming && (
                        <div className="flex flex-col items-center justify-center h-full text-center select-none pt-10">
                            <img src="/Vector.svg" alt="Perricheno" className="w-8 h-8 opacity-20 mb-4" />
                            <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight mb-2">Start a conversation</h2>
                            <p className="text-sm text-gray-400 max-w-sm">Ask anything. Attach files for context. Get research-grade answers.</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        const isMsgArray = Array.isArray(msg.content);
                        const textContent = isMsgArray ? (msg.content as any[]).find((i: any) => i.type === 'text')?.text || '' : msg.content;
                        const imageContent = isMsgArray ? (msg.content as any[]).filter((i: any) => i.type === 'image_url') : [];

                        return (
                        <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? '' : ''}`}>
                                {msg.files && msg.files.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                                        {msg.files.map((f: any, fi: number) => (
                                            <div key={fi} className="px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-[14px] flex items-center gap-2 shadow-sm max-w-[200px]">
                                                {f.content && f.content.startsWith('data:image/') ? (
                                                     <img src={f.content} alt={f.name} className="w-8 h-8 object-cover rounded-md" />
                                                ) : (
                                                     <IconFileText className="w-5 h-5 text-gray-300" />
                                                )}
                                                <span className="text-[11px] font-bold text-gray-200 truncate">{f.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className={`relative group ${
                                    msg.role === 'user'
                                        ? 'bg-black text-white px-5 py-3 rounded-[24px] rounded-br-sm shadow-sm'
                                        : 'bg-transparent text-[#1a1a1a] py-2'
                                }`}>
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm max-w-none leading-relaxed prose-headings:font-bold prose-headings:text-[#1a1a1a] prose-p:text-[#1a1a1a] prose-a:text-blue-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-pre:bg-[#1a1a1a] prose-pre:text-gray-200 prose-pre:rounded-xl">
                                            <ReactMarkdown>{textContent}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{textContent}</p>
                                            {imageContent.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {imageContent.map((img: any, iidx: number) => (
                                                        <img key={iidx} src={img.image_url.url} alt="attached" className="max-w-[200px] max-h-[200px] object-cover rounded-xl border border-white/20" />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {msg.role === 'assistant' && (
                                        <button onClick={() => copyMessage(textContent, idx)}
                                            className="absolute -bottom-6 left-0 p-1.5 bg-white border border-gray-100 rounded-md text-gray-400 hover:text-black opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                            {copiedIdx === idx ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3" />}
                                        </button>
                                    )}
                                </div>

                                {msg.tokens && msg.role === 'assistant' && (
                                    <p className="text-[10px] font-medium text-gray-300 mt-2">~{msg.tokens.toLocaleString()} chars</p>
                                )}
                            </div>
                        </div>
                    )})}

                    {/* Streaming */}
                    {isStreaming && (
                        <div className="flex w-full justify-start">
                            <div className="max-w-[85%] md:max-w-[75%] py-2 text-[#1a1a1a]">
                                {streamingText ? (
                                    <div className="prose prose-sm max-w-none leading-relaxed prose-headings:font-bold prose-headings:text-[#1a1a1a] prose-p:text-[#1a1a1a] prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-pre:bg-[#1a1a1a] prose-pre:text-gray-200 prose-pre:rounded-xl">
                                        <ReactMarkdown>{streamingText}</ReactMarkdown>
                                        <span className="inline-block w-1.5 h-4 bg-black animate-pulse ml-0.5" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 pt-2">
                                        {[0,1,2].map(i => (
                                            <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input */}
                <div className="shrink-0 p-4 pb-28 md:px-8 md:pb-8 md:pt-2">
                    <div className="bg-white rounded-[24px] border border-[var(--border)] shadow-sm focus-within:border-gray-400 focus-within:shadow-md transition-all flex flex-col pt-2">
                        {/* Attached Files Preview Inside Input */}
                        {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-4 pt-2">
                                {attachedFiles.map((f, idx) => (
                                    <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-[#f9f9fa] border border-gray-200 rounded-[14px] max-w-[220px] shadow-sm relative group">
                                        <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shrink-0 border border-gray-200 overflow-hidden">
                                            {f.type.match(/^(jpg|jpeg|png|webp)$/i) ? (
                                                <img src={f.content} alt={f.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <IconFileText className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-[12px] font-bold text-[#1a1a1a] truncate">{f.name}</span>
                                            <span className="text-[10px] font-medium text-gray-500 uppercase">{f.type || 'FILE'}</span>
                                        </div>
                                        <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} 
                                            className="absolute -top-1.5 -right-1.5 bg-white text-gray-400 hover:text-red-500 rounded-full border border-gray-200 p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            <IconX className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex px-5 pt-3 pb-2">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder="Спроси Perricheno"
                                className="w-full text-[15px] font-medium text-[#1a1a1a] bg-transparent outline-none placeholder:text-gray-400 resize-none max-h-[150px] leading-relaxed"
                                rows={1}
                                disabled={isStreaming}
                                autoFocus
                            />
                        </div>
                        
                        <div className="flex items-center justify-between px-3 pb-3">
                            <div className="flex items-center gap-1">
                                <label className="cursor-pointer p-2 text-gray-400 hover:text-[#1a1a1a] rounded-xl hover:bg-gray-50 transition-colors">
                                    <IconPaperclip className="w-[22px] h-[22px]" />
                                    <input type="file" className="hidden" multiple
                                        accept=".pdf,.txt,.csv,.xlsx,.xls,.docx,.doc,.json,.tsv,.md,.xml,.pptx,.png,.jpg,.jpeg,.webp"
                                        onChange={handleFileUpload} />
                                </label>
                                <button className="p-2 text-gray-400 hover:text-[#1a1a1a] rounded-xl hover:bg-gray-50 transition-colors">
                                    <IconBolt className="w-5 h-5" />
                                </button>
                            </div>
                            <button onClick={handleSend}
                                disabled={isStreaming || (!input.trim() && attachedFiles.length === 0)}
                                className="w-10 h-10 bg-[#1a1a1a] text-white rounded-full flex items-center justify-center disabled:opacity-20 transition-all shadow-md active:scale-95 disabled:active:scale-100 mr-1">
                                {isStreaming ? <IconLoader2 className="w-5 h-5 animate-spin" /> : <IconArrowRight className="w-5 h-5 stroke-[2.5]" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <AgentBillingModal isOpen={billingOpen} onClose={() => setBillingOpen(false)} totalSessions={sessions.length} />
        </div>
    );
}
