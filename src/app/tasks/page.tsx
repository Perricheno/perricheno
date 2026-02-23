"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { useAdmin } from "@/components/AdminContext";
import MinimalSidebar from "@/components/MinimalSidebar";
import { LoginModal } from "@/components/LoginModal";
import { IconSend, IconClock, IconCheck, IconTrash, IconLoader2, IconSparkles } from "@tabler/icons-react";
import { useToast } from "@/components/ToastContext";

interface Task {
    id: number;
    task_text: string;
    remind_at: string;
    status: 'pending' | 'done';
    created_at: string;
}

export default function TasksPage() {
    const { user, showLogin, setShowLogin, setIsEditing } = useAdmin();
    const { showToast } = useToast();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [input, setInput] = useState("");
    const [isParsing, setIsParsing] = useState(false);

    useEffect(() => {
        if (user) {
            fetchTasks();
        } else {
            setLoading(false);
            setTasks([]);
        }
    }, [user]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/tasks');
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (e) {
            console.error("Failed to fetch tasks", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isParsing || !user) return;

        const text = input.trim();
        setInput("");
        setIsParsing(true);

        const timezoneOffset = new Date().getTimezoneOffset();
        const currentTime = new Date().toISOString();

        try {
            const res = await fetch('/api/tasks/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, timezoneOffset, currentTime })
            });

            const data = await res.json();

            if (!res.ok) {
                showToast(data.error || "Failed to schedule task", "error");
            } else {
                showToast("Task scheduled successfully!", "success");
                if (data.task) {
                    setTasks(prev => [...prev, data.task].sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()));
                } else {
                    fetchTasks(); // fallback
                }
            }
        } catch (e) {
            showToast("Network error parsing task", "error");
        } finally {
            setIsParsing(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    };

    const handleToggleStatus = async (task: Task) => {
        const newStatus = task.status === 'pending' ? 'done' : 'pending';
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
        
        try {
            await fetch('/api/tasks', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: task.id, status: newStatus })
            });
        } catch (e) {
            // Revert on error
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
            showToast("Failed to update task", "error");
        }
    };

    const handleDelete = async (taskId: number) => {
        // Optimistic update
        setTasks(prev => prev.filter(t => t.id !== taskId));

        try {
            await fetch(`/api/tasks?id=${taskId}`, {
                method: 'DELETE'
            });
        } catch (e) {
            showToast("Failed to delete task", "error");
            fetchTasks(); // Reload
        }
    };

    const formatTime = (isoString: string) => {
        const d = new Date(isoString);
        return d.toLocaleString(undefined, { 
            weekday: 'short', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
    };

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const doneTasks = tasks.filter(t => t.status === 'done');

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pl-0 md:pl-20 pb-24 md:pb-0 transition-all font-sans">
            <MinimalSidebar />
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-3xl mx-auto px-6 py-12 md:py-24">
                <div className="mb-10">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
                        Schedule Tasks <IconSparkles className="w-6 h-6 text-yellow-500" />
                    </h1>
                    <p className="text-gray-500">Tell AI what you need to do and when to remind you.</p>
                </div>

                {!user ? (
                    <div className="bg-white dark:bg-[#18181b] border border-[var(--border)] rounded-[var(--radius)] p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#27272a] flex items-center justify-center mx-auto mb-4 border border-[var(--border)]">
                            <IconClock className="w-8 h-8 text-gray-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Telegram Authentication Required</h2>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            To schedule tasks and receive Bot Reminders, you must connect your Telegram account.
                        </p>
                        <button onClick={() => setShowLogin(true)}
                            className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-[var(--radius)] font-semibold hover:opacity-90 transition-opacity shadow-sm">
                            Connect Telegram
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* ━━━━ Input Area ━━━━ */}
                        <div className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isParsing}
                                placeholder='e.g., "18:00 reminder today call John" or "remind me to buy milk tomorrow at 9am"'
                                className="w-full bg-white dark:bg-[#18181b] border border-[var(--border)] rounded-[var(--radius)] px-5 py-4 pr-16 text-[var(--foreground)] placeholder:text-gray-400 outline-none focus:border-gray-400 dark:focus:border-gray-600 transition-colors shadow-sm text-sm disabled:opacity-50"
                            />
                            <button 
                                onClick={handleSend}
                                disabled={isParsing || !input.trim()}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)] disabled:opacity-50 hover:opacity-90 transition-opacity"
                            >
                                {isParsing ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconSend className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* ━━━━ Task Lists ━━━━ */}
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <IconLoader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Pending */}
                                {pendingTasks.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">Upcoming</h3>
                                        <div className="space-y-2">
                                            {pendingTasks.map(task => (
                                                <div key={task.id} className="group flex items-center justify-between p-4 bg-white dark:bg-[#18181b] border border-[var(--border)] rounded-[var(--radius)] hover:border-gray-300 dark:hover:border-gray-700 transition-colors shadow-sm">
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        <button onClick={() => handleToggleStatus(task)}
                                                            className="w-5 h-5 rounded-md border border-[var(--border)] flex items-center justify-center text-transparent hover:border-gray-400 transition-colors shrink-0">
                                                            <IconCheck className="w-3.5 h-3.5" />
                                                        </button>
                                                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                                                            <span className="text-sm font-medium truncate">{task.task_text}</span>
                                                            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                                                                <IconClock className="w-3 h-3" />
                                                                {formatTime(task.remind_at)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleDelete(task.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all ml-2 shrink-0">
                                                        <IconTrash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Done */}
                                {doneTasks.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1 mt-8">Completed</h3>
                                        <div className="space-y-2">
                                            {doneTasks.map(task => (
                                                <div key={task.id} className="group flex items-center justify-between p-4 bg-transparent border border-transparent hover:border-[var(--border)] rounded-[var(--radius)] transition-colors opacity-60">
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        <button onClick={() => handleToggleStatus(task)}
                                                            className="w-5 h-5 rounded-md bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center shrink-0">
                                                            <IconCheck className="w-3.5 h-3.5" />
                                                        </button>
                                                        <div className="flex-1 min-w-0 line-through text-sm">
                                                            {task.task_text}
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleDelete(task.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded-md transition-all ml-2 shrink-0">
                                                        <IconTrash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {tasks.length === 0 && (
                                    <div className="text-center py-12 text-gray-500 text-sm">
                                        No tasks scheduled yet. Try asking AI to remind you of something!
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
