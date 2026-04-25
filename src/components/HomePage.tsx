"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
    IconArrowUpRight,
    IconFileText,
    IconBook2,
    IconChartBar,
    IconMessageCircle,
    IconFileTypePdf,
    IconCode,
    IconCheck,
    IconChevronDown,
    IconLock,
    IconSparkles,
    IconBolt,
    IconBrandTelegram,
} from "@tabler/icons-react";
import { useState, useRef } from "react";

// ── Plans — mirrors BillingsPage exactly ──
const PLANS = [
    {
        id: "free",
        name: "Free",
        tagline: "The Sandbox",
        priceMonthly: 0,
        priceAnnual: 0,
        highlighted: false,
        tag: null,
        accent: "#666",
        features: [
            { text: "50,000 tokens / week", included: true },
            { text: "150,000 tokens / month", included: true },
            { text: "Basic Python (5 chart types)", included: true },
            { text: "Scholar search & PDF tools", included: true },
            { text: "7-day chat retention", included: true },
            { text: "ZIP Project Export", included: false },
            { text: "R Environment (CRAN)", included: false },
            { text: "AI Code Editing", included: false },
        ],
        cta: "Start free",
        ctaHref: "/agent",
    },
    {
        id: "plus",
        name: "Plus",
        tagline: "Standard",
        priceMonthly: 3.99,
        priceAnnual: 39.00,
        highlighted: false,
        tag: null,
        accent: "#a8a8a8",
        features: [
            { text: "150,000 tokens / week", included: true },
            { text: "450,000 tokens / month", included: true },
            { text: "Full Python (35+ visualizations)", included: true },
            { text: "ZIP Project Export unlocked", included: true },
            { text: "Priority rendering", included: true },
            { text: "14-day chat retention", included: true },
            { text: "R Environment", included: false },
            { text: "AI Code Editing", included: false },
        ],
        cta: "Get Plus",
        ctaHref: "/agent",
    },
    {
        id: "pro",
        name: "Pro",
        tagline: "Researcher",
        priceMonthly: 7.99,
        priceAnnual: 69.00,
        highlighted: true,
        tag: "Popular",
        accent: "#10b981",
        features: [
            { text: "250,000 tokens / week", included: true },
            { text: "800,000 tokens / month", included: true },
            { text: "R-Infrastructure + Python stack", included: true },
            { text: "AI Code Editor enabled", included: true },
            { text: "Share reports via link", included: true },
            { text: "Exclusive power giveaways", included: true },
            { text: "30-day chat retention", included: true },
        ],
        cta: "Get Pro",
        ctaHref: "/agent",
    },
    {
        id: "ultra",
        name: "Ultra",
        tagline: "Absolute Power",
        priceMonthly: 14.99,
        priceAnnual: 149.00,
        highlighted: false,
        tag: "Best Value",
        accent: "#f59e0b",
        features: [
            { text: "800,000 tokens / week (Cap)", included: true },
            { text: "3,000,000 tokens / month", included: true },
            { text: "AI Edit: Low Cost Mode (÷2)", included: true },
            { text: "2× bonus on referrals & promos", included: true },
            { text: "Maximum rendering priority", included: true },
            { text: "All giveaways & events", included: true },
            { text: "90-day chat retention", included: true },
        ],
        cta: "Get Ultra",
        ctaHref: "/agent",
    },
] as const;

// ── Features ──
const FEATURES = [
    {
        icon: IconFileText,
        title: "Research Writer",
        desc: "Full LaTeX documents — research papers, theses, reports - compiled straight to PDF with real citations.",
    },
    {
        icon: IconBook2,
        title: "Scholar Search",
        desc: "Query arXiv and OpenAlex in any language. Relevance-ranked results with abstracts, authors, DOIs.",
    },
    {
        icon: IconChartBar,
        title: "Data Analytics",
        desc: "Turn a question into R or Python visualizations. Upload a dataset, pick a chart, get publication-ready figures.",
    },
    {
        icon: IconMessageCircle,
        title: "Multimodal Chat",
        desc: "Fast Q&A with text, images, and file context. Perfect for quick explanations, rewrites, and outlines.",
    },
    {
        icon: IconCode,
        title: "LaTeX Compiler",
        desc: "Built-in pipeline compiles .tex to PDF with bib, figures, and multi-column layouts. Errors auto-repaired.",
    },
    {
        icon: IconFileTypePdf,
        title: "PDF Toolkit",
        desc: "OCR scanned papers, convert PDF ↔ DOCX, extract text for referencing. All in one workspace.",
    },
] as const;

