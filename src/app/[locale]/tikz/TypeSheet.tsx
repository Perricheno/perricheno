"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from "framer-motion";
import { X } from "lucide-react";
import VisualCard from "./VisualCard";
import { VISUALS, CATEGORIES } from "./types";

const SPRING = { type: "spring" as const, damping: 34, stiffness: 340, mass: 0.8 };

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
    const [mounted, setMounted] = useState(false);
    const [snap, setSnap] = useState<"peek" | "full">("peek");

    const dragControls = useDragControls();
    const y = useMotionValue(0);

    useEffect(() => {
        if (!open) return;
        const cat = VISUALS.find(v => v.id === selected)?.category;
        if (cat) setActiveCategory(cat);
    }, [open, selected]);

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
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={handleClose}
                    />
                )}
            </AnimatePresence>

            {/* Sheet — full 95dvh, y-translated to peek or full */}
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
                className="bg-white rounded-t-3xl shadow-2xl md:hidden flex flex-col"
            >
                {/* Drag handle — only zone that starts drag */}
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
                        <p className="text-[14px] font-bold text-[#1a1a1a]">Diagram type</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {snap === "full" ? "Drag down to collapse" : "Drag up to expand"}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-[#f0f0f0] text-gray-400 hover:text-[#1a1a1a] transition-colors"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <X size={14} />
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
                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold transition-colors
                                ${activeCategory === cat
                                    ? "bg-[#1a1a1a] text-white"
                                    : "bg-[#f0f0f0] text-[#555]"
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="h-px bg-[#ebebeb] flex-shrink-0" />

                {/* Scrollable card grid */}
                <div
                    className="overflow-y-auto flex-1 px-4 py-3"
                    style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
                >
                    <div className="grid grid-cols-2 gap-2 pb-8">
                        {VISUALS.filter(v => v.category === activeCategory).map(entry => (
                            <VisualCard
                                key={entry.id}
                                entry={entry}
                                selected={selected === entry.id}
                                onClick={() => { onSelect(entry.id); handleClose(); }}
                            />
                        ))}
                    </div>
                </div>
            </motion.div>
        </>
    );
}
