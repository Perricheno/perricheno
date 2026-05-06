"use client";

import { useRef, useEffect, type ReactNode } from "react";

// ── Rotating gradient border (Pro card) ───────────────────────────────────────
// RAF-driven conic-gradient spins around the pro pricing card border
export function RotatingBorderWrapper({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let raf: number;
        let angle = 0;
        const tick = () => {
            angle = (angle + 0.45) % 360;
            if (ref.current) {
                ref.current.style.background =
                    `conic-gradient(from ${angle}deg at 50% 50%, #059669 0%, #064e3b 25%, #0a0a0a 50%, #064e3b 75%, #059669 100%)`;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);
    return (
        <div ref={ref} className="p-[1.5px] rounded-[18px] relative lg:scale-[1.04] z-10 h-full">
            <div className="rounded-[16px] bg-[#080808] text-white overflow-hidden h-full">
                {children}
            </div>
        </div>
    );
}
