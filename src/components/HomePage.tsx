"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { useTranslations } from "next-intl";

import { MagneticButton, NavLink } from "./home/primitives";
import { LogoMarquee } from "./home/LogoMarquee";
import { HeroSection } from "./home/HeroSection";
import { FeaturesSection } from "./home/FeaturesSection";
import { HowItWorksSection } from "./home/HowItWorksSection";
import { PricingSection } from "./home/PricingSection";
import { SocialProofSection } from "./home/SocialProofSection";
import { FaqSection } from "./home/FaqSection";
import { FinalCtaSection } from "./home/FinalCtaSection";

// ── HomePage ───────────────────────────────────────────────────────────────────
// Orchestrates all home page sections. State (isAnnual) is lifted here so
// PricingSection can read and toggle it via props.
export default function HomePage() {
    const [isAnnual, setIsAnnual] = useState(true);
    const pricingRef = useRef<HTMLElement | null>(null);
    const t = useTranslations("home");

    return (
        <div className="min-h-full bg-[var(--background)] text-[var(--foreground)] selection:bg-black selection:text-white overflow-x-hidden">

            {/* DESIGN SPELL: Grain Overlay
                Fixed noise SVG filter adds premium texture depth.
                Mix-blend-mode overlay means it blends with both light & dark modes. */}
            <div
                className="pointer-events-none fixed inset-0 z-[999]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                    opacity: 0.028,
                    mixBlendMode: "overlay",
                }}
            />

            {/* NAV */}
            <nav className="sticky top-0 z-30 bg-[var(--background)]/80 backdrop-blur border-b border-[var(--border)]">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <Link href="/" className="text-sm font-bold tracking-tight">Perricheno</Link>
                    <div className="hidden md:flex items-center gap-8">
                        <NavLink href="#product">{t("nav.product")}</NavLink>
                        <NavLink href="#how">{t("nav.how")}</NavLink>
                        <NavLink href="#pricing">{t("nav.pricing")}</NavLink>
                        <NavLink href="#faq">{t("nav.faq")}</NavLink>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6">
                <HeroSection />

                {/* Logo Marquee */}
                <div className="py-10 border-t border-[var(--border)]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 mb-6 text-center">{t("poweredBy")}</p>
                    <LogoMarquee />
                </div>

                <FeaturesSection />
                <HowItWorksSection />

                <PricingSection
                    isAnnual={isAnnual}
                    onToggle={() => setIsAnnual(v => !v)}
                    sectionRef={pricingRef}
                />

                <SocialProofSection />
                <FaqSection />
                <FinalCtaSection />
            </div>
        </div>
    );
}
