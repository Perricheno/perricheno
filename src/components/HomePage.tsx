"use client";

import Link from "next/link";
import {
    IconBrandGithub, IconArrowUpRight,
    IconTerminal2, IconChartBar, IconMessageCircle, IconFileTypePdf, IconRobot
} from "@tabler/icons-react";
import MinimalSidebar from "@/components/MinimalSidebar";

export default function HomePage() {
    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pl-16 md:pl-64 transition-all">
            <MinimalSidebar />
            
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
                <footer className="mt-32 pt-8 border-t border-[var(--border)] flex flex-col md:flex-row justify-between items-center opacity-40 text-sm">
                    <div className="flex gap-4 mb-4 md:mb-0">
                        <a href="#" className="hover:underline">LinkedIn</a>
                        <a href="#" className="hover:underline">Twitter</a>
                        <a href="mailto:hello@perricheno.com" className="hover:underline">Contact</a>
                    </div>
                    <p>© 2025 Perricheno Inc.</p>
                </footer>
            </main>
        </div>
    );
}
