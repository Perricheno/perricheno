"use client";

import { motion } from "framer-motion";
import { IconBrain, IconFileText, IconPresentation, IconCalendarStats, IconRobot, IconMath, IconCode, IconTerminal2 } from "@tabler/icons-react";

export default function AgentPage() {
    const features = [
        { title: "Overleaf Sync", icon: IconMath, desc: "Real-time LaTeX editing & compilation." },
        { title: "Academic Writer", icon: IconFileText, desc: "Drafts papers with citation support." },
        { title: "Slide Generator", icon: IconPresentation, desc: "Converts notes into presentation decks." },
        { title: "Smart Scheduling", icon: IconCalendarStats, desc: "Manages deadlines and study sessions." },
        { title: "Code Assistant", icon: IconCode, desc: " specialized in Python & R for data analysis." },
        { title: "Infrastructure", icon: IconTerminal2, desc: "Self-hosting & deployment manager." },
    ];

    return (
        <div className="w-full h-full">

            <div className="max-w-5xl mx-auto px-6 py-20 md:py-32">
                
                {/* Header */}
                <div className="mb-24">
                    <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-[var(--foreground)] rounded-full">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--foreground)] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--foreground)]"></span>
                        </span>
                        <span className="text-xs font-bold tracking-widest uppercase">System Active</span>
                    </div>

                    <h1 className="text-4xl md:text-7xl font-bold tracking-tighter mb-6">
                        Autonomous Agent.
                    </h1>
                    <p className="text-xl md:text-2xl opacity-60 max-w-2xl leading-relaxed">
                        Your academic and technical force multiplier. Capable of executing complex workflows, not just chatting.
                    </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)]">
                    {features.map((f, i) => (
                        <div key={i} className="group relative bg-[var(--background)] p-8 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors duration-200 h-64 flex flex-col justify-between">
                            <f.icon className="w-8 h-8 stroke-1" />
                            <div>
                                <h3 className="text-lg font-bold tracking-tight mb-2">{f.title}</h3>
                                <p className="text-sm opacity-50 group-hover:opacity-80 leading-normal">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Status Footer */}
                <div className="mt-24 border-t border-[var(--border)] pt-8 flex items-center justify-between opacity-40 font-mono text-xs">
                    <p>AGENT_ID: 8X-92 ALPHA</p>
                    <p>STATUS: STANDBY</p>
                </div>
            </div>
        </div>
    );
}
