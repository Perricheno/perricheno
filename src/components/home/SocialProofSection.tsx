"use client";

import { motion } from "framer-motion";
import { IconSparkles, IconBolt, IconChartBar } from "@tabler/icons-react";

const PROOF_ITEMS = [
    { icon: IconSparkles, stat: "LaTeX + PDF", label: "Native compile pipeline", desc: "No copy-pasting into Overleaf. Full compilation with bib and figures." },
    { icon: IconBolt,     stat: "Real citations", label: "Not hallucinated",      desc: "Every reference pulled live from arXiv and OpenAlex with DOIs." },
    { icon: IconChartBar, stat: "R + Python",    label: "Dual viz engines",       desc: "From ggplot2 to matplotlib. Publication-grade charts in one click." },
];

// ── Social Proof Section ───────────────────────────────────────────────────────
export function SocialProofSection() {
    return (
        <section className="py-16 md:py-20 border-t border-[var(--border)]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PROOF_ITEMS.map(({ icon: Icon, stat, label, desc }) => (
                    <motion.div
                        key={stat}
                        whileHover={{ y: -4 }}
                        transition={{ duration: 0.22 }}
                        className="border border-[var(--border)] rounded-2xl p-8 bg-[var(--card)] hover:bg-[var(--background)] transition-colors group"
                    >
                        <Icon className="w-5 h-5 mb-5 opacity-50 group-hover:opacity-80 transition-opacity" stroke={1.5} />
                        <div className="text-2xl font-bold tracking-tight mb-1">{stat}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">{label}</div>
                        <p className="text-[14px] leading-relaxed opacity-60 font-light">{desc}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
