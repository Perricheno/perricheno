"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconSparkles } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import ChartCard from "./ChartCard";
import { CHARTS } from "./charts";

interface Props {
    selectedCharts: string[];
    suggestedCharts: string[];
    suggestReasoning: string;
    loading: boolean;
    onSelectChart: (id: string) => void;
    onClearCharts: () => void;
}

export default function ChartGallery({
    selectedCharts, suggestedCharts, suggestReasoning, loading,
    onSelectChart, onClearCharts,
}: Props) {
    const t = useTranslations("r");
    const [collapsed, setCollapsed] = useState(false);
    const [mobileCategory, setMobileCategory] = useState<string | null>(null);

    return (
        <section className="pb-4">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={() => setCollapsed(v => !v)}
                    className="flex items-center gap-2 group"
                >
                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.18em] group-hover:text-gray-400 transition-colors">
                        {t("chartTypes")} · {CHARTS.length} {t("available")}
                    </p>
                    <svg
                        width="10" height="10" viewBox="0 0 10 10"
                        className={`text-gray-300 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
                        fill="currentColor"
                    >
                        <path d="M5 7L1 3h8L5 7z" />
                    </svg>
                </button>
                {(selectedCharts.length > 0 || suggestedCharts.length > 0) && (
                    <button
                        onClick={onClearCharts}
                        className="text-[11px] text-gray-400 hover:text-[#1a1a1a] font-medium transition-colors"
                    >
                        {t("clear")}
                    </button>
                )}
            </div>

            <AnimatePresence initial={false}>
                {!collapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {/* AI reasoning banner */}
                        <AnimatePresence>
                            {suggestReasoning && suggestedCharts.length > 0 && !loading && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="flex items-start gap-2 px-3 py-2 mb-3 bg-[#f5f5f5] rounded-xl border border-[#e8e8e8]"
                                >
                                    <IconSparkles className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                                    <p className="text-[11px] text-gray-500 leading-snug">{suggestReasoning}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Mobile: category chips */}
                        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 md:hidden" style={{ scrollbarWidth: "none" }}>
                            <button
                                onClick={() => setMobileCategory(null)}
                                className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors
                                    ${mobileCategory === null ? "bg-[#1a1a1a] text-white" : "bg-[#f0f0f0] text-[#555]"}`}
                            >
                                All
                            </button>
                            {[...new Set(CHARTS.map(c => c.tag))].map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setMobileCategory(tag === mobileCategory ? null : tag)}
                                    className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors
                                        ${mobileCategory === tag ? "bg-[#1a1a1a] text-white" : "bg-[#f0f0f0] text-[#555]"}`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>

                        {/* Chart grid */}
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                            {CHARTS
                                .filter(c => !mobileCategory || c.tag === mobileCategory)
                                .map(chart => (
                                    <ChartCard
                                        key={chart.id}
                                        chart={chart}
                                        selected={selectedCharts.includes(chart.id)}
                                        suggested={suggestedCharts.includes(chart.id) && !selectedCharts.includes(chart.id)}
                                        onClick={() => onSelectChart(chart.id)}
                                    />
                                ))}
                        </div>

                        <p className="text-[10px] text-gray-300 mt-3 font-medium hidden md:block">
                            {t("hoverHint")}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
