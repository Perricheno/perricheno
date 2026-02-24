"use client";

import { useState } from "react";
import Link from "next/link";
import { IconPlus, IconArrowLeft } from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";

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
        <div className="w-full h-full">

            <div className="max-w-[1600px] mx-auto px-6 py-20 md:py-28">
                <Link href="/" className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-100 mb-6 transition-opacity">
                    <IconArrowLeft className="w-4 h-4" /> Back to Home
                </Link>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-8">
                    Analytics.
                </h1>

                <div className="w-full border border-[var(--border)] overflow-hidden">

                    {/* Tabs */}
                    <div className="flex items-center gap-px bg-[var(--border)] overflow-x-auto p-px">
                        {dashboards.map(d => (
                            <button key={d.id} onClick={() => setActiveDashboard(d.id)}
                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors flex-1 md:flex-none text-left
                                    ${activeDashboard === d.id 
                                        ? "bg-[var(--background)] text-[var(--foreground)]" 
                                        : "bg-[var(--background)] text-[var(--foreground)] opacity-50 hover:opacity-80"}`}>
                                {isEditing ? (
                                    <input value={d.title}
                                        onChange={(e) => setDashboards(prev => prev.map(dd => dd.id === d.id ? { ...dd, title: e.target.value } : dd))}
                                        className="bg-transparent outline-none w-full min-w-[100px]" onClick={(e) => e.stopPropagation()} />
                                ) : d.title}
                            </button>
                        ))}
                        {isEditing && (
                            <button onClick={addDashboardTab}
                                className="px-3 py-3 bg-[var(--background)] text-[var(--foreground)] opacity-30 hover:opacity-100 transition-opacity">
                                <IconPlus className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="bg-[var(--background)] p-4 md:p-6 min-h-[600px]">
                        {currentDash?.iframeUrl ? (
                            <div className="relative w-full h-[60vh] md:h-[70vh] border border-[var(--border)]">
                                <iframe src={currentDash.iframeUrl} className="absolute inset-0 w-full h-full border-0" allowFullScreen title={currentDash.title} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-32 text-[var(--foreground)] opacity-30 gap-4">
                                {isEditing ? (
                                    <>
                                        <p className="text-sm">Paste an iframe tag or URL to embed a dashboard</p>
                                        <div className="flex gap-2 w-full max-w-lg">
                                            <input value={dashboardInput} onChange={(e) => setDashboardInput(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-[var(--border)] bg-transparent text-xs outline-none focus:border-[var(--foreground)]"
                                                placeholder="Paste <iframe> tag or URL..." />
                                            <button onClick={embedDashboard}
                                                className="px-4 py-2 bg-[var(--foreground)] text-[var(--background)] text-xs font-bold hover:opacity-80">
                                                Embed
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm">No dashboard embedded yet</p>
                                )}
                            </div>
                        )}
                        {isEditing && currentDash?.iframeUrl && (
                            <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                                <input value={dashboardInput} onChange={(e) => setDashboardInput(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-[var(--border)] bg-transparent text-xs outline-none focus:border-[var(--foreground)]"
                                    placeholder="Replace: paste <iframe> tag or URL..." />
                                <button onClick={embedDashboard}
                                    className="px-4 py-2 bg-[var(--foreground)] text-[var(--background)] text-xs font-bold hover:opacity-80">
                                    Update
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
