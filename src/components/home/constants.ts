import type { ComponentType } from "react";
import {
    IconFileText,
    IconBook2,
    IconChartBar,
    IconMessageCircle,
    IconFileTypePdf,
    IconCode,
} from "@tabler/icons-react";

// ── Plans ──────────────────────────────────────────────────────────────────────
export const PLANS = [
    {
        id: "free",
        name: "Free",
        tagline: "The Sandbox",
        priceMonthly: 0,
        priceAnnual: 0,
        highlighted: false,
        tag: null as string | null,
        accent: "#666",
        features: [
            { text: "50,000 tokens / week",        included: true  },
            { text: "150,000 tokens / month",       included: true  },
            { text: "Basic Python (5 chart types)", included: true  },
            { text: "Scholar search & PDF tools",   included: true  },
            { text: "7-day chat retention",         included: true  },
            { text: "ZIP Project Export",           included: false },
            { text: "R Environment (CRAN)",         included: false },
            { text: "AI Code Editing",              included: false },
        ],
        cta: "Start free",
        ctaHref: "/billings",
    },
    {
        id: "plus",
        name: "Plus",
        tagline: "Standard",
        priceMonthly: 3.99,
        priceAnnual: 39.00,
        highlighted: false,
        tag: null as string | null,
        accent: "#a8a8a8",
        features: [
            { text: "150,000 tokens / week",              included: true  },
            { text: "450,000 tokens / month",             included: true  },
            { text: "Full Python (35+ visualizations)",   included: true  },
            { text: "ZIP Project Export unlocked",        included: true  },
            { text: "Priority rendering",                 included: true  },
            { text: "14-day chat retention",              included: true  },
            { text: "R Environment",                      included: false },
            { text: "AI Code Editing",                    included: false },
        ],
        cta: "Get Plus",
        ctaHref: "/billings",
    },
    {
        id: "pro",
        name: "Pro",
        tagline: "Researcher",
        priceMonthly: 7.99,
        priceAnnual: 69.00,
        highlighted: true,
        tag: "Popular" as string | null,
        accent: "#10b981",
        features: [
            { text: "250,000 tokens / week",        included: true },
            { text: "800,000 tokens / month",        included: true },
            { text: "R-Infrastructure + Python stack", included: true },
            { text: "AI Code Editor enabled",        included: true },
            { text: "Share reports via link",        included: true },
            { text: "Exclusive power giveaways",     included: true },
            { text: "30-day chat retention",         included: true },
        ],
        cta: "Get Pro",
        ctaHref: "/billings",
    },
    {
        id: "ultra",
        name: "Ultra",
        tagline: "Absolute Power",
        priceMonthly: 14.99,
        priceAnnual: 149.00,
        highlighted: false,
        tag: "Best Value" as string | null,
        accent: "#f59e0b",
        features: [
            { text: "800,000 tokens / week (Cap)", included: true },
            { text: "3,000,000 tokens / month",    included: true },
            { text: "AI Edit: Low Cost Mode (÷2)", included: true },
            { text: "2× bonus on referrals & promos", included: true },
            { text: "Maximum rendering priority",  included: true },
            { text: "All giveaways & events",      included: true },
            { text: "90-day chat retention",       included: true },
        ],
        cta: "Get Ultra",
        ctaHref: "/billings",
    },
] as const;

// ── Features ───────────────────────────────────────────────────────────────────
export const FEATURES: { icon: ComponentType<{ className?: string; stroke?: number }>; title: string; desc: string }[] = [
    { icon: IconFileText,     title: "Research Writer",   desc: "Full LaTeX documents - research papers, theses, reports - compiled straight to PDF with real citations." },
    { icon: IconBook2,        title: "Scholar Search",    desc: "Query arXiv and OpenAlex in any language. Relevance-ranked results with abstracts, authors, DOIs." },
    { icon: IconChartBar,     title: "Data Analytics",    desc: "Turn a question into R or Python visualizations. Upload a dataset, pick a chart, get publication-ready figures." },
    { icon: IconMessageCircle,title: "Multimodal Chat",   desc: "Fast Q&A with text, images, and file context. Perfect for quick explanations, rewrites, and outlines." },
    { icon: IconCode,         title: "LaTeX Compiler",    desc: "Built-in pipeline compiles .tex to PDF with bib, figures, and multi-column layouts. Errors auto-repaired." },
    { icon: IconFileTypePdf,  title: "PDF Toolkit",       desc: "OCR scanned papers, convert PDF ↔ DOCX, extract text for referencing. All in one workspace." },
];

// ── Steps ──────────────────────────────────────────────────────────────────────
export const STEPS = [
    { n: "01", title: "Describe the task",  desc: "Topic, word count, language, style, references. Attach source files if you have them." },
    { n: "02", title: "Agent works",        desc: "Structure, draft, cite, visualize. Watch progress stream in real time." },
    { n: "03", title: "Download or iterate",desc: "Compiled PDF, LaTeX source, shareable link. Edit any section on demand." },
];

// ── FAQ ────────────────────────────────────────────────────────────────────────
export const FAQ = [
    { q: "How do I sign in?",             a: "Through the Telegram Login Widget. No passwords, no email - one tap opens the agent with your account attached." },
    { q: "How is usage billed?",          a: "The free tier resets daily and weekly. Paid plans are billed monthly or annually (save ~20%). Payment is via CryptoCloud (crypto)." },
    { q: "Can I use it in Russian?",      a: "Yes. Documents can be generated in English or Russian, and Scholar understands any language - queries are translated to English keywords before hitting academic indexes." },
    { q: "Do you store my uploaded files?",a: "Uploaded task descriptions and reference files are used only to generate your document. Session text is stored on your account so you can reopen and edit it; you can delete any session at any time." },
    { q: "What formats do I get back?",   a: "Compiled PDF, the raw LaTeX source (.tex + bib), and a shareable public link. Visuals download as PNG with the R/Python source embedded." },
    { q: "Is there an API?",              a: "Not publicly yet. If you need programmatic access for a lab or classroom, get in touch." },
];

export const LOGOS = ["arXiv", "OpenAlex", "LaTeX", "R CRAN", "Python", "CryptoCloud"];
