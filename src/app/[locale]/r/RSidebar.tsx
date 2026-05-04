"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconX, IconTrash, IconLoader2, IconChevronRight,
    IconMenu2, IconCheck, IconAlertCircle, IconSparkles,
    IconChartBar,
} from "@tabler/icons-react";

export interface RSessionSummary {
    id: string;
    title: string;
    status: string;
    chart_count: number;
    chart_types: string[];
    created_at: string;
    updated_at: string;
}

interface Props {
    open: boolean;
    onToggle: () => void;
    activeSessionId: string | null;
    refreshTrigger: number;
    onSelectSession: (id: string) => void;
    onNewSession: () => void;
}

function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatusDot({ status }: { status: string }) {
    if (status === "generating") {
        return (
            <span className="relative flex h-2 w-2 shrink-0 mt-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
        );
    }
    if (status === "error") {
        return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0 mt-0.5" />;
    }
    return <span className="w-2 h-2 rounded-full bg-[#1a1a1a] shrink-0 mt-0.5" />;
}

function ChartTypePill({ label, active }: { label: string; active: boolean }) {
    const name = label.replace(/_/g, " ");
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium tracking-wide
            ${active ? "bg-white/15 text-white/80" : "bg-[#f3f3f3] text-[#666]"}`}>
            {name}
        </span>
    );
}

export default function RSidebar({
    open,
    onToggle,
    activeSessionId,
    refreshTrigger,
    onSelectSession,
    onNewSession,
}: Props) {
    const [sessions, setSessions] = useState<RSessionSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchSessions = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const res = await fetch("/api/r/sessions");
            if (res.ok) {
                const data = await res.json();
                setSessions(data.sessions ?? []);
            }
        } finally {
            if (!quiet) setLoading(false);
        }
    }, []);

    // Initial load + refresh when trigger changes
    useEffect(() => {
        fetchSessions();
    }, [fetchSessions, refreshTrigger]);

    // Poll every 3s when any session is generating
    useEffect(() => {
        const hasGenerating = sessions.some(s => s.status === "generating");
        if (hasGenerating && !pollRef.current) {
            pollRef.current = setInterval(() => fetchSessions(true), 3000);
        } else if (!hasGenerating && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        return () => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        };
    }, [sessions, fetchSessions]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeletingId(id);
        try {
            await fetch(`/api/r/sessions/${id}`, { method: "DELETE" });
            setSessions(prev => prev.filter(s => s.id !== id));
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            {/* Hamburger toggle - only when closed */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        key="hamburger"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onToggle}
                        className="absolute top-4 left-4 z-30 w-8 h-8 flex items-center justify-center
                                   rounded-xl border border-[#e8e8e8] bg-white/90 backdrop-blur-sm
                                   text-[#888] hover:text-[#1a1a1a] hover:border-[#ccc]
                                   shadow-sm transition-all"
                        title="Session history"
                    >
                        <IconMenu2 className="w-4 h-4" stroke={1.8} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Backdrop */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onToggle}
                        className="absolute inset-0 z-30 bg-black/10 backdrop-blur-[1px]"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar panel */}
            <AnimatePresence>
                {open && (
                    <motion.aside
                        key="sidebar"
                        initial={{ x: -300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -300, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.8 }}
                        className="absolute inset-y-0 left-0 z-40 w-[272px] flex flex-col
                                   bg-white border-r border-[#efefef] shadow-xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <IconChartBar className="w-4 h-4 text-[#1a1a1a]" stroke={2} />
                                <span className="text-[12px] font-black text-[#1a1a1a] uppercase tracking-[0.12em]">
                                    Sessions
                                </span>
                            </div>
                            <button
                                onClick={onToggle}
                                className="w-7 h-7 flex items-center justify-center rounded-lg
                                           text-gray-400 hover:text-[#1a1a1a] hover:bg-[#f5f5f5] transition-all"
                            >
                                <IconX className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* New session button */}
                        <div className="px-3 pb-3 shrink-0">
                            <button
                                onClick={() => { onNewSession(); onToggle(); }}
                                className="w-full flex items-center justify-center gap-1.5 py-2 px-3
                                           rounded-xl border border-[#e8e8e8] text-[11px] font-bold
                                           text-[#555] hover:text-[#1a1a1a] hover:border-[#ccc] hover:bg-[#fafafa]
                                           transition-all uppercase tracking-wide"
                            >
                                <IconSparkles className="w-3.5 h-3.5" />
                                New visualization
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-[#f0f0f0] mx-3 shrink-0" />

                        {/* Sessions list */}
                        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 thin-scrollbar">
                            {loading && sessions.length === 0 && (
                                <div className="flex items-center justify-center py-10">
                                    <IconLoader2 className="w-4 h-4 animate-spin text-gray-300" />
                                </div>
                            )}

                            {!loading && sessions.length === 0 && (
                                <div className="px-3 py-10 text-center">
                                    <p className="text-[11px] text-gray-300 font-medium">No sessions yet.</p>
                                    <p className="text-[10px] text-gray-200 mt-1">Generate a visualization to start.</p>
                                </div>
                            )}

                            <AnimatePresence initial={false}>
                                {sessions.map(s => {
                                    const isActive = s.id === activeSessionId;
                                    const isDeleting = s.id === deletingId;

                                    return (
                                        <motion.div
                                            key={s.id}
                                            initial={{ opacity: 0, y: -6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.18 }}
                                        >
                                            <button
                                                onClick={() => { onSelectSession(s.id); onToggle(); }}
                                                className={`group w-full text-left rounded-xl px-3 py-2.5 transition-all duration-150
                                                    ${isActive
                                                        ? "bg-[#1a1a1a] shadow-sm"
                                                        : "hover:bg-[#f6f6f6]"
                                                    }`}
                                            >
                                                <div className="flex items-start gap-2.5">
                                                    {/* Status indicator */}
                                                    <div className="pt-1">
                                                        <StatusDot status={s.status} />
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        {/* Title */}
                                                        <p className={`text-[12px] font-semibold leading-snug truncate
                                                            ${isActive ? "text-white" : "text-[#1a1a1a]"}`}>
                                                            {s.title || "Untitled"}
                                                        </p>

                                                        {/* Chart type pills */}
                                                        {s.chart_types.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {s.chart_types.slice(0, 4).map(ct => (
                                                                    <ChartTypePill key={ct} label={ct} active={isActive} />
                                                                ))}
                                                                {s.chart_types.length > 4 && (
                                                                    <span className={`text-[9px] font-mono ${isActive ? "text-white/50" : "text-gray-400"}`}>
                                                                        +{s.chart_types.length - 4}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Meta row */}
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            {s.status === "generating" ? (
                                                                <span className={`text-[10px] font-medium ${isActive ? "text-amber-300" : "text-amber-500"}`}>
                                                                    Generating…
                                                                </span>
                                                            ) : s.status === "error" ? (
                                                                <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isActive ? "text-red-300" : "text-red-400"}`}>
                                                                    <IconAlertCircle className="w-3 h-3" />
                                                                    Error
                                                                </span>
                                                            ) : (
                                                                <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isActive ? "text-white/50" : "text-gray-400"}`}>
                                                                    <IconCheck className="w-3 h-3" stroke={2.5} />
                                                                    {s.chart_count} {s.chart_count === 1 ? "chart" : "charts"}
                                                                </span>
                                                            )}
                                                            <span className={`text-[10px] ${isActive ? "text-white/30" : "text-gray-300"}`}>
                                                                ·
                                                            </span>
                                                            <span className={`text-[10px] ${isActive ? "text-white/40" : "text-gray-400"}`}>
                                                                {formatRelative(s.updated_at)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Delete button */}
                                                    <button
                                                        onClick={(e) => handleDelete(e, s.id)}
                                                        disabled={isDeleting}
                                                        className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-lg
                                                                    transition-all opacity-0 group-hover:opacity-100
                                                                    ${isActive
                                                                        ? "text-white/50 hover:text-white hover:bg-white/10"
                                                                        : "text-gray-300 hover:text-red-400 hover:bg-red-50"
                                                                    }
                                                                    ${isDeleting ? "opacity-50" : ""}`}
                                                        title="Delete session"
                                                    >
                                                        {isDeleting
                                                            ? <IconLoader2 className="w-3 h-3 animate-spin" />
                                                            : <IconTrash className="w-3 h-3" />
                                                        }
                                                    </button>
                                                </div>
                                            </button>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-4 py-3 border-t border-[#f0f0f0]">
                            <p className="text-[9px] text-gray-300 font-mono text-center uppercase tracking-widest">
                                R Studio · Session History
                            </p>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
}
