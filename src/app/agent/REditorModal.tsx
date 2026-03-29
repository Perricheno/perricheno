import { useState } from "react";
import { IconDeviceFloppy, IconPlayerPlay, IconX, IconLoader2, IconDownload } from "@tabler/icons-react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { RImage } from "./types";
import { motion } from "framer-motion";

interface Props {
    image: RImage;
    index: number;
    onClose: () => void;
    onSave: (index: number, newImg: RImage) => void;
    sessionId: string | null;
}

export function REditorModal({ image, index, onClose, onSave, sessionId }: Props) {
    const [code, setCode] = useState(image.r_code);
    const [preview, setPreview] = useState(image.image);
    const [isCompiling, setIsCompiling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCompile = async () => {
        setIsCompiling(true);
        setError(null);
        try {
            const res = await fetch('/api/agent/r-compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            if (!res.ok) throw new Error("Compilation failed");

            const data = await res.json();
            if (data.success && data.image) {
                setPreview(data.image);
            } else {
                throw new Error(data.log || "Unknown R error");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsCompiling(false);
        }
    };

    const handleSave = () => {
        onSave(index, { ...image, image: preview, r_code: code });
        onClose();
    };

    const downloadCode = () => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
        a.download = `fig_${index + 1}_${image.chart_type}.R`;
        a.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-6xl h-[85vh] flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="h-14 border-b border-[var(--border)] flex flex-wrap items-center justify-between px-4 shrink-0 bg-[var(--background)]">
                    <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-md">
                            R Editor
                        </span>
                        <span className="text-sm font-semibold max-w-[150px] truncate md:max-w-none">
                            {image.chart_type.replace("_", " ")}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCompile}
                            disabled={isCompiling}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[13px] font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                            {isCompiling ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconPlayerPlay className="w-4 h-4" />}
                            Run & Preview
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--foreground)] text-[var(--card)] rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity"
                        >
                            <IconDeviceFloppy className="w-4 h-4" /> Save
                        </button>
                        <div className="w-px h-6 bg-[var(--border)] mx-1" />
                        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-[var(--foreground)] transition-colors rounded-md">
                            <IconX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
                    {/* Code editor */}
                    <div className="w-full md:w-1/2 h-full flex flex-col border-r border-[var(--border)]">
                        <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3 shrink-0">
                            <span className="text-[11px] font-semibold text-gray-400 font-mono">source.R</span>
                            <button onClick={downloadCode} className="text-gray-400 hover:text-white" title="Download R code">
                                <IconDownload className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-[#282c34]">
                            <CodeMirror
                                value={code}
                                onChange={setCode}
                                theme={oneDark}
                                height="100%"
                                className="h-full text-[13px]"
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="w-full md:w-1/2 h-full flex flex-col bg-gray-50 dark:bg-[#1e1e1e]">
                        <div className="h-8 border-b border-[var(--border)] flex items-center px-3 shrink-0 bg-[var(--background)]">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Compiler Output</span>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center gap-4 relative">
                            {preview ? (
                                <img src={`data:image/png;base64,${preview}`} alt="plot" className="max-w-full max-h-full object-contain drop-shadow-md rounded-lg" />
                            ) : (
                                <span className="text-sm text-gray-400 font-mono">No output</span>
                            )}

                            {error && (
                                <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl shadow-lg">
                                    <h4 className="text-xs font-bold uppercase mb-1">Compilation Error</h4>
                                    <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-auto">{error}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
