"use client";

import { useTranslations } from "next-intl";
import { SectionLabel, FaqItem } from "./primitives";
import { FAQ } from "./constants";

// ── FAQ Section ────────────────────────────────────────────────────────────────
export function FaqSection() {
    const t = useTranslations("home");

    return (
        <section id="faq" className="py-24 md:py-32 border-t border-[var(--border)]">
            <SectionLabel>{t("faq.label")}</SectionLabel>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 max-w-3xl leading-[1.05]">
                {t("faq.h1")}
            </h2>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05] opacity-30">
                {t("faq.h2")}
            </h2>
            <div className="max-w-3xl">
                {FAQ.map((_, i) => (
                    <FaqItem
                        key={i}
                        q={t(`faq.items.${i}.q` as any)}
                        a={t(`faq.items.${i}.a` as any)}
                    />
                ))}
            </div>
        </section>
    );
}
