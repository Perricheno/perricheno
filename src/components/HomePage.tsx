"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
} from "@tabler/icons-react";
import { useState } from "react";

// ── Product capabilities ──
const FEATURES = [
    {
        icon: IconFileText,
        title: "Research Writer",
        desc: "Generate full LaTeX documents — research papers, theses, reports, lab work — compiled straight to PDF.",
    },
    {
        icon: IconBook2,
        title: "Scholar Search",
        desc: "Query arXiv and OpenAlex in any language. Relevance-ranked results with abstracts, authors, DOIs, and PDFs.",
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
        desc: "OCR scanned papers, convert PDF ↔ DOCX, extract text for referencing. All inside the same workspace.",
    },
] as const;

// ── How it works ──
const STEPS = [
    { n: "01", title: "Describe the task", desc: "Topic, word count, language, style, references. Attach source files if you have them." },
    { n: "02", title: "Agent works", desc: "Structure, draft, cite, visualize. You watch progress stream in real time." },
    { n: "03", title: "Download or iterate", desc: "Compiled PDF, LaTeX source, shareable link. Edit and regenerate any section on demand." },
] as const;

// ── Pricing plans ──
// Free tier mirrors server-side defaults (100k chars/day, 150 visuals/day).
// Packs mirror AgentBillingModal — prices resolved on checkout.
const PLANS = [
    {
        name: "Free",
        tagline: "For casual use",
        price: "$0",
        period: "forever",
        highlighted: false,
        features: [
            "100,000 characters per day",
            "500,000 characters per week",
            "150 visual renders per day",
            "Scholar search, chat, PDF tools",
        ],
        cta: "Start free",
        ctaHref: "/agent",
        packId: null,
    },
    {
        name: "Data Scientist",
        tagline: "One-time pack",
        price: "Pack",
        period: "rolls over",
        highlighted: false,
        features: [
            "2,000,000 characters",
            "50 extra visual renders",
            "No daily cap on purchased quota",
            "Everything in Free",
        ],
        cta: "Buy pack",
        ctaHref: "/agent",
        packId: "data_scientist",
    },
    {
        name: "Researcher",
        tagline: "For heavy writers",
        price: "Bundle",
        period: "rolls over",
        highlighted: true,
        features: [
            "5,000,000 characters",
            "150 extra visual renders",
            "Priority compile queue",
            "Everything in Data Scientist",
        ],
        cta: "Buy bundle",
        ctaHref: "/agent",
        packId: "researcher",
    },
] as const;

// ── FAQ ──
const FAQ = [
    {
        q: "How do I sign in?",
        a: "Through the Telegram Login Widget. No passwords, no email — one tap opens the agent with your account attached.",
    },
    {
        q: "How is usage billed?",
        a: "The free tier resets daily and weekly. For heavier loads buy a one-time pack — purchased characters roll over and never expire. Payment is via CryptoCloud (crypto).",
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
            <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
                <div className="overflow-hidden">
                    <p className="pb-6 text-[15px] leading-[1.8] opacity-70 font-light max-w-2xl">{a}</p>
                </div>
            </div>
        </div>
    );
}

