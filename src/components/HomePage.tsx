"use client";

import Link from "next/link";
import { motion, Variants } from "framer-motion";
import {
    IconArrowUpRight,
    IconTerminal2, IconChartBar, IconFileTypePdf, IconRobot, IconBolt,
    IconChevronRight, IconCode, IconLayersIntersect
} from "@tabler/icons-react";

const container: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.3
        }
    }
};

const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { 
        opacity: 1, 
        y: 0, 
        transition: { 
            type: "spring", 
            stiffness: 100, 
            damping: 20 
        } as any
    }
};

export default function HomePage() {
    return (
        <div className="w-full min-h-screen bg-[#F8F9FA] text-[#1A1A1A] selection:bg-black selection:text-white overflow-hidden">
            
            {/* Ambient Background Element */}
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-gray-200/50 to-transparent blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-gradient-to-tr from-gray-200/30 to-transparent blur-[100px] pointer-events-none" />

            <main className="max-w-6xl mx-auto px-6 py-16 md:py-24 relative z-10">
                
                {/* HERO SECTION */}
                <header className="mb-20 md:mb-32">
                    <motion.h1 
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-10"
                    >
                        Perricheno.
                    </motion.h1>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.8 }}
                            className="max-w-xl"
                        >
                            <p className="text-xl md:text-2xl font-medium tracking-tight leading-snug opacity-70">
                                Shyngyskhan Amangeldy. Student at AITU, DevOps Engineer, and Analyst.
                            </p>
                            <p className="mt-4 text-[var(--muted)] text-sm md:text-base leading-relaxed max-w-md">
                                Developing highly efficient automated systems and data-driven solutions. 
                                Focused on high-load infrastructure and systemic optimization.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6, duration: 1 }}
                        >
                            <Link href="/agent" className="group flex items-center gap-4 bg-white border border-[#E5E5E5] px-6 py-3 rounded-2xl shadow-sm hover:border-black transition-all hover:shadow-xl active:scale-95">
                                <span className="text-xs font-black uppercase tracking-widest">Launch Agent</span>
                                <div className="w-8 h-8 rounded-full bg-[#F5F5F7] flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                                    <IconChevronRight size={16} />
                                </div>
                            </Link>
                        </motion.div>
                    </div>
                </header>

                {/* BENTO GRID */}
                <motion.div 
                    variants={container}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 md:grid-cols-12 gap-5 auto-rows-[240px] md:auto-rows-[180px]"
                >
                    {/* CORE PLATFORM TILE */}
                    <motion.div variants={item} className="md:col-span-8 md:row-span-2 group relative overflow-hidden bg-white border border-[#E5E5E5] rounded-[32px] p-10 hover:shadow-2xl transition-all">
                        <div className="relative z-10 h-full flex flex-col">
                            <IconLayersIntersect className="mb-6 opacity-30 group-hover:opacity-100 transition-opacity" size={40} />
                            <h3 className="text-3xl font-black tracking-tight mb-2">Platform Overseer</h3>
                            <p className="text-sm opacity-50 max-w-xs">A unified command center for automated report generation, data analytics, and infrastructure control.</p>
                            <div className="mt-auto flex gap-3">
                                <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase tracking-tighter">Architecture</span>
                                <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase tracking-tighter">Analysis</span>
                                <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold uppercase tracking-tighter">DevOps</span>
                            </div>
                        </div>
                        <div className="absolute right-[-10%] bottom-[-10%] w-[60%] h-[60%] bg-[#F5F5F7] rounded-full group-hover:scale-110 transition-transform duration-700" />
                        <Link href="/agent" className="absolute inset-0" />
                    </motion.div>

                    {/* CODE LAB TILE */}
                    <motion.div variants={item} className="md:col-span-4 md:row-span-2 group relative overflow-hidden bg-black text-white rounded-[32px] p-8 hover:shadow-2xl transition-all">
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-8">
                                <IconCode size={40} className="text-gray-400" />
                                <div className="px-2 py-1 bg-white/10 rounded text-[9px] font-bold uppercase tracking-widest text-white/50">Coming Soon</div>
                            </div>
                            <h3 className="text-2xl font-black tracking-tight">Code Lab</h3>
                            <p className="text-sm opacity-50 mt-2 leading-relaxed">Advanced R & Python online compiler with integrated AI terminal. Cloud-native IDE environment.</p>
                            
                            <div className="mt-auto bg-white/5 rounded-xl p-4 font-mono text-[10px] space-y-1">
                                <div className="flex gap-2"><span className="text-blue-400">import</span> <span className="text-gray-300">pandas as pd</span></div>
                                <div className="flex gap-2"><span className="text-purple-400">df</span> <span className="text-gray-300">= pd.read_csv(</span><span className="text-green-400">'data.csv'</span><span className="text-gray-300">)</span></div>
                                <div className="flex gap-2"><span className="text-gray-500"># Initializing analysis...</span></div>
                                <motion.div 
                                    animate={{ opacity: [0, 1, 0] }} 
                                    transition={{ repeat: Infinity, duration: 1 }}
                                    className="w-1.5 h-3 bg-white ml-0.5 mt-1" 
                                />
                            </div>
                        </div>
                        <Link href="/code" className="absolute inset-0 z-20" />
                    </motion.div>

                    {/* AGENT TILE (Wide/Small) */}
                    <motion.div variants={item} className="md:col-span-4 md:row-span-1 group relative overflow-hidden bg-white border border-[#E5E5E5] rounded-[32px] p-8 hover:shadow-2xl transition-all">
                        <div className="relative z-10 flex items-center justify-between h-full">
                            <div>
                                <IconRobot size={32} className="mb-2 opacity-30 group-hover:opacity-100 transition-opacity" />
                                <h3 className="text-xl font-black tracking-tight">Overseer</h3>
                                <p className="text-xs opacity-50">Control everything.</p>
                            </div>
                            <div className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center group-hover:border-black transition-colors">
                                <IconChevronRight size={18} />
                            </div>
                        </div>
                        <Link href="/agent" className="absolute inset-0" />
                    </motion.div>

                    {/* ANALYTICS TILE */}
                    <motion.div variants={item} className="md:col-span-5 md:row-span-1 group relative overflow-hidden bg-white border border-[#E5E5E5] rounded-[32px] p-8 hover:shadow-2xl transition-all">
                         <div className="relative z-10 flex items-center justify-between h-full">
                            <div>
                                <IconChartBar size={32} className="mb-2 opacity-30 group-hover:opacity-100 transition-opacity" />
                                <h3 className="text-xl font-black tracking-tight">System Health</h3>
                                <p className="text-xs opacity-50">Global telemetry hub.</p>
                            </div>
                            <div className="flex items-end gap-1 h-8">
                                {[30, 60, 45, 80, 50, 90, 70].map((h, i) => (
                                    <motion.div 
                                        key={i} 
                                        initial={{ height: 0 }}
                                        animate={{ height: `${h}%` }}
                                        transition={{ delay: 0.8 + (i * 0.1), duration: 0.5 }}
                                        className="w-1.5 bg-black rounded-full opacity-10 group-hover:opacity-100 transition-opacity" 
                                    />
                                ))}
                            </div>
                        </div>
                        <Link href="/dashboard" className="absolute inset-0" />
                    </motion.div>

                    {/* PDF TOOLS TILE */}
                    <motion.div variants={item} className="md:col-span-3 md:row-span-1 group relative overflow-hidden bg-white border border-[#E5E5E5] rounded-[32px] p-8 hover:shadow-2xl transition-all">
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <IconFileTypePdf size={32} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                            <div>
                                <h3 className="text-xl font-black tracking-tight">PDF Kit</h3>
                                <p className="text-xs opacity-50 mt-1">Smart converters.</p>
                            </div>
                        </div>
                        <Link href="/pdf" className="absolute inset-0" />
                    </motion.div>

                </motion.div>

                {/* FOOTER */}
                <footer className="mt-32 pt-16 border-t border-[#E5E5E5] flex flex-col md:flex-row justify-between items-start md:items-center gap-12 text-[10px] uppercase font-black tracking-widest selection:bg-black selection:text-white pb-16">
                    <div className="flex flex-wrap gap-x-12 gap-y-6 opacity-40">
                        <Link href="/terms" className="hover:opacity-100 hover:text-black transition-all">Terms of Service</Link>
                        <Link href="/privacy" className="hover:opacity-100 hover:text-black transition-all">Privacy Policy</Link>
                        <a href="mailto:shyngyskhan.amangeldy@astanaithub.kz" className="hover:opacity-100 hover:text-black transition-all">Get in Touch</a>
                    </div>
                    
                    <div className="flex items-center gap-8">
                        <div className="flex gap-6 opacity-40">
                            <a href="https://linkedin.com/in/perricheno" target="_blank" className="hover:opacity-100 hover:text-red-500 transition-all font-black">LinkedIn</a>
                            <a href="https://t.me/perricheno" target="_blank" className="hover:opacity-100 hover:text-blue-500 transition-all font-black">Telegram</a>
                        </div>
                        <p className="opacity-20">© 2026 PERRICHENO INC.</p>
                    </div>
                </footer>
            </main>
        </div>
    );
}
