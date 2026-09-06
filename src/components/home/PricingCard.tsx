"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { RotatingBorderWrapper } from "./RotatingBorderWrapper";
import type { PLANS } from "./constants";
import type { PricingCurrency } from "./PricingSection";

// ── Pricing Card ───────────────────────────────────────────────────────────────
export function PricingCard({ plan, isAnnual, currency = 'kzt' }: {
    plan: typeof PLANS[number];
    isAnnual: boolean;
    currency?: PricingCurrency;
}) {
    const t = useTranslations("home");
    const isFree = plan.priceMonthly === 0;
    const showSavingBadge = isAnnual && !isFree;

    const price = currency === 'kzt'
        ? (isAnnual ? plan.priceKZTAnnual : plan.priceKZT)
        : currency === 'rub'
        ? (isAnnual ? plan.priceRUBAnnual : plan.priceRUB)
        : (isAnnual ? plan.priceAnnual : plan.priceMonthly);

    const symbol = currency === 'kzt' ? '₸' : currency === 'rub' ? '₽' : '$';
    const perPeriod = isAnnual ? t("pricing.perYear") : t("pricing.perMonth");

    const annualPerMonth = currency === 'kzt'
        ? `~${Math.round(plan.priceKZTAnnual / 12).toLocaleString('ru-RU')} ₸/${t("pricing.perMonth")}`
        : currency === 'rub'
        ? `~${Math.round(plan.priceRUBAnnual / 12).toLocaleString('ru-RU')} ₽/${t("pricing.perMonth")}`
        : `~$${(plan.priceAnnual / 12).toFixed(2)}/${t("pricing.perMonth")}`;

    const planName   = t(`pricing.plans.${plan.id}.name` as any);
    const planTagline = t(`pricing.plans.${plan.id}.tagline` as any);
    const planCta    = t(`pricing.plans.${plan.id}.cta` as any);
    const planTag    = (plan.id === 'pro' || plan.id === 'ultra')
        ? t(`pricing.plans.${plan.id}.tag` as any)
        : null;

    const translatedFeatures = plan.features.map((f, i) => ({
        ...f,
        text: t(`pricing.plans.${plan.id}.features.${i}` as any),
    }));

    const cardInner = (
        <div className="p-8 flex flex-col h-full">
            {/* Tag badge */}
            {(planTag || showSavingBadge) && (
                <div className={`absolute top-5 right-5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full z-10 ${
                    plan.id === "pro"   ? "bg-emerald-500 text-white" :
                    plan.id === "ultra" ? "bg-amber-400 text-black"  :
                    "bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)]"
                }`}>
                    {showSavingBadge ? t("pricing.monthsFree") : planTag}
                </div>
            )}

            {/* Header */}
            <div className="mb-6">
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5 ${plan.highlighted ? "opacity-50" : "opacity-40"}`}>
                    {planTagline}
                </p>
                <h3 className="text-2xl font-bold tracking-tight">{planName}</h3>
            </div>

            {/* Price */}
            <div className="mb-8">
                {isFree ? (
                    <div className="text-4xl md:text-5xl font-bold tracking-tighter">{symbol}0</div>
                ) : (
                    <>
                        <div className="flex items-end gap-1">
                            <span className={`text-lg font-bold mb-1 ${plan.highlighted ? "opacity-50" : "opacity-40"}`}>{symbol}</span>
                            <span className="text-4xl md:text-5xl font-bold tracking-tighter">
                                {currency === 'usd' ? price : price.toLocaleString('ru-RU')}
                            </span>
                            <span className={`text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 ${plan.highlighted ? "opacity-50" : "opacity-40"}`}>
                                /{perPeriod}
                            </span>
                        </div>
                        {isAnnual && (
                            <p className={`text-xs mt-1 ${plan.highlighted ? "opacity-40" : "opacity-40"}`}>
                                {annualPerMonth} {currency !== 'usd' && <span className="opacity-60">· via {currency === 'kzt' ? 'Kaspi' : 'Crypto'}</span>}
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8 flex-1">
                {translatedFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-[13px]">
                        {f.included ? (
                            <Check
                                className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? "text-emerald-400" : "opacity-60"}`}
                                strokeWidth={2.5}
                            />
                        ) : (
                            <Lock className="w-4 h-4 mt-0.5 shrink-0 opacity-20" strokeWidth={2} />
                        )}
                        <span className={f.included ? (plan.highlighted ? "opacity-90" : "opacity-80") : "opacity-30"}>
                            {f.text}
                        </span>
                    </li>
                ))}
            </ul>

            {/* CTA */}
            <Link
                href={plan.ctaHref}
                className={`w-full text-center py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 ${
                    plan.highlighted
                        ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-900/30"
                        : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-80"
                }`}
            >
                {planCta}
            </Link>
        </div>
    );

    if (plan.highlighted) {
        return <RotatingBorderWrapper>{cardInner}</RotatingBorderWrapper>;
    }

    return (
        <motion.div
            whileHover={{ y: -3, borderColor: "rgba(0,0,0,0.3)" }}
            transition={{ duration: 0.22 }}
            className="relative rounded-2xl flex flex-col overflow-hidden border border-[var(--border)] bg-[var(--card)] h-full"
        >
            {cardInner}
        </motion.div>
    );
}
