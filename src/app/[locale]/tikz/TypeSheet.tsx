"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconX } from "@tabler/icons-react";
import VisualCard from "./VisualCard";
import { VISUALS, CATEGORIES } from "./types";

interface Props {
    open: boolean;
    onClose: () => void;
    selected: string;
    onSelect: (id: string) => void;
}

export default function TypeSheet({ open, onClose, selected, onSelect }: Props) {
    const [activeCategory, setActiveCategory] = useState(
        VISUALS.find(v => v.id === selected)?.category ?? "Structure"
    );

    // Sync active category when sheet opens
    useEffect(() => {
        if (!open) return;
        const cat = VISUALS.find(v => v.id === selected)?.category;
        if (cat) setActiveCategory(cat);
    }, [open, selected]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={onClose}
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.8 }}
                        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl md:hidden flex flex-col"
                        style={{ maxHeight: "82dvh" }}
                    >
                        {/* Drag handle */}
                        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
                            <div className="w-8 h-1 rounded-full bg-[#e0e0e0]" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-4 pb-2 flex-shrink-0">
                            <p className="text-[13px] font-bold text-[#1a1a1a]">Diagram type</p>
                            <button onClick={onClose} className="p-1 text-gray-400 hover:text-[#1a1a1a] transition-colors">
                                <IconX size={18} />
                            </button>
                        </div>

                        {/* Category tabs */}
                        <div
                            className="flex gap-2 overflow-x-auto px-4 pb-3 flex-shrink-0"
                            style={{ scrollbarWidth: "none" }}
                        >
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors
                                        ${activeCategory === cat
                                            ? "bg-[#1a1a1a] text-white"
                                            : "bg-[#f5f5f5] text-[#555]"
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="h-px bg-[#f0f0f0] flex-shrink-0" />

                        {/* Type grid — scrollable */}
                        <div className="overflow-y-auto flex-1 px-4 py-3" style={{ overscrollBehavior: "contain" }}>
                            <div className="grid grid-cols-2 gap-2 pb-8">
                                {VISUALS.filter(v => v.category === activeCategory).map(entry => (
                                    <VisualCard
                                        key={entry.id}
                                        entry={entry}
                                        selected={selected === entry.id}
                                        onClick={() => { onSelect(entry.id); onClose(); }}
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
