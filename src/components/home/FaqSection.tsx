"use client";

import { SectionLabel, FaqItem } from "./primitives";
import { FAQ } from "./constants";

// ── FAQ Section ────────────────────────────────────────────────────────────────
export function FaqSection() {
    return (
        <section id="faq" className="py-24 md:py-32 border-t border-[var(--border)]">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 max-w-3xl leading-[1.05]">
                Frequently asked
            </h2>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05] opacity-30">
                questions.
            </h2>
            <div className="max-w-3xl">
                {FAQ.map(({ q, a }) => <FaqItem key={q} q={q} a={a} />)}
            </div>
        </section>
    );
}