export default function HomePage() {
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
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 mb-8">
                            Academic AI Workspace
                        </p>
                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.95] mb-8">
                            Research, write, cite, visualize —<br className="hidden md:block" />
                            <span className="opacity-40">all in one place.</span>
                        </h1>
                        <p className="text-lg md:text-xl leading-relaxed opacity-60 font-light max-w-2xl mb-12">
                            Perricheno turns a topic into a compiled LaTeX paper, with real citations,
                            publication-ready figures, and shareable PDFs. Built for students and researchers
                            who want depth, not boilerplate.
                        </p>
                        <div className="flex flex-wrap gap-3">
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
                        </div>
                    </motion.div>

                    {/* Stat strip */}
                    <div className="mt-20 md:mt-28 grid grid-cols-2 md:grid-cols-4 gap-8 pt-10 border-t border-[var(--border)]">
                        {[
                            ["arXiv + OpenAlex", "Indexes"],
                            ["R · Python", "Visualization runtimes"],
                            ["LaTeX", "Native compiler"],
                            ["EN · RU", "Document languages"],
                        ].map(([v, l]) => (
                            <div key={l}>
                                <div className="text-lg md:text-2xl font-bold tracking-tight">{v}</div>
                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-2">{l}</div>
                            </div>
                        ))}
                    </div>
                </header>

                {/* ── FEATURES ── */}
                <section id="product" className="py-24 md:py-32 border-t border-[var(--border)]">
                    <SectionLabel>Product</SectionLabel>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05]">
                        One workspace for the whole <span className="opacity-40">academic pipeline.</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)] rounded-2xl overflow-hidden">
                        {FEATURES.map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="bg-[var(--card)] p-8 md:p-10 flex flex-col min-h-[220px] hover:bg-[var(--background)] transition-colors">
                                <Icon className="w-6 h-6 mb-6 opacity-70" stroke={1.5} />
                                <h3 className="text-lg font-bold tracking-tight mb-3">{title}</h3>
                                <p className="text-[14px] leading-relaxed opacity-60 font-light">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── HOW IT WORKS ── */}
                <section id="how" className="py-24 md:py-32 border-t border-[var(--border)]">
                    <SectionLabel>How it works</SectionLabel>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05]">
                        From prompt to PDF in <span className="opacity-40">three steps.</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
                        {STEPS.map(({ n, title, desc }) => (
                            <div key={n} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 md:p-10">
                                <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 mb-8">{n}</div>
                                <h3 className="text-xl font-bold tracking-tight mb-3">{title}</h3>
                                <p className="text-[14px] leading-relaxed opacity-60 font-light">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── PRICING ── */}
                <section id="pricing" className="py-24 md:py-32 border-t border-[var(--border)]">
                    <SectionLabel>Pricing</SectionLabel>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4 max-w-3xl leading-[1.05]">
                        Start free. <span className="opacity-40">Scale when you need to.</span>
                    </h2>
                    <p className="text-base md:text-lg opacity-60 font-light max-w-2xl mb-16">
                        No subscriptions. Pay once for extra capacity; unused characters roll over with your account.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        {PLANS.map((plan) => (
                            <div
                                key={plan.name}
                                className={`rounded-2xl p-8 md:p-10 flex flex-col ${
                                    plan.highlighted
                                        ? "bg-black text-white border border-black"
                                        : "bg-[var(--card)] border border-[var(--border)]"
                                }`}
                            >
                                <div className="flex items-baseline justify-between mb-6">
                                    <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                                    {plan.highlighted && (
                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded ${plan.highlighted ? "bg-white text-black" : ""}`}>
                                            Popular
                                        </span>
                                    )}
                                </div>
                                <p className={`text-[12px] font-medium uppercase tracking-widest mb-8 ${plan.highlighted ? "opacity-50" : "opacity-40"}`}>
                                    {plan.tagline}
                                </p>
                                <div className="mb-8">
                                    <span className="text-4xl md:text-5xl font-bold tracking-tighter">{plan.price}</span>
                                    <span className={`ml-2 text-[11px] font-bold uppercase tracking-widest ${plan.highlighted ? "opacity-50" : "opacity-40"}`}>
                                        {plan.period}
                                    </span>
                                </div>
                                <ul className="space-y-3 mb-10 flex-1">
                                    {plan.features.map(f => (
                                        <li key={f} className="flex items-start gap-3 text-[14px] font-light">
                                            <IconCheck className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? "opacity-70" : "opacity-50"}`} />
                                            <span className={plan.highlighted ? "opacity-90" : "opacity-80"}>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={plan.ctaHref}
                                    className={`w-full text-center py-3.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
                                        plan.highlighted
                                            ? "bg-white text-black hover:bg-gray-100"
                                            : "bg-black text-white hover:bg-[#1A1A1A]"
                                    }`}
                                >
                                    {plan.cta}
                                </Link>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── FAQ ── */}
                <section id="faq" className="py-24 md:py-32 border-t border-[var(--border)]">
                    <SectionLabel>FAQ</SectionLabel>
                    <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-16 max-w-3xl leading-[1.05]">
                        Frequently asked <span className="opacity-40">questions.</span>
                    </h2>

                    <div className="max-w-3xl">
                        {FAQ.map(({ q, a }) => (
                            <FaqItem key={q} q={q} a={a} />
                        ))}
                    </div>
                </section>

                {/* ── FINAL CTA ── */}
                <section className="py-24 md:py-32 border-t border-[var(--border)]">
                    <div className="bg-black text-white rounded-3xl p-12 md:p-20 text-center">
                        <h2 className="text-3xl md:text-5xl font-bold tracking-tighter mb-6 max-w-3xl mx-auto leading-[1.05]">
                            Stop wrestling with LaTeX.<br />
                            <span className="opacity-50">Start writing.</span>
                        </h2>
                        <p className="text-base md:text-lg opacity-60 font-light max-w-xl mx-auto mb-10">
                            Free to try. No credit card. One Telegram tap and you're in the agent.
                        </p>
                        <Link
                            href="/agent"
                            className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95"
                        >
                            Launch Agent <IconArrowUpRight className="w-4 h-4" />
                        </Link>
                    </div>
                </section>

                {/* ── FOOTER ── */}
                <footer className="py-16 border-t border-[var(--border)] flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <p className="text-[11px] font-bold uppercase tracking-widest opacity-30">
                        © 2026 Perricheno Inc. · All rights reserved
                    </p>
                    <div className="flex gap-8 text-[11px] font-bold uppercase tracking-widest opacity-40">
                        <Link href="/terms" className="hover:opacity-100 transition-opacity">Terms</Link>
                        <Link href="/privacy" className="hover:opacity-100 transition-opacity">Privacy</Link>
                        <a href="#faq" className="hover:opacity-100 transition-opacity">Support</a>
                    </div>
                </footer>
            </div>
        </div>
    );
}
