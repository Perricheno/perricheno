"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { IconX, IconLoader2, IconFileText, IconBook, IconPresentation, IconSchool } from "@tabler/icons-react";
import type { Compiler } from "@/lib/space-db";

const TEMPLATES = [
    { id: "blank",    label: "Blank",           desc: "Empty document",              icon: IconFileText },
    { id: "research", label: "Research Paper",  desc: "APA citations + sections",    icon: IconBook },
    { id: "thesis",   label: "Thesis / Diploma", desc: "Report class, TOC, chapters", icon: IconSchool },
    { id: "beamer",   label: "Presentation",    desc: "Beamer slides",               icon: IconPresentation },
] as const;

const COMPILERS: { id: Compiler; label: string; note: string }[] = [
    { id: "pdflatex", label: "pdfLaTeX",  note: "Fastest, widest compat." },
    { id: "xelatex",  label: "XeLaTeX",   note: "Unicode, system fonts" },
    { id: "lualatex", label: "LuaLaTeX",  note: "Programmable, modern" },
];

interface Props {
    onClose: () => void;
    onCreate: (title: string, template: string, compiler: Compiler) => Promise<void>;
}

export default function NewSpaceModal({ onClose, onCreate }: Props) {
    const [title, setTitle]       = useState("Untitled Project");
    const [template, setTemplate] = useState<string>("blank");
    const [compiler, setCompiler] = useState<Compiler>("pdflatex");
    const [loading, setLoading]   = useState(false);

    const handleCreate = async () => {
        if (!title.trim() || loading) return;
        setLoading(true);
        try { await onCreate(title.trim(), template, compiler); }
        finally { setLoading(false); }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
                    <h2 className="text-[14px] font-black uppercase tracking-widest">New Project</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-black transition-colors">
                        <IconX className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Title */}
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Project title</label>
                        <input
                            autoFocus
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            className="w-full px-3.5 py-2.5 border border-[#e5e5e5] rounded-xl text-sm outline-none focus:border-black transition-colors"
                            placeholder="My Research Paper"
                        />
                    </div>

                    {/* Template */}
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Template</label>
                        <div className="grid grid-cols-2 gap-2">
                            {TEMPLATES.map(t => {
                                const Icon = t.icon;
                                const active = template === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => setTemplate(t.id)}
                                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                            active
                                                ? 'border-black bg-black text-white'
                                                : 'border-[#e5e5e5] hover:border-gray-300 bg-white'
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-white' : 'text-gray-400'}`} />
                                        <div>
                                            <p className={`text-[12px] font-bold ${active ? 'text-white' : 'text-black'}`}>{t.label}</p>
                                            <p className={`text-[11px] ${active ? 'text-gray-300' : 'text-gray-400'}`}>{t.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Compiler */}
                    <div>
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Compiler</label>
                        <div className="flex gap-2">
                            {COMPILERS.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setCompiler(c.id)}
                                    className={`flex-1 py-2 px-3 rounded-xl border text-center transition-all ${
                                        compiler === c.id
                                            ? 'border-black bg-black text-white'
                                            : 'border-[#e5e5e5] hover:border-gray-300'
                                    }`}
                                >
                                    <p className={`text-[12px] font-bold ${compiler === c.id ? 'text-white' : 'text-black'}`}>{c.label}</p>
                                    <p className={`text-[10px] ${compiler === c.id ? 'text-gray-300' : 'text-gray-400'}`}>{c.note}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-[#f0f0f0] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#e5e5e5] text-[12px] font-bold text-gray-600 hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!title.trim() || loading}
                        className="px-5 py-2 rounded-xl bg-black text-white text-[12px] font-bold uppercase tracking-widest hover:bg-[#1a1a1a] transition-all disabled:opacity-40 flex items-center gap-2 active:scale-95"
                    >
                        {loading ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Create
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
