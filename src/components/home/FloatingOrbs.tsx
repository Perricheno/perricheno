"use client";

import { motion } from "framer-motion";

// ── Floating Orbs ──────────────────────────────────────────────────────────────
// Subtle animated glows that drift around the CTA section
const orbs = [
    { size: 200, color: "#10b98115", left: "12%",  top: "20%",  duration: 7,  delay: 0   },
    { size: 140, color: "#f59e0b0d", left: "68%",  top: "55%",  duration: 9,  delay: 1.2 },
    { size: 100, color: "#ffffff08", left: "42%",  top: "70%",  duration: 6,  delay: 0.6 },
    { size: 80,  color: "#10b98110", left: "82%",  top: "15%",  duration: 8,  delay: 2   },
];

export function FloatingOrbs() {
    return (
        <>
            {orbs.map((orb, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        width: orb.size,
                        height: orb.size,
                        background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                        left: orb.left,
                        top: orb.top,
                        filter: "blur(2px)",
                    }}
                    animate={{ x: [0, 18, -10, 0], y: [0, -14, 10, 0], scale: [1, 1.08, 0.95, 1] }}
                    transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
                />
            ))}
        </>
    );
}
