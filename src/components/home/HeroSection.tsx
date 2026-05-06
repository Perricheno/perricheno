"use client";

import { motion } from "framer-motion";
import { IconArrowUpRight, IconBrandTelegram } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { MagneticButton } from "./primitives";

// ── Hero Section ───────────────────────────────────────────────────────────────
export function HeroSection() {
    const t = useTranslations("home");

    return (
        <header className="pt-20 md:pt-32 pb-24 md:pb-40">
            <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-4xl"
            >
                {/* ── DO NOT MODIFY THIS HEADLINE STRUCTURE ── */}
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] mb-8">
                    {t("hero.headline1")} <br />
                    {t("hero.headline2")}{" "}
                    <br className="hidden md:block" />
                    <span className="opacity-30">{t("hero.headline3")}</span>
                </h1>

                <p className="text-lg md:text-xl leading-relaxed opacity-60 font-light max-w-2xl mb-12">
                    {t("hero.desc")}
                </p>

                <div className="flex flex-wrap gap-3 items-center">
                    <MagneticButton
                        href="/agent"
                        className="inline-flex items-center gap-3 bg-[var(--foreground)] text-[var(--background)] px-6 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:opacity-80 transition-all active:scale-95 shadow-sm"
                    >
                        {t("hero.launchAgent")} <IconArrowUpRight className="w-4 h-4" />
                    </MagneticButton>
                    <MagneticButton
                        href="#pricing"
                        className="inline-flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] px-6 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:border-current transition-all"
                    >
                        {t("hero.seePricing")}
                    </MagneticButton>
                    <div className="flex items-center gap-2 pl-2 opacity-50">
                        <IconBrandTelegram className="w-4 h-4" />
                        <span className="text-[11px] font-medium">{t("hero.viaTelegram")}</span>
                    </div>
                </div>
            </motion.div>

            {/* Stat strip */}
            <div className="mt-20 md:mt-28 grid grid-cols-2 md:grid-cols-4 gap-8 pt-10 border-t border-[var(--border)]">
                {[
                    ["arXiv + OpenAlex", t("hero.stats.searchIndexes")],
                    ["R · Python",       t("hero.stats.vizRuntimes")],
                    ["LaTeX",            t("hero.stats.nativeCompiler")],
                    ["EN · RU",          t("hero.stats.docLanguages")],
                ].map(([v, l], i) => (
                    <motion.div
                        key={l}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="text-lg md:text-2xl font-bold tracking-tight">{v}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-2">{l}</div>
                    </motion.div>
                ))}
            </div>
        </header>
    );
}
