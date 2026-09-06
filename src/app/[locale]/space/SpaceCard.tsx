"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Ellipsis, Trash2, Copy, ExternalLink, Clock, Users } from "lucide-react";
import type { Space } from "@/lib/space-db";

const COMPILER_COLORS: Record<string, string> = {
    pdflatex: "bg-gray-100 text-gray-500",
    xelatex:  "bg-blue-50 text-blue-500",
    lualatex: "bg-violet-50 text-violet-500",
};

function timeAgo(iso: string | Date): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
}

interface Props {
    space: Space;
    onClick: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
}

export default function SpaceCard({ space, onClick, onDelete, onDuplicate }: Props) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const collabCount = (space as any).space_collaborators?.length ?? 0;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-2xl border border-[#e5e5e5] p-5 cursor-pointer group relative hover:shadow-md hover:border-[#c0c0c0] transition-all"
            onClick={onClick}
        >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-bold text-black truncate leading-tight mb-1">
                        {space.title}
                    </h3>
                    {space.description && (
                        <p className="text-[12px] text-gray-400 line-clamp-2 leading-snug">{space.description}</p>
                    )}
                </div>
                {/* Context menu */}
                <div ref={menuRef} className="relative shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => setMenuOpen(v => !v)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                        <Ellipsis className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.1 }}
                            className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-[#e5e5e5] shadow-lg py-1 z-30"
                        >
                            <button
                                onClick={() => { onDuplicate(); setMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-gray-600 hover:bg-[#f5f5f5] transition-colors"
                            >
                                <Copy className="w-4 h-4" /> Duplicate
                            </button>
                            <div className="my-1 border-t border-[#f0f0f0]" />
                            <button
                                onClick={() => { onDelete(); setMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${COMPILER_COLORS[space.compiler] ?? 'bg-gray-100 text-gray-500'}`}>
                        {space.compiler}
                    </span>
                    {collabCount > 1 && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                            <Users className="w-3 h-3" /> {collabCount}
                        </span>
                    )}
                </div>
                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock className="w-3 h-3" />
                    {timeAgo(space.updated_at)}
                </span>
            </div>
        </motion.div>
    );
}
