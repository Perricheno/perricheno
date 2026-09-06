"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState, useRef, type ReactNode } from "react";
import { useMotionValue, useSpring } from "framer-motion";

// ── Magnetic Button ────────────────────────────────────────────────────────────
// Follows cursor with spring physics for a premium, interactive feel
export function MagneticButton({ href, className, children }: { href: string; className: string; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 380, damping: 24 });
    const sy = useSpring(y, { stiffness: 380, damping: 24 });

    return (
        <motion.div
            ref={ref}
            style={{ x: sx, y: sy, display: "inline-block" }}
            onMouseMove={(e) => {
                if (!ref.current) return;
                const r = ref.current.getBoundingClientRect();
                x.set((e.clientX - (r.left + r.width / 2)) * 0.28);
                y.set((e.clientY - (r.top  + r.height / 2)) * 0.28);
            }}
            onMouseLeave={() => { x.set(0); y.set(0); }}
        >
            <Link href={href} className={className}>{children}</Link>
        </motion.div>
    );
}

// ── Section Label ──────────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
    return (
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4">
            {children}
        </p>
    );
}

// ── Nav Link ───────────────────────────────────────────────────────────────────
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <a href={href} className="relative group text-[13px] font-medium opacity-60 hover:opacity-100 transition-opacity">
            {children}
            <span className="absolute bottom-[-2px] left-0 h-[1px] w-0 bg-current transition-all duration-300 ease-out group-hover:w-full" />
        </a>
    );
}

// ── FAQ Item ───────────────────────────────────────────────────────────────────
export function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-[var(--border)]">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between gap-6 py-6 text-left"
            >
                <span className="text-base md:text-lg font-medium tracking-tight">{q}</span>
                <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}>
                    <ChevronDown className="w-5 h-5 opacity-40 shrink-0" />
                </motion.div>
            </button>
            <motion.div
                initial={false}
                animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
            >
                <p className="pb-6 text-[15px] leading-[1.8] opacity-70 font-light max-w-2xl">{a}</p>
            </motion.div>
        </div>
    );
}
