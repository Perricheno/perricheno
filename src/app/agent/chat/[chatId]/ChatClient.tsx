"use client";

import { useState, useRef, useEffect } from "react";
import {
    IconArrowRight, IconLoader2, IconPaperclip,
    IconX, IconMenu2, IconFileText, IconTrash,
    IconClock, IconLock, IconRobot, IconCopy,
    IconCheck, IconPlus, IconPlayerStopFilled, IconPhoto,
    IconRefresh, IconPencil
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { AgentSession } from "../../types";
import { AgentBillingModal } from "../../AgentBillingModal";

interface Props {
    initialSession: AgentSession;
    sessions: AgentSession[];
    userId: number;
}

export default function ChatClient({ initialSession, sessions: initialSessions, userId }: Props) {
    const router = useRouter();

    // ── Compact row shape stored in DB (history has refs, not base64). ──
    interface ChatRow {
        role: 'user' | 'assistant';
        content: string;
        files_meta?: { upload_id: string; filename: string; kind: 'pdf' | 'image'; charCount: number; imageCount: number }[];
        created_at: string;
        tokens?: number;
        aborted?: boolean;
    }

    const [messages, setMessages] = useState<ChatRow[]>(() => {
        try {
            const raw = JSON.parse(initialSession.stream_text || '[]');
            return Array.isArray(raw) ? raw as ChatRow[] : [];
        } catch { return []; }
    });
    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState("");

    // Staged attachments before send. uploadId is what the server needs.
    // previewDataUrl is only kept in memory for local thumbnail rendering.
    interface StagedAttachment {
        uploadId: string;
        filename: string;
        kind: 'pdf' | 'image';
        charCount: number;
        imageCount: number;
        pageCount: number;
        ocrUsed: boolean;
        previewDataUrl?: string;
        uploading?: boolean;
    }
    const [attachments, setAttachments] = useState<StagedAttachment[]>([]);

    const [charsBilled, setCharsBilled] = useState(0);
    const [billingOpen, setBillingOpen] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Inline editing of a user-turn. While editing we show a textarea in place
    // of the normal bubble. Saving truncates the conversation at that turn and
    // regenerates from there.
    const [editingIdx, setEditingIdx] = useState<number | null>(null);
    const [editingText, setEditingText] = useState("");

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
    // The landing drops a text-only payload; files must now be re-attached in
    // chat since they go through /api/agent/attach server-side.
    useEffect(() => {
        if (pendingHandled.current) return;
        const pending = sessionStorage.getItem('pendingChatMessage');
        if (!pending) return;
        try {
            const data = JSON.parse(pending);
            if (data.sessionId === currentSessionId && data.message) {
                pendingHandled.current = true;
                sessionStorage.removeItem('pendingChatMessage');
                setTimeout(() => sendMessage(data.message, []), 200);
            }
        } catch {}
    }, [currentSessionId]);

    // ─── File upload — no client-side parsing, everything via /api/agent/attach. ───
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (!fileList) return;

        for (const file of Array.from(fileList)) {
            const ext = file.name.split('.').pop()?.toLowerCase() || '';
            const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
            const isPdf = ext === 'pdf';
            if (!isImage && !isPdf) {
                alert(`Only PDF and images (png/jpeg/webp) are supported. Rejected: ${file.name}`);
                continue;
            }

            // Optimistic pill — shows spinner while the server parses.
            const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            let preview: string | undefined;
            if (isImage) {
                try {
                    preview = await new Promise<string>((resolve, reject) => {
                        const r = new FileReader();
                        r.onload = () => resolve(r.result as string);
                        r.onerror = reject;
                        r.readAsDataURL(file);
                    });
                } catch {}
            }
            setAttachments(prev => [...prev, {
                uploadId: tempId, filename: file.name, kind: isImage ? 'image' : 'pdf',
                charCount: 0, imageCount: 0, pageCount: 0, ocrUsed: false,
                previewDataUrl: preview, uploading: true,
            }]);

            try {
                const fd = new FormData();
                fd.append('file', file, file.name);
                fd.append('filename', file.name);
                const res = await fetch('/api/agent/attach', { method: 'POST', body: fd });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                    const msg = res.status === 413 && err?.error === 'TOTAL_CHAR_CAP'
                        ? `Upload exceeds the 200k-character total cap. Remaining: ${err.remaining?.toLocaleString() ?? 0}.`
                        : (err?.message || err?.error || `Upload failed (${res.status}).`);
                    alert(msg);
                    setAttachments(prev => prev.filter(a => a.uploadId !== tempId));
                    continue;
                }
                const meta = await res.json();
                setAttachments(prev => prev.map(a => a.uploadId === tempId ? {
                    uploadId: meta.uploadId,
                    filename: meta.filename,
                    kind: meta.kind,
                    charCount: meta.charCount,
                    imageCount: meta.imageCount,
                    pageCount: meta.pageCount,
                    ocrUsed: meta.ocrUsed,
                    previewDataUrl: preview,
                    uploading: false,
                } : a));
            } catch (err: any) {
                console.error(`[attach] ${file.name}:`, err);
                alert(err?.message || 'Upload failed.');
                setAttachments(prev => prev.filter(a => a.uploadId !== tempId));
            }
        }
        e.target.value = '';
    };

    const removeAttachment = (uploadId: string) => {
        const target = attachments.find(a => a.uploadId === uploadId);
        if (target && !uploadId.startsWith('tmp_')) {
            fetch(`/api/agent/attach?id=${encodeURIComponent(uploadId)}`, { method: 'DELETE' }).catch(() => {});
        }
        setAttachments(prev => prev.filter(a => a.uploadId !== uploadId));
    };

    // ─── Unified streaming turn ───
    // Used by send / retry / edit — the server decides history truncation from
    // `mode`; the client consumes the SSE stream identically for all three.
    const streamTurn = async (requestBody: Record<string, any>) => {
        setIsStreaming(true);
        setStreamingText('');

        const ac = new AbortController();
        abortRef.current = ac;

        let fullText = '';

        try {
            const res = await fetch('/api/agent/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: ac.signal,
            });

            if (res.status === 402) { setBillingOpen(true); setIsStreaming(false); return; }
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
                throw new Error(err?.error || `HTTP ${res.status}`);
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No stream');

            const decoder = new TextDecoder();
            let buffer = '';
            let aborted = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith(':')) continue;
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const parsed = JSON.parse(line.slice(6).trim());
                        if (parsed.delta) { fullText += parsed.delta; setStreamingText(fullText); }
                        if (parsed.error) throw new Error(parsed.error);
                        if (parsed.done) {
                            aborted = !!parsed.aborted;
                            if (parsed.charsBilled) setCharsBilled(prev => prev + parsed.charsBilled);
                        }
                    } catch (parseErr: any) {
                        if (parseErr?.message) throw parseErr;
                    }
                }
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: fullText,
                created_at: new Date().toISOString(),
                aborted: aborted || undefined,
            }]);
        } catch (err: any) {
            const wasAbort = err?.name === 'AbortError';
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: wasAbort && fullText ? fullText : (wasAbort ? '_(stopped)_' : `⚠️ ${err?.message || err}`),
                created_at: new Date().toISOString(),
                aborted: wasAbort || undefined,
            }]);
        } finally {
            setIsStreaming(false);
            setStreamingText('');
            abortRef.current = null;
        }
    };

    // ─── Send: append a new user turn and stream the assistant reply. ───
    const sendMessage = async (messageText: string, atts: StagedAttachment[] = []) => {
        if (isStreaming) return;
        if (atts.some(a => a.uploading)) {
            alert('Wait for attachments to finish uploading.');
            return;
        }
        if (messageText.length > 100_000) {
            alert('Message is too long (over 100,000 characters). Shorten it or split across turns.');
            return;
        }

        const userRow: ChatRow = {
            role: 'user',
            content: messageText,
            files_meta: atts.length > 0 ? atts.map(a => ({
                upload_id: a.uploadId,
                filename: a.filename,
                kind: a.kind,
                charCount: a.charCount,
                imageCount: a.imageCount,
            })) : undefined,
            created_at: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userRow]);
        setInput('');
        setAttachments([]);

        await streamTurn({
            sessionId: currentSessionId,
            mode: 'send',
            message: messageText,
            uploadIds: atts.map(a => a.uploadId),
        });
    };

    // ─── Retry: drop the last assistant row and regenerate. Reuses whatever
    //    uploads the prior user turn referenced (they may have expired — server
    //    silently skips missing ids). ───
    const retryLast = async () => {
        if (isStreaming) return;
        // Drop trailing assistant rows (usually exactly one).
        setMessages(prev => {
            const copy = [...prev];
            while (copy.length && copy[copy.length - 1].role !== 'user') copy.pop();
            return copy;
        });
        await streamTurn({ sessionId: currentSessionId, mode: 'retry' });
    };

    // ─── Edit: replace a user turn's text, truncate everything from that
    //    turn onward, re-stream. ───
    const startEdit = (idx: number) => {
        const row = messages[idx];
        if (!row || row.role !== 'user') return;
        setEditingIdx(idx);
        setEditingText(row.content);
    };
    const cancelEdit = () => { setEditingIdx(null); setEditingText(''); };
    const saveEdit = async () => {
        if (editingIdx === null) return;
        if (isStreaming) return;
        const newText = editingText.trim();
        if (!newText) { cancelEdit(); return; }
        if (newText.length > 100_000) {
            alert('Message is too long (over 100,000 characters).');
            return;
        }

        const idx = editingIdx;
        cancelEdit();

        // Client-side truncation mirrors the server — replace the turn, drop everything after.
        setMessages(prev => {
            const trimmed = prev.slice(0, idx);
            return [...trimmed, { ...prev[idx], content: newText, created_at: new Date().toISOString() }];
        });

        await streamTurn({
            sessionId: currentSessionId,
            mode: 'edit',
            editIndex: idx,
            message: newText,
            // No new uploads via edit — the prior turn's files_meta stays pinned to the row
            // server-side (we didn't mutate history before this call). If user wants to
            // change attachments, they can delete the message and send a new one.
            uploadIds: [],
        });
    };

    const handleStop = () => { abortRef.current?.abort(); };

    const handleSend = () => {
        if (!input.trim() && attachments.length === 0) return;
        sendMessage(input, attachments);
    };

    // Index of the last user row (used to pick which one gets the Edit button).
    const lastUserIdx = (() => {
        for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return i;
        return -1;
    })();
    // Index of the last assistant row (for Retry button).
    const lastAssistantIdx = (() => {
        for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i;
        return -1;
    })();

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
        <div className="flex h-full w-full bg-[#f9f9fa] relative overflow-hidden">
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

            {/* Main Chat — full-height column, header+input pinned, only messages scroll */}
            <div className="flex-1 flex flex-col min-h-0 w-full relative">
                {/* Header */}
                <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-[var(--border)] bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg transition-colors">
                            <IconMenu2 className="w-5 h-5" />
                        </button>
                        <img src="/Vector.svg" alt="P" className="w-5 h-5 opacity-40 ml-1 md:ml-0" />
                        <div>
                            <h1 className="text-[15px] font-bold text-[#1a1a1a]">Chat</h1>
                            <p className="text-[11px] font-medium text-gray-400">{messages.length} messages{charsBilled > 0 ? ` · ~${(charsBilled / 1000).toFixed(1)}K chars` : ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-xl border border-[var(--border)]">
                        <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-white text-black shadow-sm ring-1 ring-gray-200/50">GPT-5 Mini</span>
                        <span className="px-3 py-1 rounded-lg text-[11px] font-bold text-gray-400 flex items-center gap-1.5 cursor-not-allowed hidden sm:flex">
                            <IconLock className="w-3.5 h-3.5" /> Grok 4.1
                        </span>
                    </div>
                </div>

                {/* Messages — only scrollable region */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-6 space-y-6 w-full max-w-4xl mx-auto">
                    {messages.length === 0 && !isStreaming && (
                        <div className="flex flex-col items-center justify-center h-full text-center select-none pt-10">
                            <img src="/Vector.svg" alt="Perricheno" className="w-8 h-8 opacity-20 mb-4" />
                            <h2 className="text-xl font-black text-[#1a1a1a] tracking-tight mb-2">Start a conversation</h2>
                            <p className="text-sm text-gray-400 max-w-sm">Ask anything. Attach files for context. Get research-grade answers.</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        const textContent = msg.content || '';
                        const isLastAssistant = idx === lastAssistantIdx && msg.role === 'assistant';
                        const isLastUser = idx === lastUserIdx && msg.role === 'user';
                        const isEditing = editingIdx === idx;

                        return (
                        <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[85%] md:max-w-[75%]">
                                {msg.files_meta && msg.files_meta.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                                        {msg.files_meta.map((f, fi) => (
                                            <div key={fi} className="px-3 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-[14px] flex items-center gap-2 shadow-sm max-w-[220px]" title={`${f.kind === 'pdf' ? `${f.charCount.toLocaleString()} chars · ${f.imageCount} images` : 'Image'}`}>
                                                {f.kind === 'image' ? <IconPhoto className="w-4 h-4 text-gray-300 shrink-0" /> : <IconFileText className="w-4 h-4 text-gray-300 shrink-0" />}
                                                <span className="text-[11px] font-bold text-gray-200 truncate">{f.filename}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Inline editor for the target user turn. */}
                                {isEditing ? (
                                    <div className="bg-white border-2 border-black rounded-[20px] p-3 shadow-md">
                                        <textarea
                                            value={editingText}
                                            onChange={e => setEditingText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveEdit(); }
                                                if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                                            }}
                                            className="w-full text-[15px] text-[#1a1a1a] bg-transparent outline-none resize-none leading-relaxed min-h-[60px]"
                                            rows={Math.min(8, Math.max(2, editingText.split('\n').length))}
                                            autoFocus
                                        />
                                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-gray-100">
                                            <button onClick={cancelEdit}
                                                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-black transition-colors">
                                                Cancel
                                            </button>
                                            <button onClick={saveEdit}
                                                disabled={!editingText.trim()}
                                                className="px-4 py-1.5 bg-black text-white text-[11px] font-bold uppercase tracking-widest rounded-lg hover:bg-[#1a1a1a] disabled:opacity-30 transition-all">
                                                Save &amp; regenerate
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`relative group ${
                                        msg.role === 'user'
                                            ? 'bg-black text-white px-5 py-3 rounded-[24px] rounded-br-sm shadow-sm'
                                            : 'bg-transparent text-[#1a1a1a] py-2'
                                    }`}>
                                        {msg.role === 'assistant' ? (
                                            <div className="prose prose-sm max-w-none leading-relaxed prose-headings:font-bold prose-headings:text-[#1a1a1a] prose-p:text-[#1a1a1a] prose-a:text-blue-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-pre:bg-[#1a1a1a] prose-pre:text-gray-200 prose-pre:rounded-xl">
                                                <ReactMarkdown>{textContent || (msg.aborted ? '_(stopped)_' : '')}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{textContent}</p>
                                        )}

                                        {/* Assistant action bar: copy + retry (only on last assistant turn). */}
                                        {msg.role === 'assistant' && textContent && (
                                            <div className="absolute -bottom-7 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => copyMessage(textContent, idx)}
                                                    title="Copy"
                                                    className="p-1.5 bg-white border border-gray-100 rounded-md text-gray-400 hover:text-black shadow-sm transition-colors">
                                                    {copiedIdx === idx ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3" />}
                                                </button>
                                                {isLastAssistant && !isStreaming && (
                                                    <button onClick={retryLast}
                                                        title="Regenerate"
                                                        className="p-1.5 bg-white border border-gray-100 rounded-md text-gray-400 hover:text-black shadow-sm transition-colors">
                                                        <IconRefresh className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Edit button on the last user turn. */}
                                        {isLastUser && !isStreaming && (
                                            <button onClick={() => startEdit(idx)}
                                                title="Edit and regenerate"
                                                className="absolute -bottom-7 right-0 p-1.5 bg-white border border-gray-100 rounded-md text-gray-400 hover:text-black opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                                <IconPencil className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {msg.role === 'assistant' && msg.aborted && !isEditing && (
                                    <p className="text-[10px] font-medium text-amber-500 mt-2 uppercase tracking-widest">stopped</p>
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

                {/* Input — pinned to bottom of main column */}
                <div className="shrink-0 px-4 md:px-8 pt-2 pb-4 md:pb-6 w-full max-w-4xl mx-auto" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                    <div className="bg-white rounded-[24px] border border-[var(--border)] shadow-sm focus-within:border-gray-400 focus-within:shadow-md transition-all flex flex-col pt-2">
                        {/* Attached Files Preview Inside Input */}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-4 pt-2">
                                {attachments.map(a => (
                                    <div key={a.uploadId} className="flex items-center gap-3 px-3 py-2 bg-[#f9f9fa] border border-gray-200 rounded-[14px] max-w-[260px] shadow-sm relative group">
                                        <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shrink-0 border border-gray-200 overflow-hidden">
                                            {a.previewDataUrl ? (
                                                <img src={a.previewDataUrl} alt={a.filename} className="w-full h-full object-cover" />
                                            ) : a.kind === 'image' ? (
                                                <IconPhoto className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <IconFileText className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-[12px] font-bold text-[#1a1a1a] truncate">{a.filename}</span>
                                            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                                                {a.uploading ? 'uploading…'
                                                    : a.kind === 'pdf' ? `${Math.round(a.charCount / 1000)}k${a.imageCount > 0 ? ` · ${a.imageCount}🖼` : ''}${a.ocrUsed ? ' · OCR' : ''}`
                                                    : 'image'}
                                            </span>
                                        </div>
                                        {a.uploading && <IconLoader2 className="w-4 h-4 text-gray-400 animate-spin shrink-0" />}
                                        <button onClick={() => removeAttachment(a.uploadId)}
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
                                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                                        onChange={handleFileUpload} />
                                </label>
                            </div>
                            {isStreaming ? (
                                <button onClick={handleStop}
                                    title="Stop generating"
                                    className="w-10 h-10 bg-[#1a1a1a] text-white rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 mr-1 hover:bg-red-600">
                                    <IconPlayerStopFilled className="w-4 h-4" />
                                </button>
                            ) : (
                                <button onClick={handleSend}
                                    disabled={(!input.trim() && attachments.length === 0) || attachments.some(a => a.uploading)}
                                    className="w-10 h-10 bg-[#1a1a1a] text-white rounded-full flex items-center justify-center disabled:opacity-20 transition-all shadow-md active:scale-95 disabled:active:scale-100 mr-1">
                                    <IconArrowRight className="w-5 h-5 stroke-[2.5]" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <AgentBillingModal isOpen={billingOpen} onClose={() => setBillingOpen(false)} totalSessions={sessions.length} />
        </div>
    );
}
