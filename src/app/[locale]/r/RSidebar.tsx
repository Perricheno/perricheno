"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from "framer-motion";
import {
    IconX, IconTrash, IconLoader2, IconChevronRight,
    IconMenu2, IconCheck, IconAlertCircle, IconSparkles,
    IconChartBar, IconClockHour4,
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

const SPRING = { type: "spring" as const, damping: 34, stiffness: 340, mass: 0.8 };

const DELETE_OPTIONS = [
    { label: "Older than 7 days", days: 7 },
    { label: "Older than 14 days", days: 14 },
    { label: "Older than 30 days", days: 30 },
    { label: "Delete all", days: 0 },
];

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
    if (status === "error") return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0 mt-0.5" />;
    return <span className="w-2 h-2 rounded-full bg-[#1a1a1a] shrink-0 mt-0.5" />;
}

function ChartTypePill({ label, active }: { label: string; active: boolean }) {
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium tracking-wide
            ${active ? "bg-white/15 text-white/80" : "bg-[#f3f3f3] text-[#666]"}`}>
            {label.replace(/_/g, " ")}
        </span>
    );
}

// ── Shared session list content ──────────────────────────────────────────────

function SessionList({
    sessions, loading, activeSessionId, deletingId, showCleanup, setShowCleanup,
    onSelect, onNewSession, onDelete, onBulkDelete, onClose,
}: {
    sessions: RSessionSummary[];
    loading: boolean;
    activeSessionId: string | null;
    deletingId: string | null;
    showCleanup: boolean;
    setShowCleanup: (v: boolean) => void;
    onSelect: (id: string) => void;
    onNewSession: () => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
    onBulkDelete: (days: number) => void;
    onClose: () => void;
}) {
    return (
        <>
            {/* New session button */}
            <div className="px-3 pb-3 shrink-0">
                <button
                    onClick={() => { onNewSession(); onClose(); }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3
                               rounded-xl border border-[#e8e8e8] text-[11px] font-bold
                               text-[#555] hover:text-[#1a1a1a] hover:border-[#ccc] hover:bg-[#fafafa]
                               transition-all uppercase tracking-wide"
                >
                    <IconSparkles className="w-3.5 h-3.5" />
                    New visualization
                </button>
            </div>

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
                                    onClick={() => { onSelect(s.id); onClose(); }}
                                    className={`group w-full text-left rounded-xl px-3 py-2.5 transition-all duration-150
                                        ${isActive ? "bg-[#1a1a1a] shadow-sm" : "hover:bg-[#f6f6f6]"}`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div className="pt-1"><StatusDot status={s.status} /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[12px] font-semibold leading-snug truncate
                                                ${isActive ? "text-white" : "text-[#1a1a1a]"}`}>
                                                {s.title || "Untitled"}
                                            </p>
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
                                                <span className={`text-[10px] ${isActive ? "text-white/30" : "text-gray-300"}`}>·</span>
                                                <span className={`text-[10px] ${isActive ? "text-white/40" : "text-gray-400"}`}>
                                                    {formatRelative(s.updated_at)}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => onDelete(e, s.id)}
                                            disabled={isDeleting}
                                            className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-lg
                                                        transition-all opacity-0 group-hover:opacity-100
                                                        ${isActive
                                                            ? "text-white/50 hover:text-white hover:bg-white/10"
                                                            : "text-gray-300 hover:text-red-400 hover:bg-red-50"
                                                        }
                                                        ${isDeleting ? "opacity-50" : ""}`}
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

            {/* Footer: cleanup */}
            {sessions.length > 0 && (
                <div className="shrink-0 px-3 py-3 border-t border-[#f0f0f0]">
                    <AnimatePresence mode="wait">
                        {showCleanup ? (
                            <motion.div
                                key="options"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 4 }}
                                transition={{ duration: 0.15 }}
                                className="space-y-1"
                            >
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delete sessions</span>
                                    <button onClick={() => setShowCleanup(false)} className="text-gray-300 hover:text-[#1a1a1a]">
                                        <IconX className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                {DELETE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.days}
                                        onClick={() => { onBulkDelete(opt.days); setShowCleanup(false); }}
                                        className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </motion.div>
                        ) : (
                            <motion.button
                                key="btn"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                onClick={() => setShowCleanup(true)}
                                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all uppercase tracking-wide"
                            >
                                <IconClockHour4 className="w-3.5 h-3.5" />
                                Clean up history
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </>
    );
}

// ── Main RSidebar ─────────────────────────────────────────────────────────────

export default function RSidebar({
    open, onToggle, activeSessionId, refreshTrigger, onSelectSession, onNewSession,
}: Props) {
    const [sessions, setSessions] = useState<RSessionSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showCleanup, setShowCleanup] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Mobile sheet state
    const [mobileMounted, setMobileMounted] = useState(false);
    const [snap, setSnap] = useState<"peek" | "full">("full");
    const dragControls = useDragControls();
    const y = useMotionValue(0);

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

    useEffect(() => { fetchSessions(); }, [fetchSessions, refreshTrigger]);

    useEffect(() => {
        const hasGenerating = sessions.some(s => s.status === "generating");
        if (hasGenerating && !pollRef.current) {
            pollRef.current = setInterval(() => fetchSessions(true), 3000);
        } else if (!hasGenerating && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    }, [sessions, fetchSessions]);

    // Mobile sheet animation
    useEffect(() => {
        if (open) {
            setMobileMounted(true);
            setSnap("full");
            y.set(window.innerHeight);
            requestAnimationFrame(() => animate(y, 0, SPRING));
        } else if (mobileMounted) {
            animate(y, window.innerHeight * 1.1, {
                ...SPRING,
                onComplete: () => setMobileMounted(false),
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleMobileClose = useCallback(() => {
        animate(y, window.innerHeight * 1.1, { ...SPRING, onComplete: onToggle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onToggle]);

    const handleDragEnd = useCallback((_: any, info: any) => {
        const cur = y.get();
        const vy = info.velocity.y;
        if (vy > 600 || cur > 200) {
            animate(y, window.innerHeight * 1.1, { ...SPRING, onComplete: onToggle });
        } else {
            animate(y, 0, SPRING);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onToggle]);

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

    const handleBulkDelete = async (days: number) => {
        const cutoff = days === 0 ? null : Date.now() - days * 24 * 60 * 60 * 1000;
        const toDelete = cutoff
            ? sessions.filter(s => new Date(s.created_at).getTime() < cutoff)
            : sessions;
        setSessions(prev => prev.filter(s => !toDelete.find(d => d.id === s.id)));
        await Promise.all(toDelete.map(s => fetch(`/api/r/sessions/${s.id}`, { method: "DELETE" })));
    };

    const sharedProps = {
        sessions, loading, activeSessionId, deletingId, showCleanup, setShowCleanup,
        onSelect: onSelectSession, onNewSession, onDelete: handleDelete, onBulkDelete: handleBulkDelete,
        onClose: onToggle,
    };

    return (
        <>
            {/* Hamburger — only when closed, desktop only */}
            <AnimatePresence>
                {!open && (
                    <motion.button
                        key="hamburger"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onToggle}
                        className="absolute top-4 left-4 z-30 w-8 h-8 flex items-center justify-center
                                   rounded-xl border border-[#e8e8e8] bg-white/90 backdrop-blur-sm
                                   text-[#888] hover:text-[#1a1a1a] hover:border-[#ccc]
                                   shadow-sm transition-all"
                    >
                        <IconMenu2 className="w-4 h-4" stroke={1.8} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── DESKTOP sidebar ── */}
            <AnimatePresence>
                {open && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={onToggle}
                            className="absolute inset-0 z-30 bg-black/10 backdrop-blur-[1px] hidden md:block"
                        />

                        <motion.aside
                            key="sidebar"
                            initial={{ x: -300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -300, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.8 }}
                            className="absolute inset-y-0 left-0 z-40 w-[272px] hidden md:flex flex-col
                                       bg-white border-r border-[#efefef] shadow-xl"
                        >
                            <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
                                <div className="flex items-center gap-2">
                                    <IconChartBar className="w-4 h-4 text-[#1a1a1a]" stroke={2} />
                                    <span className="text-[12px] font-black text-[#1a1a1a] uppercase tracking-[0.12em]">Sessions</span>
                                </div>
                                <button
                                    onClick={onToggle}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#1a1a1a] hover:bg-[#f5f5f5] transition-all"
                                >
                                    <IconX className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <SessionList {...sharedProps} onClose={onToggle} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── MOBILE bottom sheet ── */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="mobile-backdrop"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={handleMobileClose}
                    />
                )}
            </AnimatePresence>

            {mobileMounted && (
                <motion.div
                    drag="y"
                    dragControls={dragControls}
                    dragListener={false}
                    dragConstraints={{ top: 0, bottom: window.innerHeight * 2 }}
                    dragElastic={{ top: 0.04, bottom: 0.02 }}
                    onDragEnd={handleDragEnd}
                    style={{
                        position: "fixed",
                        top: "5dvh",
                        left: 0,
                        right: 0,
                        height: "95dvh",
                        zIndex: 50,
                        y,
                    }}
                    className="bg-white rounded-t-3xl shadow-2xl md:hidden flex flex-col"
                >
                    {/* Drag handle */}
                    <div
                        className="flex flex-col items-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
                        style={{ touchAction: "none" }}
                        onPointerDown={(e) => dragControls.start(e)}
                    >
                        <div className="w-10 h-[5px] rounded-full bg-[#ddd]" />
                    </div>

                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-5 pb-3 flex-shrink-0"
                        style={{ touchAction: "none" }}
                        onPointerDown={(e) => dragControls.start(e)}
                    >
                        <div>
                            <p className="text-[14px] font-bold text-[#1a1a1a]">Sessions</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">Drag down to close</p>
                        </div>
                        <button
                            onClick={handleMobileClose}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#f0f0f0] text-gray-400 hover:text-[#1a1a1a] transition-colors"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <IconX size={14} />
                        </button>
                    </div>

                    <div className="h-px bg-[#ebebeb] flex-shrink-0" />

                    <div className="flex-1 flex flex-col overflow-hidden" style={{ touchAction: "pan-y" }}>
                        <SessionList {...sharedProps} onClose={handleMobileClose} />
                    </div>
                </motion.div>
            )}
        </>
    );
}
