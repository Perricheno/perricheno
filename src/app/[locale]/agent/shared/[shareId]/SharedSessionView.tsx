"use client";

import { IconFileText, IconBook, IconDownload, IconPackage, IconX, IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useState } from "react";
import JSZip from "jszip";

import { CodeImage } from "../../types";

interface Props {
    title: string;
    docType: string;
    mainTex: string;
    referencesBib: string | null;
    visuals: CodeImage[];
    createdAt: string;
}

export default function SharedSessionView({ title, docType, mainTex, referencesBib, visuals, createdAt }: Props) {
    const [activeTab, setActiveTab] = useState<"tex" | "bib">("tex");
    const [selectedImage, setSelectedImage] = useState<number | null>(null);
    const [codeOpen, setCodeOpen] = useState(false);

    const displayedCode = activeTab === "tex" ? mainTex : (referencesBib || "");
    const displayedFilename = activeTab === "tex" ? "main.tex" : "references.bib";

    const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    const downloadZip = async () => {
        const zip = new JSZip();
        zip.file("main.tex", mainTex);
        if (referencesBib) zip.file("references.bib", referencesBib);
        visuals.forEach((img, i) => {
            const cleanBase64 = img.image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
            try {
                const binary = atob(cleanBase64);
                const bytes = new Uint8Array(binary.length);
                for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                const ext = img.language === 'Python' ? 'py' : 'R';
                zip.file(`images/fig_${i + 1}_${img.chart_type}.png`, bytes);
                if (img.code) zip.file(`images/fig_${i + 1}_${img.chart_type}.${ext}`, img.code);
            } catch (e) { console.error("Failed to decode visual image base64:", e); }
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `shared_${Date.now()}.zip`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full min-h-screen flex flex-col font-sans bg-[#F8F8F8] text-[#1a1a1a]">

            {/* Header */}
            <div className="bg-white border-b border-[#ebebeb] px-5 md:px-8 py-4 flex items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
                <div className="min-w-0">
                    <h1 className="text-[14px] md:text-[16px] font-bold text-[#1a1a1a] truncate">{title}</h1>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                        {docType.replace(/_/g, " ")} · {new Date(createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                </div>
                <button
                    onClick={downloadZip}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white rounded-xl text-[11px] font-bold uppercase tracking-wide hover:bg-[#333] transition-colors shadow-md"
                >
                    <IconPackage className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download ZIP</span>
                    <span className="sm:hidden">ZIP</span>
                </button>
            </div>

            <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-8 py-6 space-y-6">

                {/* ── Visualizations ── */}
                {visuals.length > 0 && (
                    <section>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">
                            Visualizations · {visuals.length}
                        </p>
                        <div className={`grid gap-4 ${visuals.length === 1 ? "grid-cols-1 max-w-lg" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
                            {visuals.map((img, i) => {
                                const isBase64Ready = img.image.startsWith("data:image");
                                const imgSrc = isBase64Ready ? img.image : `data:image/png;base64,${img.image}`;
                                const chartLabel = (img.chart_type || (img as any).chartType || "chart").replace(/_/g, " ");
                                return (
                                    <div
                                        key={i}
                                        onClick={() => setSelectedImage(i)}
                                        className="group cursor-zoom-in bg-white rounded-2xl border border-[#e8e8e8] shadow-sm hover:shadow-md hover:border-[#ccc] overflow-hidden transition-all"
                                    >
                                        <div className="bg-[#fafafa] flex items-center justify-center p-3 min-h-[180px]">
                                            <img src={imgSrc} alt={chartLabel} className="max-w-full max-h-[240px] object-contain" />
                                        </div>
                                        <div className="px-3 py-2 border-t border-[#f0f0f0] flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide truncate">{chartLabel}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); downloadFile(imgSrc, `fig_${i + 1}_${img.chart_type}.png`); }}
                                                className="shrink-0 p-1 text-gray-300 hover:text-[#1a1a1a] transition-colors"
                                                title="Download image"
                                            >
                                                <IconDownload className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── LaTeX source (collapsible) ── */}
                <section className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden">
                    <button
                        onClick={() => setCodeOpen(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#fafafa] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <IconFileText className="w-4 h-4 text-gray-400" />
                            <span className="text-[12px] font-bold text-[#1a1a1a]">LaTeX Source</span>
                            <span className="text-[10px] font-mono text-gray-400 bg-[#f5f5f5] px-2 py-0.5 rounded">
                                {Math.round(mainTex.length / 1024)}KB
                            </span>
                        </div>
                        {codeOpen
                            ? <IconChevronUp className="w-4 h-4 text-gray-400" />
                            : <IconChevronDown className="w-4 h-4 text-gray-400" />
                        }
                    </button>

                    {codeOpen && (
                        <>
                            <div className="border-t border-[#f0f0f0] flex items-center px-4 py-2 gap-3 bg-[#fafafa]">
                                <button
                                    onClick={() => setActiveTab("tex")}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${activeTab === "tex" ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:text-[#1a1a1a]"}`}
                                >
                                    main.tex
                                </button>
                                {referencesBib && (
                                    <button
                                        onClick={() => setActiveTab("bib")}
                                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${activeTab === "bib" ? "bg-[#1a1a1a] text-white" : "text-gray-400 hover:text-[#1a1a1a]"}`}
                                    >
                                        references.bib
                                    </button>
                                )}
                                <button
                                    onClick={() => downloadFile(displayedCode, displayedFilename)}
                                    className="ml-auto flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-[#1a1a1a] transition-colors"
                                >
                                    <IconDownload className="w-3.5 h-3.5" /> Download
                                </button>
                            </div>
                            <div className="overflow-auto max-h-[60vh] p-5 bg-[#FAFAFA]">
                                <pre className="font-mono text-[12px] leading-relaxed text-[#52525B] whitespace-pre-wrap m-0">
                                    <code>{displayedCode}</code>
                                </pre>
                            </div>
                        </>
                    )}
                </section>
            </div>

            {/* Lightbox */}
            {selectedImage !== null && visuals[selectedImage] && (() => {
                const img = visuals[selectedImage];
                const isBase64Ready = img.image.startsWith("data:image");
                const imgSrc = isBase64Ready ? img.image : `data:image/png;base64,${img.image}`;
                return (
                    <div
                        className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 md:p-8"
                        onClick={() => setSelectedImage(null)}
                    >
                        <div
                            className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-3xl w-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
                                <span className="text-[12px] font-bold text-[#1a1a1a] capitalize">
                                    {(img.chart_type || "chart").replace(/_/g, " ")}
                                </span>
                                <button onClick={() => setSelectedImage(null)} className="text-gray-400 hover:text-[#1a1a1a]">
                                    <IconX className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-4 bg-[#fafafa] flex items-center justify-center">
                                <img src={imgSrc} alt={img.chart_type} className="max-w-full max-h-[75vh] object-contain" />
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
