import { useState, useRef, useEffect } from "react";
import { IconDeviceFloppy, IconPlayerPlay, IconX, IconLoader2, IconDownload, IconWand, IconArrowRight } from "@tabler/icons-react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { RImage } from "./types";
import { motion, AnimatePresence } from "framer-motion";

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

    // AI Editing State
    const [isEditingMode, setIsEditingMode] = useState(false);
    const [editPrompt, setEditPrompt] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const codeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (codeRef.current && isStreaming) {
            codeRef.current.scrollTop = codeRef.current.scrollHeight;
        }
    }, [code]);

    const handleCompile = async (codeToRun: string = code) => {
        setIsCompiling(true);
        setError(null);
        try {
            const res = await fetch('/api/agent/r-compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: codeToRun })
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

    const handleAIEdit = async () => {
        if (!editPrompt.trim() || isStreaming) return;
        setIsStreaming(true);
        setError(null);
        
        const oldCode = code;
        setCode(""); // Clear logic to show streaming

        try {
            const res = await fetch('/api/agent/visualize/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentCode: oldCode, editPrompt })
            });

            if (!res.ok) throw new Error("AI Edit failed");

            const data = await res.json();
            const newCode = data.code;
            setCode(newCode);

            setEditPrompt("");
            setIsEditingMode(false);
            
            // Auto compile after AI finishes writing code
            await handleCompile(newCode);

        } catch (err: any) {
            setError(err.message);
            setCode(oldCode); // Revert on failure
        } finally {
            setIsStreaming(false);
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
                className="w-full max-w-6xl h-[90vh] flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] shadow-2xl overflow-hidden relative"
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
                            onClick={() => setIsEditingMode(!isEditingMode)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors rounded-lg text-[12px] font-bold ${isEditingMode ? 'bg-purple-50 text-purple-600' : 'text-gray-400 hover:text-purple-600'}`}
                        >
                            <IconWand className="w-4 h-4" /> AI Edit
                        </button>
                        <button
                            onClick={() => handleCompile(code)}
                            disabled={isCompiling || isStreaming}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[13px] font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                            {isCompiling ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconPlayerPlay className="w-4 h-4" />}
                            Run & Preview
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isStreaming}
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
                <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                    {/* Code editor */}
                    <div className="w-full lg:w-1/2 h-full flex flex-col border-r border-[var(--border)] relative">
                        <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3 shrink-0">
                            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                                <span>source.R</span>
                                {isStreaming && <span className="text-purple-400 animate-pulse font-bold ml-2">AI typing...</span>}
                            </div>
                            <button onClick={downloadCode} className="text-gray-400 hover:text-white" title="Download R code">
                                <IconDownload className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div ref={codeRef} className="flex-1 overflow-auto bg-[#282c34]">
                            <CodeMirror
                                value={code + (isStreaming ? "\n█" : "")}
                                onChange={(val) => { if (!isStreaming) setCode(val) }}
                                theme={oneDark}
                                height="100%"
                                className="h-full text-[13px]"
                                editable={!isStreaming}
                            />
                        </div>
                        {/* AI Edit Floating Input */}
                        <AnimatePresence>
                            {isEditingMode && (
                                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="absolute bottom-4 left-4 right-4 shadow-xl border border-purple-200 rounded-xl overflow-hidden bg-white flex flex-col">
                                    <div className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-white text-[11px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-purple-100">
                                       <IconWand className="w-3.5 h-3.5" /> Instruct AI
                                    </div>
                                    <textarea
                                        value={editPrompt}
                                        onChange={e => setEditPrompt(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAIEdit(); } }}
                                        placeholder="E.g., Change the bar colors to red, add a trendline..."
                                        disabled={isStreaming}
                                        className="w-full outline-none p-3 text-[13px] text-gray-700 bg-white placeholder:text-gray-300 resize-none"
                                        rows={2}
                                    />
                                    <div className="flex justify-end p-2 border-t border-purple-50 bg-gray-50/50">
                                        <button onClick={handleAIEdit} disabled={!editPrompt.trim() || isStreaming} className="p-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-full disabled:opacity-50 transition-colors">
                                            {isStreaming ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconArrowRight className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Preview */}
                    <div className="w-full lg:w-1/2 h-full flex flex-col bg-gray-50 dark:bg-[#1e1e1e]">
                        <div className="h-8 border-b border-[var(--border)] flex items-center px-3 shrink-0 bg-[var(--background)]">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Compiler Output</span>
                        </div>
                        <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center gap-4 relative">
                            {preview ? (
                                <img src={`data:image/png;base64,${preview}`} alt="plot" className={`max-w-full max-h-full object-contain drop-shadow-md rounded-lg transition-opacity ${isCompiling ? 'opacity-30 blur-sm' : 'opacity-100'}`} />
                            ) : (
                                <span className="text-sm text-gray-400 font-mono">No output</span>
                            )}

                            {error && (
                                <div className="absolute bottom-4 left-4 right-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl shadow-lg z-10">
                                    <h4 className="text-[11px] font-bold uppercase mb-1 flex items-center justify-between">
                                        Compilation Error
                                        <button onClick={() => setError(null)}><IconX className="w-4 h-4" /></button>
                                    </h4>
                                    <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-auto">{error}</pre>
                                </div>
                            )}

                            {isCompiling && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-0">
                                    <div className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
                                        <IconLoader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                    </div>
                                    <span className="mt-4 text-xs font-bold text-gray-500 uppercase tracking-widest animation-pulse">Rendering...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
