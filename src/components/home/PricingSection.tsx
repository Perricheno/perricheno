"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { SectionLabel } from "./primitives";
import { PricingCard } from "./PricingCard";
import { PLANS } from "./constants";

export type PricingCurrency = 'kzt' | 'usd' | 'rub';

interface PricingSectionProps {
    isAnnual: boolean;
    onToggle: () => void;
    sectionRef: React.RefObject<HTMLElement | null>;
}

const CURRENCY_OPTIONS: { id: PricingCurrency; label: string }[] = [
    { id: 'kzt', label: '₸' },
    { id: 'usd', label: '$' },
    { id: 'rub', label: '₽' },
];

// ── Pricing Section ────────────────────────────────────────────────────────────
export function PricingSection({ isAnnual, onToggle, sectionRef }: PricingSectionProps) {
    const [currency, setCurrency] = useState<PricingCurrency>('kzt');
    const t = useTranslations("home");

    return (
        <section id="pricing" className="py-24 md:py-32 border-t border-[var(--border)]" ref={sectionRef}>
            <SectionLabel>{t("pricing.label")}</SectionLabel>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-2 max-w-3xl leading-[1.05]">
                {t("pricing.h1")}
            </h2>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 max-w-3xl leading-[1.05] opacity-30">
                {t("pricing.h2")}
            </h2>
            <p className="text-base md:text-lg opacity-60 font-light max-w-2xl mb-10">
                {t("pricing.desc")}
            </p>

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-4 mb-12">
                {/* Period toggle */}
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold transition-opacity ${!isAnnual ? "opacity-100" : "opacity-40"}`}>
                        {t("pricing.monthly")}
                    </span>
                    <button
                        onClick={onToggle}
                        className="relative w-12 h-6 bg-[var(--foreground)] rounded-full p-1"
                        aria-label="Toggle billing period"
                    >
                        <motion.div
                            layout
                            animate={{ x: isAnnual ? 24 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="w-4 h-4 bg-[var(--background)] rounded-full shadow-md"
                        />
                    </button>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold transition-opacity ${isAnnual ? "opacity-100" : "opacity-40"}`}>
                            {t("pricing.annual")}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider">
                            {t("pricing.save20")}
                        </span>
                    </div>
                </div>

                {/* Currency switcher */}
                <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full p-1 ml-auto">
                    {CURRENCY_OPTIONS.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setCurrency(c.id)}
                            className={`w-9 h-7 rounded-full text-sm font-bold transition-all ${
                                currency === c.id
                                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                                    : 'opacity-40 hover:opacity-70'
                            }`}
                            aria-label={c.id.toUpperCase()}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                {PLANS.map((plan, i) => (
                    <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.08 }}
                        className="flex flex-col"
                    >
                        <PricingCard plan={plan} isAnnual={isAnnual} currency={currency} />
                    </motion.div>
                ))}
            </div>

            <p className="text-[12px] opacity-40 mt-8 text-center max-w-xl mx-auto">
                {t("pricing.footnote")}
            </p>
        </section>
    );
}
