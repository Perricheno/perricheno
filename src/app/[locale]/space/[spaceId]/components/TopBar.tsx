"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconChevronLeft, IconLoader2, IconPlayerPlay,
    IconCheck, IconAlertTriangle, IconSettings,
    IconHistory, IconShare, IconBookmark, IconDownload, IconUserPlus,
    IconChevronDown,
} from "@tabler/icons-react";
import type { Space, Compiler } from "@/lib/space-db";

type CompileStatus = 'idle' | 'compiling' | 'success' | 'error';

const COMPILER_LABELS: Record<Compiler, string> = {
    pdflatex: 'pdfLaTeX',
    xelatex:  'XeLaTeX',
    lualatex: 'LuaLaTeX',
};

interface Props {
    space: Space;
    compileStatus: CompileStatus;
    autoCompile: boolean;
    onCompile: () => void;
    onToggleAutoCompile: () => void;
    onChangeCompiler: (c: Compiler) => void;
    onOpenSettings: () => void;
    onOpenHistory: () => void;
    onOpenShare: () => void;
    onSaveSnapshot: () => void;
    onOpenInvite: () => void;
    onExport: () => void;
    savingSnapshot: boolean;
    dirty: boolean;
    readOnly?: boolean;
}

export default function TopBar({
    space, compileStatus, autoCompile, onCompile,
    onToggleAutoCompile, onChangeCompiler,
    onOpenSettings, onOpenHistory, onOpenShare,
    onSaveSnapshot, onOpenInvite, onExport,
    savingSnapshot,
    dirty, readOnly,
}: Props) {
    const [compilerMenuOpen, setCompilerMenuOpen] = useState(false);

    const statusIcon = {
        idle:      null,
        compiling: <IconLoader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />,
        success:   <IconCheck className="w-3.5 h-3.5 text-emerald-500" />,
        error:     <IconAlertTriangle className="w-3.5 h-3.5 text-red-500" />,
    }[compileStatus];

    return (
        <header className="h-12 border-b border-[#2a2a2a] bg-[#1a1a1a] flex items-center px-3 gap-2 shrink-0">
            {/* Back */}
            <Link
                href="/space"
                className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
                <IconChevronLeft className="w-3.5 h-3.5" />
                <img src="/Vector.svg" alt="" className="w-3.5 h-3.5 opacity-40" />
            </Link>

            <div className="w-px h-4 bg-white/10" />

            {/* Project title */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-white truncate">{space.title}</span>
                {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1">
                {readOnly && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[10px] font-bold uppercase tracking-wider">Read-only</span>
                )}

                {!readOnly && (
                    <>
                        {/* Compiler picker */}
                        <div className="relative">
                            <button
                                onClick={() => setCompilerMenuOpen(v => !v)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-all uppercase tracking-wide"
                            >
                                {COMPILER_LABELS[space.compiler as Compiler] || space.compiler}
                                <IconChevronDown className="w-3 h-3" />
                            </button>
                            <AnimatePresence>
                                {compilerMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                                        transition={{ duration: 0.12 }}
                                        className="absolute right-0 top-full mt-1 w-40 bg-[#2a2a2a] border border-white/10 rounded-xl py-1 z-50 shadow-xl"
                                    >
                                        {(Object.entries(COMPILER_LABELS) as [Compiler, string][]).map(([id, label]) => (
                                            <button
                                                key={id}
                                                onClick={() => { onChangeCompiler(id); setCompilerMenuOpen(false); }}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-[12px] transition-colors ${
                                                    space.compiler === id
                                                        ? 'text-white bg-white/10'
                                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                            >
                                                <span className="font-bold">{label}</span>
                                                {space.compiler === id && <IconCheck className="w-3.5 h-3.5 text-emerald-400" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="w-px h-4 bg-white/10" />

                        {/* Auto-compile toggle */}
                        <button
                            onClick={onToggleAutoCompile}
                            title={`Auto-compile: ${autoCompile ? 'on' : 'off'}`}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${
                                autoCompile ? 'text-emerald-400 hover:bg-white/5' : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'
                            }`}
                        >
                            Auto
                        </button>

                        {/* Save snapshot */}
                        <button
                            onClick={onSaveSnapshot}
                            disabled={savingSnapshot}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
                            title="Save checkpoint"
                        >
                            {savingSnapshot
                                ? <IconLoader2 className="w-4 h-4 animate-spin" />
                                : <IconBookmark className="w-4 h-4" />
                            }
                        </button>

                        {/* History */}
                        <button
                            onClick={onOpenHistory}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                            title="Version history"
                        >
                            <IconHistory className="w-4 h-4" />
                        </button>

                        {/* Invite collaborator */}
                        <button
                            onClick={onOpenInvite}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                            title="Invite collaborator"
                        >
                            <IconUserPlus className="w-4 h-4" />
                        </button>

                        {/* Share */}
                        <button
                            onClick={onOpenShare}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                            title="Share public link"
                        >
                            <IconShare className="w-4 h-4" />
                        </button>

                        {/* Settings */}
                        <button
                            onClick={onOpenSettings}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                            title="Project settings"
                        >
                            <IconSettings className="w-4 h-4" />
                        </button>

                        <div className="w-px h-4 bg-white/10" />
                    </>
                )}

                {/* Export ZIP - available to all (owners, editors, viewers) */}
                <button
                    onClick={onExport}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                    title="Download as ZIP"
                >
                    <IconDownload className="w-4 h-4" />
                </button>


                {/* Compile button */}
                <button
                    onClick={onCompile}
                    disabled={compileStatus === 'compiling'}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black rounded-lg text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                >
                    {compileStatus === 'compiling'
                        ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                        : <IconPlayerPlay className="w-3.5 h-3.5" />
                    }
                    {compileStatus === 'compiling' ? 'Compiling…' : 'Compile'}
                </button>

                {statusIcon && (
                    <motion.div key={compileStatus} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>
                        {statusIcon}
                    </motion.div>
                )}
            </div>
        </header>
    );
}
