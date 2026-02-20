"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
    IconSend, IconPaperclip, IconMicrophone, IconPlayerStop,
    IconPhoto, IconFile, IconX, IconSettings, IconPlus, IconMessage,
    IconTrash, IconMenu2, IconRobot, IconLogin
} from "@tabler/icons-react";
import ChatSettingsModal from "@/components/ChatSettingsModal";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { getSettings, saveSettings, type ChatSettings } from "@/app/actions";
import { useTheme } from "next-themes";
import MinimalSidebar from "@/components/MinimalSidebar";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/components/ToastContext";

/* ── Types ── */
interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    text: string;
    files?: { name: string; type: string; url: string }[];
    audioUrl?: string;
    timestamp: Date;
    error?: boolean;
}

interface ChatThread {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: Date;
}

/* ── Helpers ── */
function genId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "xxxx-xxxx-4xxx-yxxx-xxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}

function getSystemInfo() {
    if (typeof window === "undefined") return {};
    return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screen: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        url: window.location.href,
    };
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
    const [settingsOpen, setSettingsOpen] = useState(false);
    
    // Mobile sidebar state
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Admin / Auth
    const { user, isEditing, setIsEditing, showLogin, setShowLogin } = useAdmin();
    const { showToast } = useToast();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const activeThread = threads.find(t => t.id === activeThreadId)!;
    const messages = activeThread?.messages || [];

    // Fetch settings
    useEffect(() => {
        getSettings().then(setSettings);
    }, []);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [input]);

    /* ── Thread management ── */
    const createThread = () => {
        const id = genId();
        setThreads(prev => [{ id, title: "New Chat", messages: [], createdAt: new Date() }, ...prev]);
        setActiveThreadId(id);
        setMobileMenuOpen(false);
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
                ? (newMessages[0].text.slice(0, 30) || "Attachment") + (newMessages[0].text.length > 30 ? "…" : "")
                : t.title;
            return { ...t, messages: newMessages, title };
        }));
    };

    /* ── Send message ── */
    const sendMessage = useCallback(async (audioBlob?: Blob) => {
        const hasContent = input.trim() || files.length > 0 || audioBlob;
        if (!hasContent || isLoading || !settings) return;

        if (!user) {
            setShowLogin(true);
            showToast("Please sign in to send messages", "info");
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
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        setIsLoading(true);

        try {
            const webhookUrl = settings.useTestWebhook ? settings.webhookTest : settings.webhookProd;
            
            // ── RICH PAYLOAD CONSTRUCTION ──
            const payload = {
                chatId: activeThreadId,
                timestamp: new Date().toISOString(),
                message: msgText,
                user: {
                    id: user.telegram_id,
                    firstName: user.first_name,
                    lastName: "", 
                    username: user.username || "",
                    photoUrl: user.photo_url || "",
                    language: navigator.language,
                },
                context: {
                    threadTitle: activeThread.title,
                    messageCount: messages.length + 1,
                    previousMessages: messages.slice(-5).map(m => ({ role: m.role, text: m.text })), 
                },
                system: getSystemInfo(),
                settings: {
                    model: settings.selectedModel,
                    temperature: settings.temperature,
                },
                mode: settings.useTestWebhook ? "test" : "production",
                files: files.map(f => ({ name: f.name, size: f.size, type: f.type })),
            };

            const formData = new FormData();
            
            // --- Flat fields for easier access in n8n ---
            formData.append("chatId", activeThreadId);
            formData.append("message", msgText);
            formData.append("timestamp", payload.timestamp);
            formData.append("mode", payload.mode);
            
            // User Data
            formData.append("userId", String(user.telegram_id));
            formData.append("userFirstName", user.first_name || "");
            formData.append("userUsername", user.username || "");
            
            // Context & Settings
            formData.append("threadTitle", activeThread.title);
            formData.append("model", settings.selectedModel);
            
            // Send the deeply nested stuff as JSON strings for advanced use
            formData.append("previousMessages", JSON.stringify(payload.context.previousMessages));
            formData.append("systemInfo", JSON.stringify(payload.system));
            
            // Keep the full payload as backup
            formData.append("full_payload_json", JSON.stringify(payload));
            
            files.forEach((file, i) => formData.append(`file_${i}`, file, file.name));
            if (audioBlob) formData.append("audio", audioBlob, "voice.webm");

            const response = await fetch(webhookUrl || "/api/webhook-proxy", { 
                method: "POST",
                body: formData, 
            });

            if (!response.ok) throw new Error(`Webhook Error: ${response.status}`);

            const data = await response.json();
            const responseText = data.output || data.text || data.message || data.response || JSON.stringify(data);

            updateThreadMessages(activeThreadId, [...updatedMessages, { 
                id: String(Date.now()), 
                role: "assistant", 
                text: responseText, 
                timestamp: new Date() 
            }]);

        } catch (err: unknown) {
            const detail = err instanceof Error ? err.message : "Network error";
            updateThreadMessages(activeThreadId, [...updatedMessages, { 
                id: String(Date.now()), 
                role: "assistant", 
                text: `❌ Error: ${detail}. Please check connection or settings.`, 
                timestamp: new Date(),
                error: true
            }]);
            showToast("Failed to send message", "error");
        } finally {
            setIsLoading(false);
        }
    }, [input, files, isLoading, settings, messages, activeThreadId, user, activeThread, showToast, setShowLogin]);

    /* ── File / Audio ── */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    };
    const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));
    const startRecording = async () => {
        if (!user) { setShowLogin(true); return; }
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
        } catch { showToast("Microphone access denied", "error"); }
    };
    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    const fileIcon = (t: string) => t.startsWith('image/') ? <IconPhoto className="w-3.5 h-3.5" /> : <IconFile className="w-3.5 h-3.5" />;

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-[var(--background)] border-r border-[var(--border)]">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <h2 className="font-bold text-sm tracking-wide">CHATS</h2>
                <button onClick={createThread} className="text-[var(--foreground)] opacity-50 hover:opacity-100 transition-opacity">
                    <IconPlus className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {threads.map(t => (
                    <div key={t.id}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${t.id === activeThreadId ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--foreground)] hover:bg-[var(--muted)]"}`}
                        onClick={() => { setActiveThreadId(t.id); setMobileMenuOpen(false); }}>
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
        </div>
    );

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pl-16 md:pl-64 flex overflow-hidden font-sans">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); showToast("Welcome back!", "success"); }} onClose={() => setShowLogin(false)} />}
            <ChatSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSettingsChanged={setSettings} />

            <MinimalSidebar />

            {/* Desktop Sidebar */}
            <aside className="w-64 flex-col hidden md:flex">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar (Overlay) */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
                        className="fixed inset-y-0 left-0 z-50 w-64 md:hidden shadow-2xl">
                        <SidebarContent />
                    </motion.div>
                )}
                {mobileMenuOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setMobileMenuOpen(false)}
                        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" />
                )}
            </AnimatePresence>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col h-screen min-w-0 bg-[var(--background)] relative">
                <header className="h-16 border-b border-[var(--border)] flex items-center justify-between px-4 bg-[var(--background)] z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1 opacity-60">
                            <IconMenu2 className="w-5 h-5" />
                        </button>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm md:text-base truncate max-w-[150px] md:max-w-md">{activeThread.title}</span>
                            <span className="text-[10px] opacity-40 uppercase tracking-widest">{messages.length} messages</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {settings && (
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${settings.useTestWebhook ? "border-amber-500/50 text-amber-500" : "border-emerald-500/50 text-emerald-500"}`}>
                                {settings.useTestWebhook ? "TEST" : "PROD"}
                            </span>
                        )}
                        <button onClick={() => setSettingsOpen(true)} className="p-2 hover:bg-[var(--muted)] rounded opacity-60 hover:opacity-100 transition-opacity"><IconSettings className="w-5 h-5" /></button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 select-none">
                            <IconRobot className="w-24 h-24 mb-6 stroke-1" />
                            <p className="text-xl font-light">How can I help you?</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-4 text-sm md:text-base leading-relaxed relative group
                                ${msg.role === "user" 
                                ? "bg-[var(--foreground)] text-[var(--background)] rounded-br-sm" 
                                : "bg-[var(--muted)] text-[var(--foreground)] rounded-bl-sm border border-[var(--border)]"}`}>
                                
                                {msg.role === "assistant" ? (
                                    <div className="prose dark:prose-invert max-w-none prose-p:my-1 prose-pre:bg-black/10 prose-pre:p-2 prose-pre:rounded">
                                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                )}

                                {msg.files && msg.files.length > 0 && ( 
                                    <div className="mt-3 space-y-2 pt-2 border-t border-white/10">
                                        {msg.files.map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs opacity-80 bg-black/10 p-2 rounded">
                                                <IconFile className="w-4 h-4" /> 
                                                <span className="truncate">{f.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                <span className={`absolute bottom-1 ${msg.role === "user" ? "left-2 text-black/30" : "right-2 text-black/30"} text-[9px] opacity-0 group-hover:opacity-100 transition-opacity`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="bg-[var(--muted)] px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                                <span className="w-2 h-2 bg-[var(--foreground)] rounded-full animate-bounce [animation-delay:-0.3s] opacity-50"></span>
                                <span className="w-2 h-2 bg-[var(--foreground)] rounded-full animate-bounce [animation-delay:-0.15s] opacity-50"></span>
                                <span className="w-2 h-2 bg-[var(--foreground)] rounded-full animate-bounce opacity-50"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 md:p-6 bg-[var(--background)] relative z-20 pb-safe">
                    <div 
                        className={`max-w-4xl mx-auto border border-[var(--border)] rounded-2xl bg-[var(--background)] shadow-sm transition-all focus-within:shadow-md focus-within:border-[var(--foreground)] ${!user ? "opacity-70" : ""}`}
                        onClick={() => { if (!user) { setShowLogin(true); } }}
                    >
                        
                        {files.length > 0 && (
                            <div className="flex gap-2 p-3 border-b border-[var(--border)] overflow-x-auto">
                                {files.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--muted)] text-xs whitespace-nowrap">
                                        {fileIcon(file.type)}
                                        <span className="max-w-[100px] truncate">{file.name}</span>
                                        <button onClick={() => removeFile(i)} className="hover:text-red-500 ml-1"><IconX className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-end gap-2 p-2">
                             <button onClick={() => user ? fileInputRef.current?.click() : setShowLogin(true)} className="p-3 text-[var(--foreground)] opacity-40 hover:opacity-100 hover:bg-[var(--muted)] rounded-xl transition-all">
                                <IconPaperclip className="w-5 h-5" />
                                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                            </button>
                            
                            <textarea 
                                ref={textareaRef}
                                value={input} 
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage();
                                    }
                                }}
                                placeholder={!user ? "Sign in to chat..." : "Type your message..."}
                                disabled={isRecording}
                                className="flex-1 bg-transparent max-h-[150px] py-3 px-1 outline-none resize-none text-sm md:text-base leading-relaxed cursor-text disabled:cursor-pointer"
                                rows={1}
                            />

                            <div className="flex gap-1">
                                {input.length === 0 && (
                                    <button onClick={isRecording ? stopRecording : startRecording} 
                                        className={`p-3 rounded-xl transition-all ${isRecording ? "bg-red-500 text-white animate-pulse" : "opacity-40 hover:opacity-100 hover:bg-[var(--muted)]"}`}>
                                        {isRecording ? <IconPlayerStop className="w-5 h-5" /> : <IconMicrophone className="w-5 h-5" />}
                                    </button>
                                )}
                                <button onClick={() => sendMessage()} disabled={isLoading || (!input.trim() && files.length === 0)} 
                                    className="p-3 bg-[var(--foreground)] text-[var(--background)] rounded-xl hover:opacity-90 disabled:opacity-30 transition-all">
                                    <IconSend className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
