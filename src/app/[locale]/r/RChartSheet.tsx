"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from "framer-motion";
import { IconX } from "@tabler/icons-react";
import ChartCard from "./ChartCard";
import { CHARTS } from "./charts";

const SPRING = { type: "spring" as const, damping: 34, stiffness: 340, mass: 0.8 };
const TAGS = [...new Set(CHARTS.map(c => c.tag))];

interface Props {
    open: boolean;
    onClose: () => void;
    selectedCharts: string[];
    suggestedCharts: string[];
    onSelectChart: (id: string) => void;
    onClearCharts: () => void;
}

export default function RChartSheet({
    open, onClose, selectedCharts, suggestedCharts, onSelectChart, onClearCharts,
}: Props) {
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [snap, setSnap] = useState<"peek" | "full">("peek");

    const dragControls = useDragControls();
    const y = useMotionValue(0);

    useEffect(() => {
        if (open) {
            const peek = window.innerHeight * 0.44;
            setMounted(true);
            setSnap("peek");
            y.set(window.innerHeight);
            requestAnimationFrame(() => animate(y, peek, SPRING));
        } else if (mounted) {
            animate(y, window.innerHeight * 1.1, {
                ...SPRING,
                onComplete: () => setMounted(false),
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleClose = useCallback(() => {
        animate(y, window.innerHeight * 1.1, { ...SPRING, onComplete: onClose });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onClose]);

    const handleDragEnd = useCallback((_: any, info: any) => {
        const peek = window.innerHeight * 0.44;
        const cur = y.get();
        const vy = info.velocity.y;

        if (snap === "peek") {
            if (vy < -500 || cur < peek * 0.5) {
                setSnap("full");
                animate(y, 0, SPRING);
            } else if (vy > 600 || cur > peek + 120) {
                animate(y, window.innerHeight * 1.1, { ...SPRING, onComplete: onClose });
            } else {
                animate(y, peek, SPRING);
            }
        } else {
            if (vy > 500 || cur > 160) {
                setSnap("peek");
                animate(y, peek, SPRING);
            } else {
                animate(y, 0, SPRING);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [snap, onClose]);

    const filtered = activeTag ? CHARTS.filter(c => c.tag === activeTag) : CHARTS;

    if (!mounted) return null;

    return (
        <>
            {/* Backdrop */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 bg-black/40 z-40"
                        onClick={handleClose}
                    />
                )}
            </AnimatePresence>

            {/* Sheet */}
            <motion.div
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: window.innerHeight * 2 }}
                dragElastic={{ top: 0.06, bottom: 0.02 }}
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
                className="bg-white rounded-t-3xl shadow-2xl flex flex-col"
            >
                {/* Drag handle */}
                <div
                    className="flex flex-col items-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
                    style={{ touchAction: "none" }}
                    onPointerDown={(e) => dragControls.start(e)}
                >
                    <div className="w-10 h-[5px] rounded-full bg-[#ddd]" />
                </div>

                {/* Header — also draggable */}
                <div
                    className="flex items-center justify-between px-5 pb-3 flex-shrink-0"
                    style={{ touchAction: "none" }}
                    onPointerDown={(e) => dragControls.start(e)}
                >
                    <div>
                        <p className="text-[14px] font-bold text-[#1a1a1a]">Chart type</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {selectedCharts.length > 0
                                ? `${selectedCharts.length} selected · tap again to deselect`
                                : snap === "full" ? "Drag down to collapse" : "Drag up to expand"
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedCharts.length > 0 && (
                            <button
                                className="text-[11px] font-semibold text-gray-400 hover:text-[#1a1a1a] transition-colors px-2.5 py-1 rounded-lg bg-[#f0f0f0]"
                                onClick={onClearCharts}
                                onPointerDown={(e) => e.stopPropagation()}
                            >
                                Clear
                            </button>
                        )}
                        <button
                            onClick={handleClose}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#f0f0f0] text-gray-400 hover:text-[#1a1a1a] transition-colors"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <IconX size={14} />
                        </button>
                    </div>
                </div>

                {/* Tag chips */}
                <div
                    className="flex gap-2 overflow-x-auto px-4 pb-3 flex-shrink-0"
                    style={{ scrollbarWidth: "none" }}
                >
                    <button
                        onClick={() => setActiveTag(null)}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors
                            ${activeTag === null ? "bg-[#1a1a1a] text-white" : "bg-[#f0f0f0] text-[#555]"}`}
                    >
                        All
                    </button>
                    {TAGS.map(tag => (
                        <button
                            key={tag}
                            onClick={() => setActiveTag(prev => prev === tag ? null : tag)}
                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors
                                ${activeTag === tag ? "bg-[#1a1a1a] text-white" : "bg-[#f0f0f0] text-[#555]"}`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                <div className="h-px bg-[#ebebeb] flex-shrink-0" />

                {/* Chart grid */}
                <div
                    className="overflow-y-auto flex-1 px-4 py-3"
                    style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
                >
                    <div className="grid grid-cols-2 gap-2 pb-24">
                        {filtered.map(chart => (
                            <ChartCard
                                key={chart.id}
                                chart={chart}
                                selected={selectedCharts.includes(chart.id)}
                                suggested={suggestedCharts.includes(chart.id) && !selectedCharts.includes(chart.id)}
                                onClick={() => onSelectChart(chart.id)}
                            />
                        ))}
                    </div>
                </div>
            </motion.div>
        </>
    );
}
