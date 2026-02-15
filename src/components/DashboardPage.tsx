"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";
import { AdminBar } from "@/components/AdminBar";
import { motion } from "framer-motion";

interface Dashboard {
    id: string;
    title: string;
    iframeUrl: string;
}

function parseIframeUrl(input: string): string {
    const trimmed = input.trim();
    const match = trimmed.match(/src=["']([^"']+)["']/i);
    if (match) return match[1];
    return trimmed;
}

export default function DashboardPage() {
    const { isEditing } = useAdmin();

    const [dashboards, setDashboards] = useState<Dashboard[]>([
        { id: "d1", title: "Kazakhstan Economic Stats", iframeUrl: "https://app.powerbi.com/reportEmbed?reportId=88185ea2-6669-4117-9a08-71891520fb94&autoAuth=true&ctid=158f15f3-83e0-4906-824c-69bdc50d9d61" },
        { id: "d2", title: "Marketing Analytics", iframeUrl: "" },
    ]);
    const [activeDashboard, setActiveDashboard] = useState<string>("d1");
    const [dashboardInput, setDashboardInput] = useState("");

    const currentDash = dashboards.find(d => d.id === activeDashboard);

    const embedDashboard = () => {
        if (!dashboardInput.trim()) return;
        const url = parseIframeUrl(dashboardInput);
        setDashboards(prev => prev.map(d => d.id === activeDashboard ? { ...d, iframeUrl: url } : d));
        setDashboardInput("");
    };

    const addDashboardTab = () => {
        const newId = "d" + Date.now();
        setDashboards(prev => [...prev, { id: newId, title: "Dashboard " + (prev.length + 1), iframeUrl: "" }]);
        setActiveDashboard(newId);
    };

    return (
        <div className="relative z-10 w-full min-h-screen">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-2xl" />
            <AdminBar />

            <div className="relative z-10 max-w-[1600px] mx-auto px-4 py-28 md:pl-24">
                <motion.h1 className="text-4xl md:text-5xl font-bold text-white mb-8"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    Analytics Dashboard
                </motion.h1>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl overflow-hidden">

                    {/* Tabs */}
                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06] overflow-x-auto">
                        {dashboards.map(d => (
                            <motion.button key={d.id} onClick={() => setActiveDashboard(d.id)}
                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${activeDashboard === d.id ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400" : "bg-white/5 border border-transparent text-white/50 hover:bg-white/10"}`}>
                                {isEditing ? (
                                    <input value={d.title}
                                        onChange={(e) => setDashboards(prev => prev.map(dd => dd.id === d.id ? { ...dd, title: e.target.value } : dd))}
                                        className="bg-transparent outline-none w-28 text-center" onClick={(e) => e.stopPropagation()} />
                                ) : d.title}
                            </motion.button>
                        ))}
                        {isEditing && (
                            <motion.button onClick={addDashboardTab} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                className="p-1.5 rounded-lg bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all">
                                <IconPlus className="w-3.5 h-3.5" />
                            </motion.button>
                        )}
                    </div>

                    {/* Content */}
                    {currentDash?.iframeUrl ? (
                        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                            <iframe src={currentDash.iframeUrl} className="absolute inset-0 w-full h-full border-0" allowFullScreen title={currentDash.title} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-white/20 gap-4">
                            {isEditing ? (
                                <>
                                    <p className="text-sm">Paste an iframe tag or URL to embed a dashboard</p>
                                    <div className="flex gap-2 w-full max-w-lg px-4">
                                        <input value={dashboardInput} onChange={(e) => setDashboardInput(e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-emerald-500 placeholder:text-white/15"
                                            placeholder="Paste <iframe> tag or URL (Power BI, Tableau, YouTube...)" />
                                        <motion.button onClick={embedDashboard} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                            className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                                            Embed
                                        </motion.button>
                                    </div>
                                </>
                            ) : (
                                <motion.p className="text-sm" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity }}>
                                    No dashboard embedded yet
                                </motion.p>
                            )}
                        </div>
                    )}
                    {isEditing && currentDash?.iframeUrl && (
                        <div className="flex gap-2 p-3 border-t border-white/[0.06]">
                            <input value={dashboardInput} onChange={(e) => setDashboardInput(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/[0.06] text-white text-xs outline-none focus:border-emerald-500 placeholder:text-white/15"
                                placeholder="Replace: paste <iframe> tag or URL..." />
                            <motion.button onClick={embedDashboard} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                                Update
                            </motion.button>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
