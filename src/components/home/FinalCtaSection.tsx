"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { IconArrowUpRight } from "@tabler/icons-react";
import { MagneticButton } from "./primitives";
import { FloatingOrbs } from "./FloatingOrbs";

// ── Final CTA Section + Footer ─────────────────────────────────────────────────
export function FinalCtaSection() {
    return (
        <>
            <section className="py-24 md:py-32 border-t border-[var(--border)]">
                <div className="relative bg-black text-white rounded-3xl p-12 md:p-20 text-center overflow-hidden">

                    {/* Subtle grid */}
                    <div
                        className="absolute inset-0 opacity-[0.035]"
                        style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }}
                    />

                    <FloatingOrbs />

                    <div className="relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-6">Ready to start?</p>
                            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-4 max-w-3xl mx-auto leading-[1.05]">
                                Stop wrestling with LaTeX.
                            </h2>
                            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-8 max-w-3xl mx-auto leading-[1.05] opacity-40">
                                Start writing.
                            </h2>
                            <p className="text-base md:text-lg opacity-50 font-light max-w-xl mx-auto mb-10">
                                Free to try. No credit card. One Telegram tap and you're in the agent.
                            </p>
                            <div className="flex flex-wrap gap-3 justify-center">
                                <MagneticButton
                                    href="/agent"
                                    className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95"
                                >
                                    Launch Agent <IconArrowUpRight className="w-4 h-4" />
                                </MagneticButton>
                                <MagneticButton
                                    href="#pricing"
                                    className="inline-flex items-center gap-3 border border-white/20 text-white px-8 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:border-white/50 transition-all"
                                >
                                    View pricing
                                </MagneticButton>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            <footer className="py-16 border-t border-[var(--border)] flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                    <p className="text-sm font-bold tracking-tight mb-1">Perricheno</p>
                    <p className="text-[11px] font-bold uppercase tracking-widest opacity-30">
                        © 2026 Perricheno Inc. · All rights reserved
                    </p>
                </div>
                <div className="flex gap-8 text-[11px] font-bold uppercase tracking-widest">
                    <Link href="/terms"   className="opacity-40 hover:opacity-100 transition-opacity">Terms</Link>
                    <Link href="/privacy" className="opacity-40 hover:opacity-100 transition-opacity">Privacy</Link>
                    <a href="mailto:support@perricheno.ru" className="opacity-40 hover:opacity-100 transition-opacity">Support</a>
                </div>
            </footer>
        </>
    );
}
