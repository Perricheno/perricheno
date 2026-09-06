"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2, Clock, RotateCw, Download, Check, AlertTriangle } from "lucide-react";

interface Version {
    id: string;
    label: string;
    message: string | null;
    created_by: number | null;
    created_at: string;
}

interface VersionDetail extends Version {
    snapshot: Record<string, string>;
}

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return new Date(iso).toLocaleDateString();
}

export default function HistoryPage() {
    const { spaceId } = useParams() as { spaceId: string };
    const router = useRouter();

    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading]   = useState(true);
    const [selected, setSelected] = useState<VersionDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [restoredId, setRestoredId] = useState<string | null>(null);
    const [activeFile, setActiveFile] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/space/${spaceId}/versions`)
            .then(r => r.json())
            .then(d => { setVersions(d.versions ?? []); setLoading(false); });
    }, [spaceId]);

    const loadDetail = async (v: Version) => {
        setLoadingDetail(true);
        const res = await fetch(`/api/space/${spaceId}/versions/${v.id}`);
        const data = await res.json();
        setSelected(data.version);
        setActiveFile(Object.keys(data.version.snapshot ?? {})[0] ?? null);
        setLoadingDetail(false);
    };

    const handleRestore = async () => {
        if (!selected || restoring) return;
        if (!confirm(`Restore to "${selected.label}"? Current state will be saved as a new version first.`)) return;
        setRestoring(true);
        await fetch(`/api/space/${spaceId}/versions/${selected.id}/restore`, { method: 'POST' });
        setRestoredId(selected.id);
        setRestoring(false);
        setTimeout(() => router.push(`/space/${spaceId}`), 1200);
    };

    const downloadSnapshot = () => {
        if (!selected) return;
        const content = JSON.stringify(selected.snapshot, null, 2);
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `snapshot-${selected.id.slice(0, 8)}.json`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-screen bg-[#141414] text-white">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[#2a2a2a] shrink-0">
                <button onClick={() => router.push(`/space/${spaceId}`)}
                    className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-white transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Back to editor
                </button>
                <div className="w-px h-4 bg-white/10" />
                <span className="text-[13px] font-bold text-white">Version History</span>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Versions list */}
                <div className="w-72 shrink-0 border-r border-[#2a2a2a] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-600" /></div>
                    ) : versions.length === 0 ? (
                        <p className="text-[12px] text-gray-600 text-center py-12">No versions yet</p>
                    ) : (
                        <div className="py-2">
                            {versions.map(v => (
                                <button key={v.id} onClick={() => loadDetail(v)}
                                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${selected?.id === v.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                    <Clock className="w-3.5 h-3.5 text-gray-600 mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-semibold text-white truncate">{v.label}</p>
                                        {v.message && <p className="text-[11px] text-gray-500 truncate mt-0.5">{v.message}</p>}
                                        <p className="text-[10px] text-gray-600 mt-1">{timeAgo(v.created_at)}</p>
                                    </div>
                                    {restoredId === v.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Snapshot viewer */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {loadingDetail && (
                        <div className="flex items-center justify-center flex-1"><Loader2 className="w-5 h-5 animate-spin text-gray-600" /></div>
                    )}
                    {!loadingDetail && !selected && (
                        <div className="flex items-center justify-center flex-1 text-gray-700 text-[13px]">
                            Select a version to preview
                        </div>
                    )}
                    {!loadingDetail && selected && (
                        <>
                            {/* Toolbar */}
                            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#2a2a2a] shrink-0">
                                <span className="text-[13px] font-bold text-white flex-1">{selected.label}</span>
                                <button onClick={downloadSnapshot}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                                    <Download className="w-3.5 h-3.5" /> Download
                                </button>
                                <button onClick={handleRestore} disabled={restoring}
                                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-colors disabled:opacity-50">
                                    {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                                    Restore
                                </button>
                            </div>

                            {/* File tabs */}
                            <div className="flex items-center gap-0 bg-[#1a1a1a] border-b border-[#2a2a2a] overflow-x-auto shrink-0">
                                {Object.keys(selected.snapshot).map(path => (
                                    <button key={path} onClick={() => setActiveFile(path)}
                                        className={`px-4 py-2 text-[12px] font-medium border-r border-[#2a2a2a] shrink-0 transition-colors ${
                                            activeFile === path ? 'bg-[#141414] text-white border-t-2 border-t-blue-500' : 'text-gray-500 hover:text-gray-300'
                                        }`}>
                                        {path.split('/').pop()}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-auto">
                                <pre className="text-[12px] text-gray-300 font-mono leading-relaxed p-4 whitespace-pre-wrap">
                                    {activeFile ? selected.snapshot[activeFile] : ''}
                                </pre>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