// ── Steps ──
const STEPS = [
    { n: "01", title: "Describe the task", desc: "Topic, word count, language, style, references. Attach source files if you have them." },
    { n: "02", title: "Agent works", desc: "Structure, draft, cite, visualize. Watch progress stream in real time." },
    { n: "03", title: "Download or iterate", desc: "Compiled PDF, LaTeX source, shareable link. Edit any section on demand." },
] as const;

// ── FAQ ──
const FAQ = [
    {
        q: "How do I sign in?",
        a: "Through the Telegram Login Widget. No passwords, no email — one tap opens the agent with your account attached.",
    },
    {
        q: "How is usage billed?",
        a: "The free tier resets daily and weekly. Paid plans are billed monthly or annually (save ~20%). Payment is via CryptoCloud (crypto).",
    },
    {
        q: "Can I use it in Russian?",
        a: "Yes. Documents can be generated in English or Russian, and Scholar understands any language — queries are translated to English keywords before hitting academic indexes.",
    },
    {
        q: "Do you store my uploaded files?",
        a: "Uploaded task descriptions and reference files are used only to generate your document. Session text is stored on your account so you can reopen and edit it; you can delete any session at any time.",
    },
    {
        q: "What formats do I get back?",
        a: "Compiled PDF, the raw LaTeX source (.tex + bib), and a shareable public link. Visuals download as PNG with the R/Python source embedded.",
    },
    {
        q: "Is there an API?",
        a: "Not publicly yet. If you need programmatic access for a lab or classroom, get in touch.",
    },
] as const;

// ── Social proof logos (text-based) ──
const LOGOS = ["arXiv", "OpenAlex", "LaTeX", "R CRAN", "Python", "CryptoCloud"] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4">
            {children}
        </p>
    );
}

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-[var(--border)]">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between gap-6 py-6 text-left group"
            >
                <span className="text-base md:text-lg font-medium tracking-tight">{q}</span>
                <IconChevronDown
                    className={`w-5 h-5 opacity-40 shrink-0 transition-transform duration-300 ${open ? "rotate-180 opacity-100" : ""}`}
                />
            </button>
            <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                    <p className="pb-6 text-[15px] leading-[1.8] opacity-70 font-light max-w-2xl">{a}</p>
                </div>
            </div>
        </div>
    );
}

