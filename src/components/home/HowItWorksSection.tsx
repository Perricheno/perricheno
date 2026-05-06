"use client";

import { motion } from "framer-motion";
import { IconArrowUpRight } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { SectionLabel } from "./primitives";
import { STEPS } from "./constants";

// ── How It Works Section ───────────────────────────────────────────────────────
export function HowItWorksSection() {
    const t = useTranslations("home");

    return (
        <section id="how" className="py-24 md:py-32 border-t border-[var(--border)]">
            <SectionLabel>{t("how.label")}</SectionLabel>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 max-w-3xl leading-[1.05]">
                {t("how.h1")}
            </h2>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05] opacity-30">
                {t("how.h2")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
                {STEPS.map(({ n }, i) => (
                    <motion.div
                        key={n}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ y: -4 }}
                        className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 md:p-10 overflow-hidden group hover:border-black/20 transition-all duration-300"
                    >
                        {/* Ghost step number creates depth */}
                        <div
                            className="absolute -right-5 -bottom-8 font-black leading-none select-none pointer-events-none"
                            style={{ fontSize: "clamp(100px, 14vw, 160px)", opacity: 0.04 }}
                        >
                            {n}
                        </div>

                        <div className="relative z-10">
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 mb-8">{n}</div>
                            <h3 className="text-xl font-bold tracking-tight mb-3">
                                {t(`how.steps.${i}.title` as any)}
                            </h3>
                            <p className="text-[14px] leading-relaxed opacity-60 font-light">
                                {t(`how.steps.${i}.desc` as any)}
                            </p>
                        </div>

                        {/* Step connector arrow (not on last) */}
                        {i < 2 && (
                            <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-[var(--background)] border border-[var(--border)] rounded-full items-center justify-center">
                                <IconArrowUpRight className="w-3 h-3 opacity-40 rotate-45" />
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
