"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from "framer-motion";
import { X, Trash2, Share, Loader2, Menu, Sparkles, AlertCircle } from "lucide-react";
import { AgentSession } from "./types";

interface Props {
    sessions: AgentSession[];
    currentSessionId: string | null;
    onSelectSession: (s: AgentSession) => void;
    onDeleteSession: (id: string, e: React.MouseEvent) => void;
    onShareSession: (id: string, e: React.MouseEvent) => void;
    onNewSession: () => void;
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
}

const SPRING = { type: "spring" as const, damping: 34, stiffness: 340, mass: 0.8 };

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

function DocTypePill({ type, active }: { type: string; active: boolean }) {
    const label =
        type === "chat" ? "Chat"
        : type === "literature_search" ? "Scholar"
        : type === "data_analytics" || type === "data-analytics" ? "Agent"
        : "Report";
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium tracking-wide
            ${active ? "bg-white/15 text-white/80" : "bg-[#f3f3f3] text-[#666]"}`}>
            {label}
        </span>
    );
}

function SessionList({
    sessions, currentSessionId, onSelectSession, onDeleteSession, onShareSession, onNewSession, onClose,
}: {
    sessions: AgentSession[];
    currentSessionId: string | null;
    onSelectSession: (s: AgentSession) => void;
    onDeleteSession: (id: string, e: React.MouseEvent) => void;
    onShareSession: (id: string, e: React.MouseEvent) => void;
    onNewSession: () => void;
    onClose: () => void;
}) {
    return (
        <>
            <div className="px-3 pb-3 shrink-0">
                <button
                    onClick={() => { onNewSession(); onClose(); }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3
                               rounded-xl border border-[#e8e8e8] text-[11px] font-bold
                               text-[#555] hover:text-[#1a1a1a] hover:border-[#ccc] hover:bg-[#fafafa]
                               transition-all uppercase tracking-wide"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    New Document
                </button>
            </div>

            <div className="h-px bg-[#f0f0f0] mx-3 shrink-0" />

            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                {sessions.length === 0 ? (
                    <div className="px-3 py-10 text-center">
                        <p className="text-[11px] text-gray-300 font-medium">No sessions yet.</p>
                        <p className="text-[10px] text-gray-200 mt-1">Generate a document to start.</p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {sessions.map(s => {
                            const isActive = s.id === currentSessionId;
                            return (
                                <motion.div
                                    key={s.id}
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    <button
                                        onClick={() => { onSelectSession(s); onClose(); }}
                                        className={`group w-full text-left rounded-xl px-3 py-2.5 transition-all duration-150
                                            ${isActive ? "bg-[#1a1a1a] shadow-sm" : "hover:bg-[#f6f6f6]"}`}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className="pt-1 shrink-0">
                                                {s.status === "generating" ? (
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                                                    </span>
                                                ) : (
                                                    <span className={`w-2 h-2 rounded-full inline-block ${isActive ? "bg-white" : "bg-[#1a1a1a]"}`} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[12px] font-semibold leading-snug truncate
                                                    ${isActive ? "text-white" : "text-[#1a1a1a]"}`}>
                                                    {s.title || "Untitled"}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                    <DocTypePill type={s.doc_type} active={isActive} />
                                                    {s.share_id && (
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-medium tracking-wide
                                                            ${isActive ? "bg-blue-400/20 text-blue-200" : "bg-blue-50 text-blue-500"}`}>
                                                            shared
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] ${isActive ? "text-white/40" : "text-gray-400"}`}>
                                                        {s.status === "generating" ? (
                                                            <span className={`animate-pulse font-medium ${isActive ? "text-amber-300" : "text-amber-500"}`}>
                                                                Generating…
                                                            </span>
                                                        ) : (
                                                            formatRelative(s.updated_at)
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onShareSession(s.id, e); }}
                                                    className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all
                                                        ${isActive
                                                            ? "text-white/50 hover:text-white hover:bg-white/10"
                                                            : "text-gray-300 hover:text-blue-400 hover:bg-blue-50"
                                                        }`}
                                                    title="Share"
                                                >
                                                    <Share className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id, e); }}
                                                    className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all
                                                        ${isActive
                                                            ? "text-white/50 hover:text-white hover:bg-white/10"
                                                            : "text-gray-300 hover:text-red-400 hover:bg-red-50"
                                                        }`}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </button>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </>
    );
}

export function AgentSidebar({
    sessions, currentSessionId, onSelectSession, onDeleteSession, onShareSession, onNewSession, isOpen, setIsOpen,
}: Props) {
    const [mobileMounted, setMobileMounted] = useState(false);
    const dragControls = useDragControls();
    const y = useMotionValue(0);

    useEffect(() => {
        if (isOpen) {
            setMobileMounted(true);
            y.set(window.innerHeight);
            requestAnimationFrame(() => animate(y, 0, SPRING));
        } else if (mobileMounted) {
            animate(y, window.innerHeight * 1.1, {
                ...SPRING,
                onComplete: () => setMobileMounted(false),
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleMobileClose = useCallback(() => {
        animate(y, window.innerHeight * 1.1, { ...SPRING, onComplete: () => setIsOpen(false) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setIsOpen]);

    const handleDragEnd = useCallback((_: any, info: any) => {
        const cur = y.get();
        if (info.velocity.y > 600 || cur > 200) {
            animate(y, window.innerHeight * 1.1, { ...SPRING, onComplete: () => setIsOpen(false) });
        } else {
            animate(y, 0, SPRING);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setIsOpen]);

    const sharedProps = {
        sessions, currentSessionId, onSelectSession, onDeleteSession, onShareSession, onNewSession,
    };

    return (
        <>
            {/* Hamburger — when closed */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        key="hamburger"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setIsOpen(true)}
                        className="absolute top-4 left-4 z-30 w-8 h-8 flex items-center justify-center
                                   rounded-xl border border-[#e8e8e8] bg-white/90 backdrop-blur-sm
                                   text-[#888] hover:text-[#1a1a1a] hover:border-[#ccc]
                                   shadow-sm transition-all"
                    >
                        <Menu className="w-4 h-4" strokeWidth={1.8} />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── DESKTOP sidebar ── */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setIsOpen(false)}
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
                                    <Sparkles className="w-4 h-4 text-[#1a1a1a]" strokeWidth={2} />
                                    <span className="text-[12px] font-black text-[#1a1a1a] uppercase tracking-[0.12em]">Sessions</span>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#1a1a1a] hover:bg-[#f5f5f5] transition-all"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <SessionList {...sharedProps} onClose={() => setIsOpen(false)} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── MOBILE backdrop ── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="mobile-backdrop"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={handleMobileClose}
                    />
                )}
            </AnimatePresence>

            {/* ── MOBILE bottom sheet ── */}
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
                    <div
                        className="flex flex-col items-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
                        style={{ touchAction: "none" }}
                        onPointerDown={(e) => dragControls.start(e)}
                    >
                        <div className="w-10 h-[5px] rounded-full bg-[#ddd]" />
                    </div>

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
                            <X size={14} />
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