function PricingCard({ plan, isAnnual }: { plan: typeof PLANS[number]; isAnnual: boolean }) {
    const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;
    const isFree = plan.priceMonthly === 0;

    return (
        <div
            className={`relative rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${
                plan.highlighted
                    ? "bg-black text-white border border-emerald-500/30 shadow-2xl shadow-emerald-900/10 lg:scale-[1.04] z-10"
                    : "bg-[var(--card)] border border-[var(--border)] hover:border-black/30"
            }`}
        >
            {/* Top accent line */}
            {plan.highlighted && (
                <div className="h-[2px] w-full" style={{ background: plan.accent }} />
            )}

            {/* Tag */}
            {plan.tag && (
                <div className={`absolute top-5 right-5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full ${
                    plan.id === "pro" ? "bg-emerald-500 text-white" :
                    plan.id === "ultra" ? "bg-amber-400 text-black" :
                    "bg-gray-200 text-gray-600"
                }`}>
                    {isAnnual && !isFree ? "2 months free" : plan.tag}
                </div>
            )}
            {isAnnual && !isFree && !plan.tag && (
                <div className="absolute top-5 right-5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-amber-400 text-black">
                    2 months free
                </div>
            )}

            <div className="p-8 md:p-8 flex flex-col flex-1">
                {/* Header */}
                <div className="mb-6">
                    <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5 ${plan.highlighted ? "opacity-50" : "opacity-40"}`}>
                        {plan.tagline}
                    </p>
                    <h3 className="text-2xl font-bold tracking-tight">{plan.name}</h3>
                </div>

                {/* Price */}
                <div className="mb-8">
                    {isFree ? (
                        <div className="text-4xl md:text-5xl font-bold tracking-tighter">$0</div>
                    ) : (
                        <div>
                            <div className="flex items-end gap-1">
                                <span className={`text-lg font-bold mb-1 ${plan.highlighted ? "opacity-50" : "opacity-40"}`}>$</span>
                                <span className="text-4xl md:text-5xl font-bold tracking-tighter">{price}</span>
                                <span className={`text-[11px] font-bold uppercase tracking-wider mb-2 ml-1 ${plan.highlighted ? "opacity-50" : "opacity-40"}`}>
                                    /{isAnnual ? "yr" : "mo"}
                                </span>
                            </div>
                            {isAnnual && (
                                <p className={`text-xs mt-1 ${plan.highlighted ? "opacity-40" : "opacity-40"}`}>
                                    ~${(plan.priceAnnual / 12).toFixed(2)}/mo billed annually
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-3 text-[13px]">
                            {f.included ? (
                                <IconCheck className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? "text-emerald-400" : "opacity-60"}`} stroke={2.5} />
                            ) : (
                                <IconLock className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? "opacity-20" : "opacity-20"}`} stroke={2} />
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
                            ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md"
                            : isFree
                            ? "bg-black text-white hover:bg-[#1A1A1A]"
                            : "bg-black text-white hover:bg-[#1A1A1A]"
                    }`}
                >
                    {plan.cta}
                </Link>
            </div>
        </div>
    );
}

