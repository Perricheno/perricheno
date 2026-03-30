"use client";

import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { motion } from "framer-motion";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-6 md:p-12 lg:p-20 font-sans selection:bg-black selection:text-white">
            <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-40 hover:opacity-100 transition-opacity mb-12 group">
                <IconArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
            </Link>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
            >
                <div className="mb-20">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">Terms of Service.</h1>
                    <p className="text-xl opacity-40">User Agreement for Perricheno Inc. platforms.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
                    {/* ENGLISH VERSION */}
                    <div className="space-y-8 text-[15px] leading-relaxed opacity-80">
                        <section>
                            <h2 className="text-black font-bold uppercase tracking-widest text-[11px] mb-4">1. Acceptance of Terms</h2>
                            <p>By accessing or using the Perricheno platform, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, you do not have permission to access the service.</p>
                        </section>

                        <section>
                            <h2 className="text-black font-bold uppercase tracking-widest text-[11px] mb-4">2. AI Services Disclaimer</h2>
                            <p>Perricheno uses artificial intelligence (LLMs) to generate LaTeX documents and R-code visualizations. We do not guarantee the absolute accuracy, completeness, or suitability of AI-generated content. Users are responsible for verifying all outputs before academic or professional submission.</p>
                        </section>

                        <section>
                            <h2 className="text-black font-bold uppercase tracking-widest text-[11px] mb-4">3. Prohibited Conduct</h2>
                            <p>Users are prohibited from using the platform for generating malicious code, plagiarism, or any content that violates intellectual property rights. Perricheno Inc. reserves the right to terminate accounts that violate these guidelines.</p>
                        </section>

                        <section>
                            <h2 className="text-black font-bold uppercase tracking-widest text-[11px] mb-4">4. Intellectual Property</h2>
                            <p>The code, design, and assets of the Perricheno platform are owned by Perricheno Inc. However, users retain ownership of the original text content they provide and the resulting documents generated through the platform.</p>
                        </section>
                    </div>

                    {/* RUSSIAN VERSION */}
                    <div className="space-y-8 text-[15px] leading-relaxed opacity-80 border-t border-[var(--border)] pt-8 md:border-t-0 md:pt-0">
                        <section>
                            <h2 className="text-black font-bold uppercase tracking-widest text-[11px] mb-4">1. Принятие условий</h2>
                            <p>Используя платформу Perricheno, вы соглашаетесь с данными Условиями использования. Если вы не согласны с каким-либо пунктом, использование сервиса не разрешено.</p>
                        </section>

                        <section>
                            <h2 className="text-black font-bold uppercase tracking-widest text-[11px] mb-4">2. Отказ от ответственности ИИ</h2>
                            <p>Perricheno использует искусственный интеллект для генерации документов LaTeX и визуализаций кода R. Мы не гарантируем абсолютную точность или пригодность контента, созданного ИИ. Пользователи несут полную ответственность за проверку результатов перед публикацией.</p>
                        </section>

                        <section>
                            <h2 className="text-black font-bold uppercase tracking-widest text-[11px] mb-4">3. Запрещенное поведение</h2>
                            <p>Запрещается использовать платформу для создания вредоносного кода, плагиата или любого контента, нарушающего права интеллектуальной собственности. Perricheno Inc. оставляет за собой право блокировать такие сессии.</p>
                        </section>

                        <section>
                            <h2 className="text-black font-bold uppercase tracking-widest text-[11px] mb-4">4. Интеллектуальная собственность</h2>
                            <p>Дизайн, код и активы платформы принадлежат Perricheno Inc. Однако пользователи сохраняют права собственности на свои текстовые входные данные и результирующие сгенерированные документы.</p>
                        </section>
                    </div>
                </div>

                <footer className="mt-24 pt-8 border-t border-[var(--border)] opacity-30 text-[11px] uppercase tracking-widest">
                    Last Updated: March 30, 2026 • © Perricheno Inc.
                </footer>
            </motion.div>
        </div>
    );
}
