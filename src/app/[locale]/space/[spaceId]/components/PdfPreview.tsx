"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertTriangle, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download } from "lucide-react";

type Status = 'empty' | 'loading' | 'ready' | 'error';

interface Props {
    pdfUrl: string | null;
    status: Status;
    errorLog: string | null;
    onGoToLine: (line: number) => void;
}

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 175, 200];

export default function PdfPreview({ pdfUrl, status, errorLog, onGoToLine }: Props) {
    const [zoom, setZoom] = useState(100);
    const zoomIn  = () => setZoom(z => ZOOM_LEVELS[Math.min(ZOOM_LEVELS.indexOf(z) + 1, ZOOM_LEVELS.length - 1)] ?? z);
    const zoomOut = () => setZoom(z => ZOOM_LEVELS[Math.max(ZOOM_LEVELS.indexOf(z) - 1, 0)] ?? z);

    const downloadPdf = () => {
        if (!pdfUrl) return;
        const a = document.createElement('a');
        a.href = pdfUrl; a.download = 'document.pdf';
        document.body.appendChild(a); a.click(); a.remove();
    };

    return (
        <div className="flex flex-col h-full bg-[#1a1a1a]">
            {/* PDF toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2a2a2a] shrink-0">
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Preview</span>
                <div className="flex items-center gap-1">
                    <button onClick={zoomOut} className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/5 transition-colors">
                        <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] text-gray-500 w-10 text-center">{zoom}%</span>
                    <button onClick={zoomIn} className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/5 transition-colors">
                        <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    {pdfUrl && (
                        <>
                            <div className="w-px h-3 bg-white/10 mx-1" />
                            <button onClick={downloadPdf} className="p-1 rounded text-gray-600 hover:text-white hover:bg-white/5 transition-colors">
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto flex items-start justify-center py-4">
                <AnimatePresence mode="wait">
                    {status === 'loading' && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-full gap-3 text-gray-600 py-20">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <span className="text-[12px]">Compiling…</span>
                        </motion.div>
                    )}
                    {status === 'ready' && pdfUrl && (
                        <motion.div key="pdf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="shadow-2xl rounded overflow-hidden"
                            style={{ width: `${zoom}%`, minWidth: `${zoom}%` }}>
                            <iframe
                                src={pdfUrl}
                                className="w-full border-0"
                                style={{ height: `calc(${zoom / 100} * 80vh)`, minHeight: 400 }}
                                title="PDF Preview"
                            />
                        </motion.div>
                    )}
                    {status === 'empty' && (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-24 gap-3 text-gray-700">
                            <div className="w-16 h-20 rounded border-2 border-dashed border-[#333] flex items-center justify-center">
                                <span className="text-[10px] font-bold text-[#444]">PDF</span>
                            </div>
                            <p className="text-[12px]">Press Compile to generate preview</p>
                        </motion.div>
                    )}
                    {status === 'error' && (
                        <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="w-full px-4 py-4 max-w-xl">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                <span className="text-[12px] font-bold text-red-400">Compilation failed</span>
                            </div>
                            <pre className="text-[11px] text-red-300 bg-red-950/30 rounded-lg p-3 overflow-auto max-h-96 leading-relaxed whitespace-pre-wrap">
                                {errorLog}
                            </pre>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
