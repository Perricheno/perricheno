"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import VisualCard from "./VisualCard";
import type { VisualEntry } from "./types";

interface Props {
    category: string;
    entries: VisualEntry[];
    selected: string;
    onSelect: (id: string) => void;
    defaultOpen?: boolean;
}

export default function CategorySection({ category, entries, selected, onSelect, defaultOpen = false }: Props) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="mb-1">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
            >
                <span>{category}</span>
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 gap-1 pb-1">
                            {entries.map(e => (
                                <VisualCard
                                    key={e.id}
                                    entry={e}
                                    selected={selected === e.id}
                                    onClick={() => onSelect(e.id)}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
