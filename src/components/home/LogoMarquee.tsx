"use client";

import { motion } from "framer-motion";
import { LOGOS } from "./constants";

// ── Logo Marquee ───────────────────────────────────────────────────────────────
// Infinite smooth scroll with fade-edge vignette
export function LogoMarquee() {
    const tripled = [...LOGOS, ...LOGOS, ...LOGOS];
    return (
        <div className="relative overflow-hidden">
            {/* Fade vignette */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10"
                 style={{ background: "linear-gradient(to right, var(--background), transparent)" }} />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10"
                 style={{ background: "linear-gradient(to left, var(--background), transparent)" }} />
            <motion.div
                animate={{ x: ["0%", "-33.333%"] }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
                className="flex gap-16 w-max"
            >
                {tripled.map((l, i) => (
                    <span key={`${l}-${i}`}
                          className="text-[13px] font-bold tracking-tight select-none"
                          style={{ opacity: 0.22 }}>
                        {l}
                    </span>
                ))}
            </motion.div>
        </div>
    );
}
