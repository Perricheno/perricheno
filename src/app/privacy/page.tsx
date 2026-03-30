"use client";

import { useState } from "react";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { motion } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PRIVACY_CONTENT } from "@/data/privacy_content";

export default function PrivacyPage() {
    const [lang, setLang] = useState<'en' | 'ru'>('ru');

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans selection:bg-black selection:text-white">
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-24">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16">
                    <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-40 hover:opacity-100 transition-opacity group">
                        <IconArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
                    </Link>

                    <div className="flex bg-[var(--border)] p-1 rounded-lg">
                        <button 
                            onClick={() => setLang('en')} 
                            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${lang === 'en' ? 'bg-black text-white shadow-sm' : 'text-gray-400 hover:text-black'}`}
                        >
                            English
                        </button>
                        <button 
                            onClick={() => setLang('ru')} 
                            className={`px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-md transition-all ${lang === 'ru' ? 'bg-black text-white shadow-sm' : 'text-gray-400 hover:text-black'}`}
                        >
                            Русский
                        </button>
                    </div>
                </div>

                <motion.div 
                    key={lang}
                    initial={{ opacity: 0, x: lang === 'en' ? -10 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="prose prose-sm prose-gray max-w-none 
                               prose-headings:text-black prose-headings:tracking-tighter prose-headings:font-bold
                               prose-h1:text-5xl prose-h1:mb-12 prose-h1:border-b prose-h1:pb-8 prose-h1:border-[var(--border)]
                               prose-h2:text-2xl prose-h2:mt-16 prose-h2:mb-6
                               prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-6
                               prose-strong:text-black prose-strong:font-bold
                               prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-6
                               prose-li:text-gray-600 prose-li:mb-2"
                >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {PRIVACY_CONTENT[lang]}
                    </ReactMarkdown>
                </motion.div>

                <footer className="mt-32 pt-8 border-t border-[var(--border)] opacity-30 text-[11px] uppercase tracking-widest font-bold flex flex-col md:flex-row justify-between gap-4">
                    <p>Last Updated: March 30, 2026 • © Perricheno Inc.</p>
                    <div className="flex gap-4">
                        <Link href="/terms" className="hover:text-black">Terms of Service</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
