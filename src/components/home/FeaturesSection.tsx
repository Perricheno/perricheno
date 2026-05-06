"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SectionLabel } from "./primitives";
import { FEATURES } from "./constants";

// ── Features Section ───────────────────────────────────────────────────────────
export function FeaturesSection() {
    const t = useTranslations("home");

    return (
        <section id="product" className="py-24 md:py-32 border-t border-[var(--border)]">
            <SectionLabel>{t("product.label")}</SectionLabel>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 max-w-3xl leading-[1.05]">
                {t("product.h1")}
            </h2>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05] opacity-30">
                {t("product.h2")}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)] rounded-2xl overflow-hidden">
                {FEATURES.map(({ icon: Icon }, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.06 }}
                        whileHover="hovered"
                        className="group relative bg-[var(--card)] p-8 md:p-10 flex flex-col min-h-[220px] overflow-hidden cursor-default transition-colors duration-300 hover:bg-[var(--background)]"
                    >
                        {/* DESIGN SPELL: sweep highlight on hover */}
                        <motion.div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"
                            style={{ background: "linear-gradient(135deg, transparent 40%, rgba(16,185,129,0.04) 100%)" }}
                        />

                        {/* Icon lifts and brightens on hover */}
                        <motion.div
                            variants={{ hovered: { y: -4, opacity: 1 } }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="w-6 h-6 mb-6 opacity-60"
                        >
                            <Icon className="w-6 h-6" stroke={1.5} />
                        </motion.div>

                        <h3 className="text-lg font-bold tracking-tight mb-3">
                            {t(`product.features.${i}.title` as any)}
                        </h3>
                        <p className="text-[14px] leading-relaxed opacity-60 font-light">
                            {t(`product.features.${i}.desc` as any)}
                        </p>

                        {/* Bottom accent line appears on hover */}
                        <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-emerald-500/40 group-hover:w-full transition-all duration-500 ease-out" />
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
