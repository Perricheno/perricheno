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
        <div className="w-full min-h-screen h-screen flex flex-col font-sans bg-[#FBFBFC] overflow-hidden text-[#1a1a1a]">
            {/* Header */}
            <div className="h-16 border-b border-gray-100 flex items-center px-6 bg-white shrink-0 justify-between shadow-sm">
                <div>
                    <h1 className="text-sm font-bold text-black tracking-tight">{title}</h1>
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{docType.replace("_", " ")} • shared • {new Date(createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={downloadZip} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl active:scale-95">
                    <IconPackage className="w-4 h-4" /> Download ZIP
                </button>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Code viewer */}
                <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-50 bg-white">
                    <div className="h-12 bg-white border-b border-gray-50 flex items-center px-6 gap-4 shrink-0">
                        <button onClick={() => setActiveTab("tex")} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === "tex" ? "bg-black text-white shadow-lg" : "text-gray-300 hover:text-black"}`}>
                            <IconFileText className="w-3.5 h-3.5" /> main.tex
                        </button>
                        {referencesBib && (
                            <button onClick={() => setActiveTab("bib")} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === "bib" ? "bg-black text-white shadow-lg" : "text-gray-300 hover:text-black"}`}>
                                <IconBook className="w-3.5 h-3.5" /> references.bib
                            </button>
                        )}
                        <button onClick={() => downloadFile(displayedCode, displayedFilename)} className="ml-auto text-gray-300 hover:text-black transition-colors p-2">
                            <IconDownload className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-8 font-mono text-[13px] leading-relaxed text-[#52525B] bg-[#FAFAFA]">
                        <pre className="m-0 whitespace-pre-wrap"><code>{displayedCode}</code></pre>
                    </div>
                </div>

                {/* Images panel */}
                {visuals.length > 0 && (
                    <div className="w-full lg:w-80 overflow-y-auto p-6 space-y-4 bg-[#FBFBFC] border-t lg:border-t-0 lg:border-l border-gray-50">
                        <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] px-1 mb-2">Visualizations</h3>
                        {visuals.map((img, i) => {
                            const isBase64Ready = img.image.startsWith('data:image');
                            const imgSrc = isBase64Ready ? img.image : `data:image/png;base64,${img.image}`;
                            
                            return (
                                <div key={i} onClick={() => setSelectedImage(i)} className="group cursor-pointer rounded-2xl overflow-hidden border border-gray-100 hover:border-black transition-all bg-white shadow-sm hover:shadow-xl">
                                    <img src={imgSrc} alt={img.chart_type} className="w-full" />
                                    <div className="px-4 py-3 text-[10px] text-gray-400 font-black uppercase tracking-widest group-hover:text-black transition-colors">{img.chart_type.replace("_", " ")}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
