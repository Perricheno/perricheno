"use client";

import { IconFileText, IconBook, IconDownload, IconPackage, IconX } from "@tabler/icons-react";
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

    const displayedCode = activeTab === "tex" ? mainTex : (referencesBib || "");
    const displayedFilename = activeTab === "tex" ? "main.tex" : "references.bib";

    const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    const downloadZip = async () => {
        const zip = new JSZip();
        zip.file("main.tex", mainTex);
        if (referencesBib) zip.file("references.bib", referencesBib);
        
        visuals.forEach((img, i) => {
            // Remove data:image/png;base64, prefix if present
            const cleanBase64 = img.image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
            try {
                const binary = atob(cleanBase64);
                const bytes = new Uint8Array(binary.length);
                for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
                const ext = img.language === 'Python' ? 'py' : 'R';
                
                // Align with LaTeX template (images/ folder)
                zip.file(`images/fig_${i + 1}_${img.chart_type}.png`, bytes);
                if (img.code) zip.file(`images/fig_${i + 1}_${img.chart_type}.${ext}`, img.code);
            } catch (e) {
                console.error("Failed to decode visual image base64:", e);
            }
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `shared_${Date.now()}.zip`;
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full h-full flex flex-col font-sans bg-[var(--background)] overflow-hidden">
            {/* Header */}
            <div className="h-16 border-b border-[var(--border)] flex items-center px-6 bg-[var(--card)] shrink-0 justify-between">
                <div>
                    <h1 className="text-sm font-bold">{title}</h1>
                    <p className="text-xs text-gray-400">{docType.replace("_", " ")} • shared • {new Date(createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={downloadZip} className="flex items-center gap-2 px-4 py-2 bg-[var(--foreground)] text-[var(--card)] rounded-full text-xs font-semibold hover:opacity-90 transition-opacity">
                    <IconPackage className="w-3.5 h-3.5" /> Download ZIP
                </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Code viewer */}
                <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--border)]">
                    <div className="h-10 bg-white border-b border-[var(--border)] flex items-center px-4 gap-3 shrink-0">
                        <button onClick={() => setActiveTab("tex")} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-semibold transition-colors ${activeTab === "tex" ? "bg-emerald-50 text-emerald-600" : "text-gray-400 hover:text-gray-600"}`}>
                            <IconFileText className="w-3.5 h-3.5" /> main.tex
                        </button>
                        {referencesBib && (
                            <button onClick={() => setActiveTab("bib")} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-semibold transition-colors ${activeTab === "bib" ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}>
                                <IconBook className="w-3.5 h-3.5" /> references.bib
                            </button>
                        )}
                        <button onClick={() => downloadFile(displayedCode, displayedFilename)} className="ml-auto text-gray-400 hover:text-gray-600 transition-colors">
                            <IconDownload className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-6 font-mono text-[13px] leading-relaxed text-gray-700 bg-gray-50/50">
                        <pre className="m-0 whitespace-pre-wrap"><code>{displayedCode}</code></pre>
                    </div>
                </div>

                {/* Images panel */}
                {visuals.length > 0 && (
                    <div className="w-full lg:w-80 overflow-y-auto p-4 space-y-3 bg-[var(--background)]">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Visualizations</h3>
                        {visuals.map((img, i) => (
                            <div key={i} onClick={() => setSelectedImage(i)} className="cursor-pointer rounded-xl overflow-hidden border border-[var(--border)] hover:border-gray-400 transition-colors bg-white">
                                <img src={`data:image/png;base64,${img.image}`} alt={img.chart_type} className="w-full" />
                                <div className="px-3 py-2 text-xs text-gray-500 font-medium">{img.chart_type.replace("_", " ")}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
