"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconSend, IconPaperclip, IconMicrophone, IconPlayerStop,
    IconPhoto, IconFile, IconX, IconLoader2, IconChevronDown,
    IconSettings, IconPlus, IconMessage, IconTrash, IconUser,
    IconLogin, IconLogout, IconMoon, IconSun, IconLayoutSidebarRightCollapse
} from "@tabler/icons-react";
import ChatSettingsModal from "@/components/ChatSettingsModal";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { getSettings, saveSettings, type ChatSettings } from "@/app/actions";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

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

export default function ChatPage({ onToggleNavbar }: { onToggleNavbar?: () => void }) {
    /* ── State ── */
    const [initialChatId] = useState(() => genId());
    // ... (rest of simple state)

    // ... inside render ...
    {/* Settings */ }
    <button onClick={() => setSettingsOpen(true)}
        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all">
        <IconSettings className="w-4 h-4" />
    </button>

    {/* Toggle Navbar */ }
    <button onClick={onToggleNavbar}
        className="p-1.5 rounded-lg text-white/40 hover:text-emerald-400 hover:bg-white/10 transition-all" title="Toggle Navigation">
        <IconLayoutSidebarRightCollapse className="w-4 h-4" />
    </button>

    {/* Theme toggle */ }
    // ...
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
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [accountModalOpen, setAccountModalOpen] = useState(false);
    const [account, setAccount] = useState<UserAccount | null>(null);
    const [authMode, setAuthMode] = useState<"login" | "register">("login");
    const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
    const [authError, setAuthError] = useState("");

    // Admin
    const { isEditing, setIsEditing, showLogin, setShowLogin } = useAdmin();
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
        if (window.innerWidth < 768) setSidebarOpen(false);
    }, []);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    /* ── Auth ── */
    const handleAuth = () => {
        setAuthError("");
        if (authMode === "register") {
            if (!authForm.name.trim() || !authForm.email.trim() || !authForm.password.trim()) {
                setAuthError("All fields are required");
                return;
            }
            const acc: UserAccount = { id: genId(), name: authForm.name.trim(), email: authForm.email.trim() };
            setAccount(acc);
            localStorage.setItem("chat_account", JSON.stringify(acc));
            setAccountModalOpen(false);
            setAuthForm({ name: "", email: "", password: "" });
        } else {
            if (!authForm.email.trim() || !authForm.password.trim()) {
                setAuthError("Email and password required");
                return;
            }
            const acc: UserAccount = { id: genId(), name: authForm.email.split("@")[0], email: authForm.email.trim() };
            setAccount(acc);
            localStorage.setItem("chat_account", JSON.stringify(acc));
            setAccountModalOpen(false);
            setAuthForm({ name: "", email: "", password: "" });
        }
    };

    const handleLogout = () => {
        setAccount(null);
        localStorage.removeItem("chat_account");
        setAccountModalOpen(false);
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
            // webhookUrl tells the proxy where to forward
            formData.append("webhookUrl", webhookUrl);
            // Each field is separate so n8n can drag-and-drop them individually
            formData.append("chatId", activeThreadId);
            formData.append("timestamp", new Date().toISOString());
            formData.append("message", msgText);
            formData.append("userId", account?.id || "guest");
            formData.append("userName", account?.name || "Guest");
            formData.append("userEmail", account?.email || "");
            formData.append("model", settings.selectedModel);
            formData.append("temperature", String(settings.temperature));
            formData.append("maxTokens", String(settings.maxTokens));
            formData.append("systemPrompt", settings.systemPrompt);
            formData.append("webhookMode", settings.useTestWebhook ? "test" : "production");
            files.forEach((file, i) => formData.append(`file_${i}`, file, file.name));
            if (audioBlob) formData.append("audio", audioBlob, "voice_message.webm");

            // Go through our server-side proxy to avoid CORS
            const response = await fetch("/api/webhook-proxy", { method: "POST", body: formData });

            let responseText = "";
            // Read body as text first (can only read once), then try JSON parse
            const raw = await response.text();

            if (!response.ok) {
                try { const errData = JSON.parse(raw); responseText = `⚠️ Error ${response.status}: ${errData.error || response.statusText}`; }
                catch { responseText = `⚠️ Error ${response.status}: ${raw || response.statusText}`; }
            } else {
                try {
                    const data = JSON.parse(raw);
                    responseText = typeof data === "string" ? data : (data.message || data.text || data.response || data.output || JSON.stringify(data));
                } catch {
                    responseText = raw || "Response received";
                }
            }

            updateThreadMessages(activeThreadId, [...updatedMessages, { id: String(Date.now()), role: "assistant", text: responseText, timestamp: new Date() }]);
        } catch (err: unknown) {
            const detail = err instanceof Error ? err.message : "Unknown error";
            updateThreadMessages(activeThreadId, [...updatedMessages, { id: String(Date.now()), role: "assistant", text: `⚠️ ${detail}`, timestamp: new Date() }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, files, isLoading, settings, messages, activeThreadId, account]);

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

    /* ═══════════════════════════════ RENDER ═══════════════════════════════ */
    return (
        <div className="relative z-10 w-full h-screen flex overflow-hidden">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-2xl -z-10" />

            {/* Admin login modal */}
            <AnimatePresence>
                {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}
            </AnimatePresence>

            {/* Mobile Backdrop */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
                        onClick={() => setSidebarOpen(false)} />
                )}
            </AnimatePresence>

            <ChatSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSettingsChanged={setSettings} />

            {/* ══ SIDEBAR ══ */}
            <aside className={`fixed inset-y-0 left-0 z-30 h-full flex flex-col bg-[#080808] border-r border-white/[0.06] transition-all duration-300 md:relative
                ${sidebarOpen ? "translate-x-0 w-[280px]" : "-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-none"}`}>

                {/* New chat button */}
                <div className="p-3 border-b border-white/[0.06]">
                    <button onClick={createThread}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/70 text-sm hover:bg-white/[0.08] transition-all">
                        <IconPlus className="w-4 h-4" /> New Chat
                    </button>
                </div>

                {/* Chat list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {threads.map(t => (
                        <div key={t.id}
                            className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${t.id === activeThreadId ? "bg-emerald-500/10 text-white" : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"}`}
                            onClick={() => setActiveThreadId(t.id)}>
                            <IconMessage className="w-4 h-4 shrink-0 opacity-50" />
                            <span className="flex-1 text-xs truncate">{t.title}</span>
                            {threads.length > 1 && (
                                <button onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-0.5">
                                    <IconTrash className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Account section */}
                <div className="p-3 border-t border-white/[0.06]">
                    <button onClick={() => setAccountModalOpen(true)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shrink-0">
                            <IconUser className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs text-white font-medium truncate">{account?.name || "Guest"}</p>
                            <p className="text-[10px] text-white/30 truncate">{account?.email || "Sign in to save chats"}</p>
                        </div>
                    </button>
                </div>
            </aside>

            {/* ══ MAIN CHAT AREA ══ */}
            <div className="relative z-10 flex-1 flex flex-col h-screen min-w-0">

                {/* Toolbar */}
                <div className="shrink-0 h-12 flex items-center justify-between px-4 border-b border-white/[0.06] bg-black/20 backdrop-blur-sm">
                    {/* Left */}
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all">
                            <IconMessage className="w-4 h-4" />
                        </button>

                        {settings && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium select-none ${settings.useTestWebhook ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"}`}>
                                {settings.useTestWebhook ? "🧪 Test" : "🚀 Prod"}
                            </span>
                        )}
                    </div>

                    {/* Right — model + settings + theme + admin */}
                    <div className="flex items-center gap-1">
                        {/* Model selector */}
                        {settings && (
                            <div className="relative">
                                <button onClick={() => setModelOpen(!modelOpen)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/60 text-[11px] font-mono hover:bg-white/[0.08] transition-all">
                                    {settings.selectedModel}
                                    <IconChevronDown className={`w-3 h-3 transition-transform ${modelOpen ? "rotate-180" : ""}`} />
                                </button>
                                <AnimatePresence>
                                    {modelOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setModelOpen(false)} />
                                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                                className="absolute right-0 top-full mt-1 w-48 max-h-52 overflow-y-auto rounded-xl bg-[#0a0a0a] border border-white/10 shadow-2xl z-50">
                                                {settings.models.map(m => (
                                                    <button key={m} onClick={() => changeModel(m)}
                                                        className={`w-full text-left px-3 py-2 text-xs font-mono transition-all ${m === settings.selectedModel ? "bg-emerald-500/15 text-emerald-400" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}>
                                                        {m}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Settings */}
                        <button onClick={() => setSettingsOpen(true)}
                            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all">
                            <IconSettings className="w-4 h-4" />
                        </button>

                        <button onClick={onToggleNavbar}
                            className="p-1.5 rounded-lg text-white/40 hover:text-emerald-400 hover:bg-white/10 transition-all" title="Toggle Navigation">
                            <IconLayoutSidebarRightCollapse className="w-4 h-4" />
                        </button>

                        {/* Theme toggle */}
                        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all">
                            {theme === "dark" ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
                        </button>

                        {/* Admin */}
                        <button onClick={() => { if (isEditing) setIsEditing(false); else setShowLogin(true); }}
                            className={`p-1.5 rounded-lg transition-all ${isEditing ? "text-emerald-400 bg-emerald-500/15" : "text-white/40 hover:text-white hover:bg-white/10"}`}>
                            <IconUser className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                            <motion.div className="text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                                <div className="text-5xl mb-3">💬</div>
                                <p className="text-white/25 text-sm">Start a conversation</p>
                            </motion.div>
                        </div>
                    )}

                    <AnimatePresence>
                        {messages.map((msg) => (
                            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${msg.role === "user"
                                    ? "bg-emerald-500/20 border border-emerald-500/20 text-white"
                                    : "bg-white/[0.05] border border-white/[0.08] text-white/90"}`}>
                                    {msg.text && <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>}
                                    {msg.files && msg.files.length > 0 && (
                                        <div className="mt-2 space-y-1.5">
                                            {msg.files.map((f, i) => (
                                                <div key={i}>
                                                    {f.type.startsWith('image/') ? <img src={f.url} alt={f.name} className="rounded-lg max-h-48 object-cover" />
                                                        : f.type.startsWith('video/') ? <video src={f.url} controls className="rounded-lg max-h-48" />
                                                            : <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">{fileIcon(f.type)}<span className="text-xs text-white/60 truncate">{f.name}</span></div>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {msg.audioUrl && <div className="mt-2"><audio src={msg.audioUrl} controls className="w-full h-8" style={{ filter: "invert(1) hue-rotate(180deg)" }} /></div>}
                                    <p className="text-[10px] text-white/20 mt-1.5">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <motion.div className="flex justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                                <IconLoader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                                <span className="text-white/40 text-sm">Thinking...</span>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* File preview */}
                <AnimatePresence>
                    {files.length > 0 && (
                        <motion.div className="flex gap-2 px-4 pb-2 flex-wrap" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                            {files.map((file, i) => (
                                <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs">
                                    {fileIcon(file.type)}
                                    <span className="max-w-[100px] truncate">{file.name}</span>
                                    <button onClick={() => removeFile(i)} className="text-white/30 hover:text-red-400"><IconX className="w-3 h-3" /></button>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input bar */}
                <div className="shrink-0 px-4 pt-1 pb-28 md:pb-4">
                    <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl px-3 py-2">
                        <input ref={fileInputRef} type="file" multiple className="hidden" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xlsx,.csv" onChange={handleFileSelect} />
                        <button onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all shrink-0">
                            <IconPaperclip className="w-5 h-5" />
                        </button>

                        <input value={input} onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                            placeholder={isRecording ? "Recording..." : "Message..."}
                            disabled={isRecording}
                            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20 disabled:opacity-50 min-w-0" />

                        {isRecording && (
                            <div className="flex items-center gap-2 text-red-400 text-xs shrink-0">
                                <motion.div className="w-2 h-2 rounded-full bg-red-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                                {fmt(recordingTime)}
                            </div>
                        )}

                        <button onClick={isRecording ? stopRecording : startRecording}
                            className={`p-2 rounded-xl transition-all shrink-0 ${isRecording ? "text-red-400 bg-red-500/20 border border-red-500/30" : "text-white/40 hover:text-white hover:bg-white/10"}`}>
                            {isRecording ? <IconPlayerStop className="w-5 h-5" /> : <IconMicrophone className="w-5 h-5" />}
                        </button>

                        <button onClick={() => sendMessage()}
                            disabled={isLoading || (!input.trim() && files.length === 0)}
                            className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0">
                            <IconSend className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ══ ACCOUNT MODAL ══ */}
            <AnimatePresence>
                {accountModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setAccountModalOpen(false)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-2xl">

                            {account ? (
                                /* ── Logged in ── */
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                                            <IconUser className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-white font-semibold">{account.name}</p>
                                            <p className="text-white/40 text-sm">{account.email}</p>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-white/[0.06] space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/40">Plan</span>
                                            <span className="text-white/70">Free</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-white/40">Chats</span>
                                            <span className="text-white/70">{threads.length}</span>
                                        </div>
                                    </div>
                                    <button onClick={handleLogout}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all">
                                        <IconLogout className="w-4 h-4" /> Sign Out
                                    </button>
                                </div>
                            ) : (
                                /* ── Login / Register ── */
                                <div className="space-y-4">
                                    <h2 className="text-lg font-bold text-white text-center">
                                        {authMode === "login" ? "Welcome back" : "Create account"}
                                    </h2>

                                    <div className="space-y-3">
                                        {authMode === "register" && (
                                            <div>
                                                <label className="block text-xs text-white/40 mb-1">Name</label>
                                                <input value={authForm.name}
                                                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                                                    placeholder="Your name" />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs text-white/40 mb-1">Email</label>
                                            <input type="email" value={authForm.email}
                                                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                                                placeholder="you@email.com" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-white/40 mb-1">Password</label>
                                            <input type="password" value={authForm.password}
                                                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                                                placeholder="••••••••" />
                                        </div>
                                    </div>

                                    {authError && <p className="text-red-400 text-xs text-center">{authError}</p>}

                                    <button onClick={handleAuth}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-all">
                                        <IconLogin className="w-4 h-4" />
                                        {authMode === "login" ? "Sign In" : "Create Account"}
                                    </button>

                                    <p className="text-center text-xs text-white/30">
                                        {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
                                        <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}
                                            className="text-emerald-400 hover:underline">
                                            {authMode === "login" ? "Register" : "Sign in"}
                                        </button>
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
