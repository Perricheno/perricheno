"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconSend, IconPaperclip, IconMicrophone, IconPlayerStop,
    IconPhoto, IconFile, IconX, IconChevronDown,
    IconSettings, IconPlus, IconMessage, IconTrash, IconUser,
    IconLogin, IconSun, IconMoon
} from "@tabler/icons-react";
import ChatSettingsModal from "@/components/ChatSettingsModal";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { getSettings, saveSettings, type ChatSettings } from "@/app/actions";
import { useTheme } from "next-themes";
import MinimalSidebar from "@/components/MinimalSidebar";

/* ── Types ── */
interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    text: string;
    files?: { name: string; type: string; url: string }[];
    audioUrl?: string;
    timestamp: Date;
}

interface ChatThread {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: Date;
}

interface UserAccount {
    id: string;
    name: string;
    email: string;
}

/* ── UUID generator ── */
function genId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxx-xxxx-4xxx-yxxx-xxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}

export default function ChatPage() {
    /* ── State ── */
    const [initialChatId] = useState(() => genId());
    const [threads, setThreads] = useState<ChatThread[]>([
        { id: initialChatId, title: "New Chat", messages: [], createdAt: new Date() },
    ]);
    const [activeThreadId, setActiveThreadId] = useState(initialChatId);
    const [input, setInput] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [settings, setSettings] = useState<ChatSettings | null>(null);
    const [modelOpen, setModelOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [account, setAccount] = useState<UserAccount | null>(null);

    // Admin
    const { user, isEditing, setIsEditing, showLogin, setShowLogin } = useAdmin();
    const { theme, setTheme } = useTheme();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const activeThread = threads.find(t => t.id === activeThreadId)!;
    const messages = activeThread?.messages || [];

    // Fetch settings + load account from localStorage
    useEffect(() => {
        getSettings().then(setSettings);
        const saved = localStorage.getItem("chat_account");
        if (saved) {
            const parsed = JSON.parse(saved);
            if (!parsed.id) parsed.id = genId();
            setAccount(parsed);
        }
    }, []);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleLogout = () => {
        setAccount(null);
        localStorage.removeItem("chat_account");
    };

    /* ── Thread management ── */
    const createThread = () => {
        const id = genId();
        setThreads(prev => [{ id, title: "New Chat", messages: [], createdAt: new Date() }, ...prev]);
        setActiveThreadId(id);
    };

    const deleteThread = (id: string) => {
        setThreads(prev => {
            const updated = prev.filter(t => t.id !== id);
            if (updated.length === 0) {
                const newId = genId();
                setActiveThreadId(newId);
                return [{ id: newId, title: "New Chat", messages: [], createdAt: new Date() }];
            }
            if (activeThreadId === id) setActiveThreadId(updated[0].id);
            return updated;
        });
    };

    const updateThreadMessages = (threadId: string, newMessages: ChatMessage[]) => {
        setThreads(prev => prev.map(t => {
            if (t.id !== threadId) return t;
            const title = t.messages.length === 0 && newMessages.length > 0
                ? (newMessages[0].text.slice(0, 28) || "Voice / File") + (newMessages[0].text.length > 28 ? "…" : "")
                : t.title;
            return { ...t, messages: newMessages, title };
        }));
    };

    /* ── Model ── */
    const changeModel = async (model: string) => {
        if (!settings) return;
        const updated = { ...settings, selectedModel: model };
        setSettings(updated);
        setModelOpen(false);
        await saveSettings(updated);
    };

    /* ── Send message ── */
    const sendMessage = useCallback(async (audioBlob?: Blob) => {
        const hasContent = input.trim() || files.length > 0 || audioBlob;
        if (!hasContent || isLoading || !settings) return;

        if (!user) {
            setShowLogin(true);
            return;
        }

        const userMsg: ChatMessage = {
            id: String(Date.now()),
            role: "user",
            text: input.trim(),
            files: files.map(f => ({ name: f.name, type: f.type, url: URL.createObjectURL(f) })),
            audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : undefined,
            timestamp: new Date(),
        };

        const updatedMessages = [...messages, userMsg];
        updateThreadMessages(activeThreadId, updatedMessages);
        const msgText = input.trim();
        setInput("");
        setFiles([]);
        setIsLoading(true);

        try {
            const webhookUrl = settings.useTestWebhook ? settings.webhookTest : settings.webhookProd;
            const formData = new FormData();
            formData.append("webhookUrl", webhookUrl);
            formData.append("chatId", activeThreadId);
            formData.append("timestamp", new Date().toISOString());
            formData.append("message", msgText);
            formData.append("userId", user.telegram_id);
            formData.append("userName", user.first_name || "User");
            formData.append("userEmail", user.username || "");
            formData.append("model", settings.selectedModel);
            formData.append("temperature", String(settings.temperature));
            formData.append("maxTokens", String(settings.maxTokens));
            formData.append("systemPrompt", settings.systemPrompt);
            formData.append("webhookMode", settings.useTestWebhook ? "test" : "production");
            files.forEach((file, i) => formData.append(`file_${i}`, file, file.name));
            if (audioBlob) formData.append("audio", audioBlob, "voice_message.webm");

            const response = await fetch("/api/webhook-proxy", { method: "POST", body: formData });
            const raw = await response.text();
            let responseText = "";
            try {
                const data = JSON.parse(raw);
                responseText = typeof data === "string" ? data : (data.message || data.text || data.response || data.output || JSON.stringify(data));
            } catch {
                responseText = raw || "Response received";
            }
            updateThreadMessages(activeThreadId, [...updatedMessages, { id: String(Date.now()), role: "assistant", text: responseText, timestamp: new Date() }]);
        } catch (err: unknown) {
            const detail = err instanceof Error ? err.message : "Unknown error";
            updateThreadMessages(activeThreadId, [...updatedMessages, { id: String(Date.now()), role: "assistant", text: `⚠️ ${detail}`, timestamp: new Date() }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, files, isLoading, settings, messages, activeThreadId, user]);

    /* ── File / Audio ── */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    };
    const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream);
            mediaRecorderRef.current = mr;
            audioChunksRef.current = [];
            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                stream.getTracks().forEach(t => t.stop());
                sendMessage(blob);
            };
            mr.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
        } catch { alert("Microphone access denied"); }
    };
    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const fileIcon = (t: string) => t.startsWith('image/') ? <IconPhoto className="w-3.5 h-3.5" /> : <IconFile className="w-3.5 h-3.5" />;

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pl-16 md:pl-64 flex overflow-hidden">
            {/* Admin login modal */}
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
            <ChatSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSettingsChanged={setSettings} />

            <MinimalSidebar />

            {/* ══ CHAT SIDEBAR (History) ══ */}
            <aside className="w-64 border-r border-[var(--border)] bg-[var(--background)] flex flex-col hidden md:flex">
                <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                    <h2 className="font-bold text-sm">Chats</h2>
                    <button onClick={createThread} className="text-[var(--foreground)] opacity-50 hover:opacity-100 transition-opacity">
                        <IconPlus className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {threads.map(t => (
                        <div key={t.id}
                            className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${t.id === activeThreadId ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--foreground)] hover:bg-[var(--muted)]"}`}
                            onClick={() => setActiveThreadId(t.id)}>
                            <IconMessage className="w-4 h-4 shrink-0 opacity-50" />
                            <span className="flex-1 truncate">{t.title}</span>
                            {threads.length > 1 && (
                                <button onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }} className="opacity-0 group-hover:opacity-100 hover:text-red-500">
                                    <IconTrash className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                {/* Account / User Area */}
                <div className="p-4 border-t border-[var(--border)]">
                    {user ? (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--border)] overflow-hidden">
                                {user.photo_url ? <img src={user.photo_url} alt="User" /> : <IconUser className="p-1" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{user.first_name}</p>
                            </div>
                            <button onClick={() => { if (isEditing) setIsEditing(false); else setShowLogin(true); }}>
                                <IconSettings className="w-4 h-4 opacity-50 hover:opacity-100" />
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => setShowLogin(true)} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium text-sm">
                            <IconLogin className="w-4 h-4" /> Sign In
                        </button>
                    )}
                </div>
            </aside>

            {/* ══ MAIN CHAT AREA ══ */}
            <div className="flex-1 flex flex-col h-screen min-w-0 bg-[var(--background)] relative">
                {/* Header */}
                <header className="h-16 border-b border-[var(--border)] flex items-center justify-between px-6 bg-[var(--background)] z-10">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-lg">{activeThread.title}</span>
                        {settings && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${settings.useTestWebhook ? "border-amber-500 text-amber-500" : "border-green-500 text-green-500"}`}>
                                {settings.useTestWebhook ? "TEST" : "PROD"}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {settings && (
                            <div className="relative">
                                <button onClick={() => setModelOpen(!modelOpen)} className="flex items-center gap-1 text-xs font-mono border border-[var(--border)] px-2 py-1 rounded hover:bg-[var(--muted)]">
                                    {settings.selectedModel} <IconChevronDown className="w-3 h-3" />
                                </button>
                                {modelOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--background)] border border-[var(--border)] rounded shadow-xl z-50">
                                            {settings.models.map(m => (
                                                <button key={m} onClick={() => changeModel(m)} className="w-full text-left px-4 py-2 text-xs hover:bg-[var(--muted)] border-b border-[var(--border)] last:border-0">
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        <button onClick={() => setSettingsOpen(true)} className="p-2 hover:bg-[var(--muted)] rounded"><IconSettings className="w-5 h-5" /></button>
                        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2 hover:bg-[var(--muted)] rounded">
                            {theme === "dark" ? <IconSun className="w-5 h-5" /> : <IconMoon className="w-5 h-5" />}
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <IconMessage className="w-16 h-16 mb-4" />
                            <p>Start a conversation...</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-lg px-5 py-3 border ${msg.role === "user" 
                                ? "bg-[var(--foreground)] text-[var(--background)] border-transparent" 
                                : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border)]"}`}>
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                {msg.files && msg.files.length > 0 && ( 
                                    <div className="mt-2 space-y-1">{msg.files.map((f, i) => <div key={i} className="text-xs opacity-70 flex gap-2">📄 {f.name}</div>)}</div>
                                )}
                                <div className="mt-1 text-[10px] opacity-40 text-right">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && <div className="text-sm opacity-50 animate-pulse">Thinking...</div>}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 border-t border-[var(--border)] bg-[var(--background)]">
                     {/* File Previews */}
                    {files.length > 0 && (
                        <div className="flex gap-2 mb-2 flex-wrap">
                            {files.map((file, i) => (
                                <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded border border-[var(--border)] text-xs">
                                    {fileIcon(file.type)}
                                    <span className="max-w-[150px] truncate">{file.name}</span>
                                    <button onClick={() => removeFile(i)} className="hover:text-red-500"><IconX className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-3 max-w-4xl mx-auto">
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 border border-[var(--border)] rounded-full hover:bg-[var(--muted)]">
                            <IconPaperclip className="w-5 h-5" />
                        </button>
                        <input value={input} onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                            placeholder={!user ? "Sign in to chat..." : "Type a message..."}
                            disabled={isRecording || !user}
                            className="flex-1 bg-transparent border-b border-[var(--border)] focus:border-[var(--foreground)] outline-none py-2 px-1 transition-colors" />
                         <button onClick={isRecording ? stopRecording : startRecording} disabled={!user}
                            className={`p-2 rounded-full border ${isRecording ? "border-red-500 text-red-500" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}>
                            {isRecording ? <IconPlayerStop className="w-5 h-5" /> : <IconMicrophone className="w-5 h-5" />}
                        </button>
                        <button onClick={() => sendMessage()} disabled={isLoading || !user} className="p-2 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-80 disabled:opacity-30">
                            <IconSend className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