export default function HomePage() {
    const [isAnnual, setIsAnnual] = useState(true);
    const pricingRef = useRef(null);

    return (
        <div className="min-h-full bg-[var(--background)] text-[var(--foreground)] selection:bg-black selection:text-white">

            {/* ── NAV ── */}
            <nav className="sticky top-0 z-30 bg-[var(--background)]/80 backdrop-blur border-b border-[var(--border)]">
                <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
                    <Link href="/" className="text-sm font-bold tracking-tight">Perricheno</Link>
                    <div className="hidden md:flex items-center gap-8 text-[13px] font-medium opacity-70">
                        <a href="#product" className="hover:opacity-100 transition-opacity">Product</a>
                        <a href="#how" className="hover:opacity-100 transition-opacity">How it works</a>
                        <a href="#pricing" className="hover:opacity-100 transition-opacity">Pricing</a>
                        <a href="#faq" className="hover:opacity-100 transition-opacity">FAQ</a>
                    </div>
                    <Link
                        href="/agent"
                        className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-[#1A1A1A] transition-colors"
                    >
                        Launch Agent <IconArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-6">

                {/* ── HERO ── */}
                <header className="pt-20 md:pt-32 pb-24 md:pb-40">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="max-w-4xl"
                    >
                        {/* Badge */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1, duration: 0.5 }}
                            className="inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--card)] rounded-full px-4 py-1.5 mb-8"
                        >
                        </motion.div>

                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] mb-8">
                            Research, write, analyze<br />
                            cite, visualize -<br className="hidden md:block" />
                            <span className="opacity-30">all in one place.</span>
                        </h1>
                        <p className="text-lg md:text-xl leading-relaxed opacity-60 font-light max-w-2xl mb-12">
                            Perricheno turns a topic into a compiled LaTeX paper, with real citations,
                            publication-ready figures, and shareable PDFs. Built for students and researchers
                            who want depth, not boilerplate.
                        </p>
                        <div className="flex flex-wrap gap-3 items-center">
                            <Link
                                href="/agent"
                                className="inline-flex items-center gap-3 bg-black text-white px-6 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-[#1A1A1A] transition-all active:scale-95 shadow-sm"
                            >
                                Launch Agent <IconArrowUpRight className="w-4 h-4" />
                            </Link>
                            <a
                                href="#pricing"
                                className="inline-flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] px-6 py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:border-black transition-all"
                            >
                                See pricing
                            </a>
                            <div className="flex items-center gap-2 pl-2 opacity-50">
                                <IconBrandTelegram className="w-4 h-4" />
                                <span className="text-[11px] font-medium">Via Telegram</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Stat strip */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.7 }}
                        className="mt-20 md:mt-28 grid grid-cols-2 md:grid-cols-4 gap-8 pt-10 border-t border-[var(--border)]"
                    >
                        {[
                            ["arXiv + OpenAlex", "Search indexes"],
                            ["R · Python", "Visualization runtimes"],
                            ["LaTeX", "Native compiler"],
                            ["EN · RU", "Document languages"],
                        ].map(([v, l]) => (
                            <div key={l}>
                                <div className="text-lg md:text-2xl font-bold tracking-tight">{v}</div>
                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-2">{l}</div>
                            </div>
                        ))}
                    </motion.div>
                </header>

                {/* ── LOGO BAR ── */}
                <div className="py-10 border-t border-[var(--border)]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 mb-6 text-center">Powered by</p>
                    <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
                        {LOGOS.map(l => (
                            <span key={l} className="text-[13px] font-bold tracking-tight opacity-25 hover:opacity-50 transition-opacity">
                                {l}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── FEATURES ── */}
                <section id="product" className="py-24 md:py-32 border-t border-[var(--border)]">
                    <SectionLabel>Product</SectionLabel>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 max-w-3xl leading-[1.05]">
                        One workspace for the whole
                    </h2>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05] opacity-30">
                        academic pipeline.
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)] rounded-2xl overflow-hidden">
                        {FEATURES.map(({ icon: Icon, title, desc }, i) => (
                            <motion.div
                                key={title}
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-[var(--card)] p-8 md:p-10 flex flex-col min-h-[220px] hover:bg-[var(--background)] transition-colors group"
                            >
                                <Icon className="w-6 h-6 mb-6 opacity-70 group-hover:opacity-100 transition-opacity" stroke={1.5} />
                                <h3 className="text-lg font-bold tracking-tight mb-3">{title}</h3>
                                <p className="text-[14px] leading-relaxed opacity-60 font-light">{desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* ── HOW IT WORKS ── */}
                <section id="how" className="py-24 md:py-32 border-t border-[var(--border)]">
                    <SectionLabel>How it works</SectionLabel>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 max-w-3xl leading-[1.05]">
                        From prompt to PDF
                    </h2>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05] opacity-30">
                        in three steps.
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
                        {STEPS.map(({ n, title, desc }, i) => (
                            <motion.div
                                key={n}
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="relative bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 md:p-10 overflow-hidden group hover:border-black/20 transition-colors"
                            >
                                <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 mb-8">{n}</div>
                                <h3 className="text-xl font-bold tracking-tight mb-3">{title}</h3>
                                <p className="text-[14px] leading-relaxed opacity-60 font-light">{desc}</p>
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

                {/* ── PRICING ── */}
                <section id="pricing" className="py-24 md:py-32 border-t border-[var(--border)]" ref={pricingRef}>
                    <SectionLabel>Pricing</SectionLabel>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-2 max-w-3xl leading-[1.05]">
                        Start free.
                    </h2>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 max-w-3xl leading-[1.05] opacity-30">
                        Scale when you need to.
                    </h2>
                    <p className="text-base md:text-lg opacity-60 font-light max-w-2xl mb-10">
                        No hidden fees. Cancel anytime. Annual billing saves ~20% — that's two months free.
                    </p>

                    {/* Toggle */}
                    <div className="flex items-center gap-4 mb-12">
                        <span className={`text-sm font-semibold transition-colors ${!isAnnual ? "opacity-100" : "opacity-40"}`}>Monthly</span>
                        <button
                            onClick={() => setIsAnnual(v => !v)}
                            className="relative w-12 h-6 bg-black rounded-full p-1 transition-colors"
                        >
                            <motion.div
                                layout
                                animate={{ x: isAnnual ? 24 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                className="w-4 h-4 bg-white rounded-full shadow-md"
                            />
                        </button>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold transition-colors ${isAnnual ? "opacity-100" : "opacity-40"}`}>Annual</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider">
                                Save 20%
                            </span>
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
                            >
                                <PricingCard plan={plan} isAnnual={isAnnual} />
                            </motion.div>
                        ))}
                    </div>

                    {/* Fine print */}
                    <p className="text-[12px] opacity-40 mt-8 text-center max-w-xl mx-auto">
                        All plans include core features. Payments processed via CryptoCloud (crypto). 
                        Purchased tokens never expire and roll over automatically.
                    </p>
                </section>

                {/* ── SOCIAL PROOF / CALLOUT ── */}
                <section className="py-16 md:py-20 border-t border-[var(--border)]">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            { icon: IconSparkles, stat: "LaTeX + PDF", label: "Native compile pipeline", desc: "No copy-pasting into Overleaf. Full compilation with bib and figures." },
                            { icon: IconBolt, stat: "Real citations", label: "Not hallucinated", desc: "Every reference pulled live from arXiv and OpenAlex with DOIs." },
                            { icon: IconChartBar, stat: "R + Python", label: "Dual viz engines", desc: "From ggplot2 to matplotlib. Publication-grade charts in one click." },
                        ].map(({ icon: Icon, stat, label, desc }) => (
                            <div key={stat} className="border border-[var(--border)] rounded-2xl p-8 bg-[var(--card)] hover:bg-[var(--background)] transition-colors">
                                <Icon className="w-5 h-5 mb-5 opacity-50" stroke={1.5} />
                                <div className="text-2xl font-bold tracking-tight mb-1">{stat}</div>
                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">{label}</div>
                                <p className="text-[14px] leading-relaxed opacity-60 font-light">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── FAQ ── */}
                <section id="faq" className="py-24 md:py-32 border-t border-[var(--border)]">
                    <SectionLabel>FAQ</SectionLabel>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 max-w-3xl leading-[1.05]">
                        Frequently asked
                    </h2>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05] opacity-30">
                        questions.
                    </h2>

                    <div className="max-w-3xl">
                        {FAQ.map(({ q, a }) => (
                            <FaqItem key={q} q={q} a={a} />
                        ))}
                    </div>
                </section>

                {/* ── FINAL CTA ── */}
                <section className="py-24 md:py-32 border-t border-[var(--border)]">
                    <div className="relative bg-black text-white rounded-3xl p-12 md:p-20 text-center overflow-hidden">
                        {/* Subtle grid */}
                        <div className="absolute inset-0 opacity-[0.04]"
                            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }}
                        />
                        {/* Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-emerald-500/10 blur-3xl" />

                        <div className="relative">
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
                                <Link
                                    href="/agent"
                                    className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95"
                                >
                                    Launch Agent <IconArrowUpRight className="w-4 h-4" />
                                </Link>
                                <a
                                    href="#pricing"
                                    className="inline-flex items-center gap-3 border border-white/20 text-white px-8 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:border-white/40 transition-all"
                                >
                                    View pricing
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── FOOTER ── */}
                <footer className="py-16 border-t border-[var(--border)] flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div>
                        <p className="text-sm font-bold tracking-tight mb-1">Perricheno</p>
                        <p className="text-[11px] font-bold uppercase tracking-widest opacity-30">
                            © 2026 Perricheno Inc. · All rights reserved
                        </p>
                    </div>
                    <div className="flex gap-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                        <Link href="/terms" className="hover:opacity-100 transition-opacity">Terms</Link>
                        <Link href="/privacy" className="hover:opacity-100 transition-opacity">Privacy</Link>
                        <a href="mailto:support@perricheno.ru" className="hover:opacity-100 transition-opacity">Support</a>
                    </div>
                </footer>
            </div>
        </div>
    );
}