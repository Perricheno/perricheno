"use client";

import { useState, useEffect, KeyboardEvent } from "react";
import { useAdmin } from "@/components/AdminContext";
import { LoginModal } from "@/components/LoginModal";
import { 
    IconSend, IconClock, IconCheck, IconTrash, IconLoader2, 
    IconSparkles, IconPlus, IconEdit, IconX, IconCalendar
} from "@tabler/icons-react";
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

    // AI input
    const [aiInput, setAiInput] = useState("");
    const [isParsing, setIsParsing] = useState(false);

    // Manual input
    const [showManual, setShowManual] = useState(false);
    const [manualText, setManualText] = useState("");
    const [manualDate, setManualDate] = useState("");
    const [manualTime, setManualTime] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editText, setEditText] = useState("");
    const [editDate, setEditDate] = useState("");
    const [editTime, setEditTime] = useState("");

    // Active tab
    const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');

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

    // ━━━━ AI Handler ━━━━
    const handleAiSend = async () => {
        if (!aiInput.trim() || isParsing || !user) return;
        const text = aiInput.trim();
        setAiInput("");
        setIsParsing(true);

        try {
            const res = await fetch('/api/tasks/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text, 
                    timezoneOffset: new Date().getTimezoneOffset(), 
                    currentTime: new Date().toISOString() 
                })
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || "Failed to schedule task", "error");
            } else {
                showToast("Task scheduled via AI ✨", "success");
                if (data.task) {
                    setTasks(prev => [...prev, data.task].sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()));
                } else {
                    fetchTasks();
                }
            }
        } catch (e) {
            showToast("Network error", "error");
        } finally {
            setIsParsing(false);
        }
    };

    // ━━━━ Manual Handler ━━━━
    const handleManualCreate = async () => {
        if (!manualText.trim() || !manualDate || !manualTime || isCreating) return;
        setIsCreating(true);

        const remindAt = new Date(`${manualDate}T${manualTime}:00`).toISOString();
        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: manualText.trim(), remindAt })
            });
            const data = await res.json();
            if (res.ok) {
                showToast("Task created!", "success");
                setTasks(prev => [...prev, data].sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()));
                setManualText("");
                setManualDate("");
                setManualTime("");
            } else {
                showToast(data.error || "Failed to create task", "error");
            }
        } catch (e) {
            showToast("Network error", "error");
        } finally {
            setIsCreating(false);
        }
    };

    // ━━━━ Edit Handler ━━━━
    const startEditing = (task: Task) => {
        setEditingId(task.id);
        setEditText(task.task_text);
        const d = new Date(task.remind_at);
        setEditDate(d.toISOString().split('T')[0]);
        setEditTime(d.toTimeString().slice(0, 5));
    };

    const saveEdit = async () => {
        if (!editText.trim() || !editDate || !editTime || editingId === null) return;
        const remindAt = new Date(`${editDate}T${editTime}:00`).toISOString();

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === editingId ? { ...t, task_text: editText, remind_at: remindAt } : t));
        setEditingId(null);

        try {
            await fetch('/api/tasks', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: editingId, text: editText, remindAt, status: 'pending' })
            });
            showToast("Task updated!", "success");
        } catch (e) {
            showToast("Failed to update", "error");
            fetchTasks();
        }
    };

    const handleToggleStatus = async (task: Task) => {
        const newStatus = task.status === 'pending' ? 'done' : 'pending';
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
        try {
            await fetch('/api/tasks', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: task.id, status: newStatus })
            });
        } catch (e) {
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
            showToast("Failed to update", "error");
        }
    };

    const handleDelete = async (taskId: number) => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        try {
            await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' });
        } catch (e) {
            showToast("Failed to delete", "error");
            fetchTasks();
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

    // Default date/time for manual form
    const getDefaultDate = () => new Date().toISOString().split('T')[0];
    const getDefaultTime = () => {
        const now = new Date();
        now.setHours(now.getHours() + 1, 0, 0, 0);
        return now.toTimeString().slice(0, 5);
    };

    return (
        <div className="w-full h-full font-sans">
            {showLogin && <LoginModal onSuccess={() => { setIsEditing(true); setShowLogin(false); }} onClose={() => setShowLogin(false)} />}

            <div className="max-w-3xl mx-auto px-6 py-12 md:py-24">
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Schedule Tasks</h1>
                    <p className="text-gray-500">Create tasks with AI or manually. Get reminders via Telegram Bot.</p>
                </div>

                {!user ? (
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 border border-[var(--border)]">
                            <IconClock className="w-8 h-8 text-gray-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Telegram Authentication Required</h2>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            Connect Telegram to schedule tasks and receive reminders via Bot.
                        </p>
                        <button onClick={() => setShowLogin(true)}
                            className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-[var(--radius)] font-semibold hover:opacity-90 transition-opacity shadow-sm">
                            Connect Telegram
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* ━━━━ Tab Switcher ━━━━ */}
                        <div className="flex gap-1 p-1 bg-gray-100 rounded-[var(--radius)] w-fit">
                            <button onClick={() => setActiveTab('ai')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    activeTab === 'ai' 
                                        ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]' 
                                        : 'text-gray-500 hover:text-[var(--foreground)]'
                                }`}>
                                <IconSparkles className="w-4 h-4" /> AI Assistant
                            </button>
                            <button onClick={() => { setActiveTab('manual'); if (!manualDate) setManualDate(getDefaultDate()); if (!manualTime) setManualTime(getDefaultTime()); }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    activeTab === 'manual' 
                                        ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]' 
                                        : 'text-gray-500 hover:text-[var(--foreground)]'
                                }`}>
                                <IconPlus className="w-4 h-4" /> Manual
                            </button>
                        </div>

                        {/* ━━━━ AI Input ━━━━ */}
                        {activeTab === 'ai' && (
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <IconSparkles className="w-4 h-4 text-yellow-500" />
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ask AI to schedule</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={aiInput}
                                        onChange={e => setAiInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAiSend()}
                                        disabled={isParsing}
                                        placeholder={`"19:00 напомни о лекарствах" or "remind me to call mom tomorrow at 3pm"`}
                                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 pr-12 text-sm outline-none focus:border-gray-400 transition-colors disabled:opacity-50"
                                    />
                                    <button onClick={handleAiSend} disabled={isParsing || !aiInput.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md bg-[var(--foreground)] text-[var(--background)] disabled:opacity-30 hover:opacity-90 transition-opacity">
                                        {isParsing ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconSend className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ━━━━ Manual Input ━━━━ */}
                        {activeTab === 'manual' && (
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <IconCalendar className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Create task manually</span>
                                </div>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={manualText}
                                        onChange={e => setManualText(e.target.value)}
                                        placeholder="What do you need to do?"
                                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
                                    />
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-500 mb-1 block">Date</label>
                                            <input
                                                type="date"
                                                value={manualDate}
                                                onChange={e => setManualDate(e.target.value)}
                                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-500 mb-1 block">Time</label>
                                            <input
                                                type="time"
                                                value={manualTime}
                                                onChange={e => setManualTime(e.target.value)}
                                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <button onClick={handleManualCreate} disabled={isCreating || !manualText.trim() || !manualDate || !manualTime}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-lg font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity">
                                        {isCreating ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconPlus className="w-4 h-4" />}
                                        Add Task
                                    </button>
                                </div>
                            </div>
                        )}

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
                                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                                            Upcoming ({pendingTasks.length})
                                        </h3>
                                        <div className="space-y-2">
                                            {pendingTasks.map(task => (
                                                <div key={task.id} className="group bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] hover:border-gray-300 transition-colors shadow-sm overflow-hidden">
                                                    {editingId === task.id ? (
                                                        /* Edit Mode */
                                                        <div className="p-4 space-y-3">
                                                            <input type="text" value={editText} onChange={e => setEditText(e.target.value)}
                                                                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400" autoFocus />
                                                            <div className="flex gap-3">
                                                                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                                                    className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none" />
                                                                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                                                                    className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none" />
                                                            </div>
                                                            <div className="flex gap-2 justify-end">
                                                                <button onClick={() => setEditingId(null)}
                                                                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-[var(--foreground)] rounded-md hover:bg-black/5 transition-colors">
                                                                    Cancel
                                                                </button>
                                                                <button onClick={saveEdit}
                                                                    className="px-4 py-1.5 text-xs bg-[var(--foreground)] text-[var(--background)] rounded-md font-semibold hover:opacity-90 transition-opacity">
                                                                    Save
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* View Mode */
                                                        <div className="flex items-center justify-between p-4">
                                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                                <button onClick={() => handleToggleStatus(task)}
                                                                    className="w-5 h-5 rounded-md border-2 border-gray-300 flex items-center justify-center text-transparent hover:border-green-500 hover:text-green-500 transition-colors shrink-0">
                                                                    <IconCheck className="w-3.5 h-3.5" />
                                                                </button>
                                                                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
                                                                    <span className="text-sm font-medium truncate">{task.task_text}</span>
                                                                    <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                                                                        <IconClock className="w-3 h-3" />
                                                                        {formatTime(task.remind_at)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all ml-2 shrink-0">
                                                                <button onClick={() => startEditing(task)}
                                                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors">
                                                                    <IconEdit className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleDelete(task.id)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                                                    <IconTrash className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Done */}
                                {doneTasks.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                                            Completed ({doneTasks.length})
                                        </h3>
                                        <div className="space-y-2">
                                            {doneTasks.map(task => (
                                                <div key={task.id} className="group flex items-center justify-between p-4 border border-transparent hover:border-[var(--border)] rounded-[var(--radius)] transition-colors opacity-50 hover:opacity-70">
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        <button onClick={() => handleToggleStatus(task)}
                                                            className="w-5 h-5 rounded-md bg-green-500 text-white flex items-center justify-center shrink-0">
                                                            <IconCheck className="w-3.5 h-3.5" />
                                                        </button>
                                                        <span className="flex-1 min-w-0 line-through text-sm text-gray-500">
                                                            {task.task_text}
                                                        </span>
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
                                    <div className="text-center py-16">
                                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                            <IconCalendar className="w-7 h-7 text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 text-sm mb-1">No tasks yet</p>
                                        <p className="text-gray-400 text-xs">Use AI or Manual mode to create your first task</p>
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
