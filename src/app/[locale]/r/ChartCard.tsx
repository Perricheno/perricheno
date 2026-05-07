"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChartEntry } from "./charts";

interface Props {
    chart: ChartEntry;
    selected: boolean;
    suggested: boolean;
    onClick: () => void;
}

export default function ChartCard({ chart, selected, suggested, onClick }: Props) {
    const [imgError, setImgError] = useState(false);
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`relative group text-left rounded-xl border transition-all duration-150 overflow-visible
                ${selected
                    ? "border-[#1a1a1a] bg-[#1a1a1a] shadow-sm"
                    : suggested
                        ? "border-[#1a1a1a] bg-[#f8f8f8] shadow-sm ring-1 ring-[#1a1a1a]/20"
                        : "border-[#ebebeb] bg-white hover:border-[#aaa] hover:shadow-sm"
                }`}
        >
            {/* Hover preview */}
            <AnimatePresence>
                {hovered && !selected && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        transition={{ duration: 0.14 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 pointer-events-none
                                   w-48 h-32 rounded-xl overflow-hidden shadow-xl border border-[#e8e8e8] bg-white"
                    >
                        {chart.preview && !imgError ? (
                            <img
                                src={chart.preview}
                                alt={chart.name}
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#f8f8f8]">
                                <span className="text-[10px] text-gray-300 font-medium">{chart.name}</span>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="px-3 py-2.5">
                <p className={`text-[11px] font-bold leading-tight ${selected ? "text-white" : "text-[#1a1a1a]"}`}>
                    {chart.name}
                </p>
                <p className={`text-[10px] mt-0.5 font-medium ${selected ? "text-gray-300" : suggested ? "text-[#555]" : "text-gray-400"}`}>
                    {suggested && !selected ? "✦ AI pick" : chart.tag}
                </p>
            </div>
        </button>
    );
}
