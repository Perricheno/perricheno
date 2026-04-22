"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconAlertTriangle, IconAlertCircle, IconInfoCircle,
    IconX, IconSparkles, IconLoader2,
} from "@tabler/icons-react";

interface LogEntry {
    type: 'error' | 'warning' | 'info';
    file: string | null;
    line: number | null;
    message: string;
    raw: string;
}

function parseLog(log: string): LogEntry[] {
    const lines = log.split('\n');
    const entries: LogEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];

        if (raw.startsWith('! ')) {
            entries.push({ type: 'error', file: null, line: null, message: raw.slice(2).trim(), raw });
            continue;
        }
        const lineRef = raw.match(/^l\.(\d+)\s+(.*)/);
        if (lineRef && entries.length > 0) {
            const last = entries[entries.length - 1];
            if (!last.line) { last.line = parseInt(lineRef[1]); last.message += ' — ' + lineRef[2].trim(); }
            continue;
        }
        const fileLine = raw.match(/^(\.\/[^\s:]+\.tex):(\d+):\s+(.*)/);
        if (fileLine) {
            entries.push({ type: 'error', file: fileLine[1].replace('./', ''), line: parseInt(fileLine[2]), message: fileLine[3].trim(), raw });
            continue;
        }
        if (/Warning:/i.test(raw)) {
            entries.push({ type: 'warning', file: null, line: null, message: raw.trim(), raw });
            continue;
        }
        if (/^(Over|Under)full/.test(raw)) {
            entries.push({ type: 'warning', file: null, line: null, message: raw.trim(), raw });
        }
    }
    return entries;
}

type Filter = 'all' | 'error' | 'warning';

interface Props {
    log: string;
    spaceId: string;
    activeFile?: string;
    activeCode?: string;
    onJumpToLine: (file: string, line: number) => void;
    onClose: () => void;
}

export default function CompilerLog({ log, spaceId, activeFile, activeCode, onJumpToLine, onClose }: Props) {
    const [filter, setFilter] = useState<Filter>('all');
    const [aiOpen, setAiOpen]   = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResult, setAiResult]   = useState<{ explanation: string; fix: string } | null>(null);

    const entries = useMemo(() => parseLog(log), [log]);
    const errors   = entries.filter(e => e.type === 'error');
    const warnings = entries.filter(e => e.type === 'warning');
    const shown = filter === 'all' ? entries : entries.filter(e => e.type === filter);

    const icons = {
        error:   <IconAlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
        warning: <IconAlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
        info:    <IconInfoCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />,
    };

    const askAi = async () => {
        if (aiLoading) return;
        setAiLoading(true);
        setAiOpen(true);
        setAiResult(null);
        const res = await fetch(`/api/space/${spaceId}/ai-fix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log, code: activeCode ?? '', filename: activeFile ?? 'main.tex' }),
        });
        if (res.ok) {
            const data = await res.json();
            setAiResult(data);
        } else {
            setAiResult({ explanation: 'AI fix failed. Please try again.', fix: '' });
        }
        setAiLoading(false);
    };

    return (
        <div className="flex flex-col h-full bg-[#141414] border-t border-[#2a2a2a]">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#2a2a2a] shrink-0">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Log</span>
                <div className="flex items-center gap-1 ml-1">
                    {(['all', 'error', 'warning'] as Filter[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${
                                filter === f ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-gray-400'
                            }`}
                        >
                            {f === 'all' ? `All (${entries.length})` : f === 'error' ? `Errors (${errors.length})` : `Warnings (${warnings.length})`}
                        </button>
                    ))}
                </div>

                {/* AI Fix button — only shown when there are errors */}
                {errors.length > 0 && (
                    <button
                        onClick={askAi}
                        disabled={aiLoading}
                        className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-[10px] font-bold uppercase tracking-wide transition-all disabled:opacity-60"
                    >
                        {aiLoading ? <IconLoader2 className="w-3 h-3 animate-spin" /> : <IconSparkles className="w-3 h-3" />}
                        AI Fix
                    </button>
                )}
                {errors.length === 0 && <div className="ml-auto" />}

                <button onClick={onClose} className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/5 transition-colors">
                    <IconX className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* AI result panel */}
            <AnimatePresence>
                {aiOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden shrink-0"
                    >
                        <div className="bg-violet-950/30 border-b border-violet-800/30 px-3 py-2.5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-violet-400 uppercase tracking-widest">
                                    <IconSparkles className="w-3 h-3" /> AI Suggestion
                                </span>
                                <button onClick={() => setAiOpen(false)} className="text-gray-600 hover:text-gray-400">
                                    <IconX className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {aiLoading ? (
                                <div className="flex items-center gap-2 py-1">
                                    <IconLoader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                                    <span className="text-[11px] text-gray-500">Analyzing error…</span>
                                </div>
                            ) : aiResult && (
                                <div className="space-y-2">
                                    <p className="text-[11px] text-gray-300 leading-relaxed">{aiResult.explanation}</p>
                                    {aiResult.fix && (
                                        <pre className="text-[11px] font-mono bg-black/40 rounded-lg p-2.5 text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre-wrap">{aiResult.fix}</pre>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Log entries */}
            <div className="flex-1 overflow-auto">
                {shown.length === 0 ? (
                    <div className="px-4 py-3">
                        <pre className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap font-mono">{log.slice(0, 3000)}</pre>
                    </div>
                ) : (
                    <div className="py-1">
                        {shown.map((entry, i) => (
                            <button
                                key={i}
                                onClick={() => entry.file && entry.line && onJumpToLine(entry.file, entry.line)}
                                className={`w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors ${
                                    entry.file && entry.line ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
                                }`}
                            >
                                {icons[entry.type]}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] text-gray-300 leading-snug">{entry.message}</p>
                                    {(entry.file || entry.line) && (
                                        <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
                                            {entry.file && <span>{entry.file}</span>}
                                            {entry.line && <span className="text-gray-500">:{entry.line}</span>}
                                        </p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
