import fs from "fs";
import path from "path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getTranslations } from "next-intl/server";

export default async function TermsPage() {
    const t = await getTranslations("terms");
    const contentEn = fs.readFileSync(path.join(process.cwd(), "src/content/terms_en.md"), "utf8");
    const contentRu = fs.readFileSync(path.join(process.cwd(), "src/content/terms_ru.md"), "utf8");

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-black selection:text-white">
            <div className="max-w-7xl mx-auto px-6 py-12 md:py-24">

                {/* NAVIGATION */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-40 hover:opacity-100 transition-opacity mb-16 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {t("backToHome")}
                </Link>

                {/* HERO HEADER */}
                <header className="mb-24">
                    <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-4">{t("title")}</h1>
                    <p className="text-xl md:text-2xl font-light opacity-40">{t("subtitle")}</p>
                </header>

                {/* SIDE-BY-SIDE CONTENT */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32">

                    {/* ENGLISH */}
                    <div className="space-y-12 legal-markdown">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({node, ...props}) => <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-6 text-black" {...props} />,
                                p: ({node, ...props}) => <p className="text-[15px] leading-[1.8] opacity-80 mb-8 font-light" {...props} />,
                            }}
                        >
                            {contentEn}
                        </ReactMarkdown>
                    </div>

                    {/* RUSSIAN */}
                    <div className="space-y-12 legal-markdown">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({node, ...props}) => <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-6 text-black" {...props} />,
                                p: ({node, ...props}) => <p className="text-[15px] leading-[1.8] opacity-80 mb-8 font-light" {...props} />,
                            }}
                        >
                            {contentRu}
                        </ReactMarkdown>
                    </div>

                </div>

                {/* FOOTER */}
                <footer className="mt-40 pt-12 border-t border-[var(--border)] flex flex-col md:flex-row justify-between items-center gap-8 opacity-30 text-[11px] uppercase tracking-widest font-bold">
                    <p>{t("copyright")}</p>
                    <div className="flex gap-8">
                        <Link href="/privacy" className="hover:text-black transition-colors">{t("privacyPolicy")}</Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
