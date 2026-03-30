"use client";

import Link from "next/link";
import {
    IconBrandGithub, IconArrowUpRight,
    IconTerminal2, IconChartBar, IconMessageCircle, IconFileTypePdf, IconRobot
} from "@tabler/icons-react";

export default function HomePage() {
    return (
        <div className="w-full h-full">
            
            <main className="max-w-5xl mx-auto px-6 py-20 md:py-32">
                {/* HERO */}
                <div className="mb-24">
                    <h1 className="text-6xl md:text-9xl font-bold tracking-tighter leading-none mb-6">
                        Perricheno.
                    </h1>
                    <p className="text-xl md:text-2xl font-light text-[var(--foreground)] opacity-60 max-w-2xl">
                        Student. Analyst. DevOps Engineer.
                    </p>
                    <p className="mt-4 text-[var(--foreground)] opacity-40 max-w-xl leading-relaxed">
                        Building functional, high-performance digital tools. 
                        Focused on minimalism, speed, and utility.
                    </p>
                </div>

                {/* GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)]">
                    {[
                        { title: "Project Gallery", href: "/projects", icon: IconTerminal2, desc: "DevOps & Tools" },
                        { title: "Analytics Hub", href: "/dashboard", icon: IconChartBar, desc: "Data Insights" },
                        { title: "AI Chat", href: "/chat", icon: IconMessageCircle, desc: "LLM Assistant" },
                        { title: "Agent", href: "/agent", icon: IconRobot, desc: "Autonomous Tasks" },
                        { title: "PDF Tools", href: "/pdf", icon: IconFileTypePdf, desc: "Converters" },
                        { title: "GitHub", href: "https://github.com/perricheno", icon: IconBrandGithub, desc: "Source Code" },
                    ].map((item, i) => (
                        <Link key={i} href={item.href} 
                            className="group relative bg-[var(--background)] p-8 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors duration-200">
                            <div className="flex justify-between items-start mb-12">
                                <item.icon className="w-8 h-8 stroke-1" />
                                <IconArrowUpRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <h3 className="text-xl font-bold tracking-tight mb-1">{item.title}</h3>
                            <p className="text-sm opacity-50 group-hover:opacity-80">{item.desc}</p>
                        </Link>
                    ))}
                </div>

                {/* FOOTER */}
                <footer className="mt-32 pt-12 border-t border-[var(--border)] flex flex-col md:flex-row justify-between items-start md:items-center gap-8 opacity-40 text-[11px] uppercase tracking-widest font-bold">
                    <div className="flex flex-wrap gap-x-8 gap-y-4">
                        <Link href="/terms" className="hover:text-black transition-colors">Terms of Service / Условия</Link>
                        <Link href="/privacy" className="hover:text-black transition-colors">Privacy / Конфиденциальность</Link>
                        <a href="mailto:shyngyskhan.amangeldy@astanaithub.kz" className="hover:text-black transition-colors">Contact</a>
                    </div>
                    <div className="flex flex-wrap gap-x-8 gap-y-4 items-center">
                        <a href="https://linkedin.com/in/perricheno" target="_blank" className="hover:text-black transition-colors underline decoration-black/20 underline-offset-4">LinkedIn</a>
                        <p>© 2026 Perricheno Inc.</p>
                    </div>
                </footer>
            </main>
        </div>
    );
}
