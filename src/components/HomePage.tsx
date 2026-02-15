"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
    IconBrandGithub, IconBrandLinkedin, IconBrandTwitter, IconArrowRight,
    IconTerminal2, IconChartBar, IconMessageCircle, IconFileTypePdf
} from "@tabler/icons-react";
import { AdminBar } from "@/components/AdminBar";

const pageLinks = [
    { title: "Projects", desc: "3D cards, DevOps tools, data analytics & more", href: "/projects", emoji: "🚀" },
    { title: "Dashboard", desc: "Power BI analytics & embedded reports", href: "/dashboard", emoji: "📊" },
    { title: "Chat", desc: "Send messages, files & voice notes", href: "/chat", emoji: "💬" },
];

export default function HomePage() {
    return (
        <div className="relative z-10 w-full min-h-screen">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-2xl" />
            <AdminBar />

            <div className="relative z-10 max-w-[1200px] mx-auto px-6 pt-24 pb-32 md:py-28 md:pl-24">

                {/* HERO */}
                <motion.div className="mb-20" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                    <motion.h1 className="text-5xl md:text-8xl font-bold tracking-tighter text-white leading-[0.95]"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
                        Perricheno
                    </motion.h1>
                    <motion.p className="text-white/60 text-xl md:text-2xl font-light mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                        Student · Analyst · DevOps Engineer
                    </motion.p>
                    <motion.p className="text-white/40 text-sm md:text-base max-w-xl leading-relaxed mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                        Building digital experiences at AITU. Passionate about data analytics,
                        cloud infrastructure, and creating beautiful interfaces.
                    </motion.p>
                </motion.div>

                {/* PAGE LINKS */}
                <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-24"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
                    {[
                        { title: "Project Gallery", href: "/projects", icon: <IconTerminal2 className="w-6 h-6" />, color: "text-blue-400", bg: "bg-blue-500/10" },
                        { title: "Analytics Hub", href: "/dashboard", icon: <IconChartBar className="w-6 h-6" />, color: "text-purple-400", bg: "bg-purple-500/10" },
                        { title: "AI Assistant", href: "/chat", icon: <IconMessageCircle className="w-6 h-6" />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                        { title: "Perricheno Agent", href: "/agent", icon: <IconRobot className="w-6 h-6" />, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                        { title: "PDF Converter", href: "/pdf", icon: <IconFileTypePdf className="w-6 h-6" />, color: "text-red-400", bg: "bg-red-500/10" }
                    ].map((item, i) => (
                        <Link key={i} href={item.href}
                            className="group relative p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl hover:bg-white/[0.06] transition-all overflow-hidden">
                            <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl ${item.bg} ${item.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                <IconArrowRight className="w-4 h-4" />
                            </div>
                            <div className={`mb-4 w-12 h-12 rounded-2xl ${item.bg} flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                                {item.icon}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
                            <p className="text-white/40 text-sm">Interactive demo & tools</p>
                        </Link>
                    ))}
                </motion.div>

                {/* CONTACT / FOOTER */}
                <motion.div className="border-t border-white/[0.06] pt-10 flex flex-col items-center text-center"
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
                    <h2 className="text-3xl font-bold mb-6 text-white">Let&apos;s Connect</h2>
                    <div className="flex gap-3">
                        {[
                            { Icon: IconBrandGithub, href: "https://github.com/perricheno" },
                            { Icon: IconBrandLinkedin, href: "#" },
                            { Icon: IconBrandTwitter, href: "#" },
                        ].map(({ Icon, href }, i) => (
                            <motion.a key={i} href={href} target="_blank" rel="noopener noreferrer"
                                whileHover={{ scale: 1.15, y: -2 }} whileTap={{ scale: 0.9 }}
                                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                className="p-3 rounded-xl bg-white/5 border border-white/[0.06] hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-colors backdrop-blur-sm">
                                <Icon className="w-5 h-5 text-white" />
                            </motion.a>
                        ))}
                    </div>
                    <p className="mt-6 text-white/30 text-sm">© 2025 Perricheno. All rights reserved.</p>
                </motion.div>

            </div>
        </div>
    );
}
