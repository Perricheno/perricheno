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
                <div className="h-16 border-b border-gray-100 flex flex-wrap items-center justify-between px-6 shrink-0 bg-white">
                    <div className="flex items-center gap-4">
                        <span className="px-2 py-1 bg-black text-white text-[9px] font-black uppercase tracking-[0.2em] rounded">
                            R Engine
                        </span>
                        <span className="text-sm font-black uppercase tracking-widest text-black">
                            {image.chart_type.replace("_", " ")}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsEditingMode(!isEditingMode)}
                            className={`flex items-center gap-2 px-4 py-2 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest ${isEditingMode ? 'bg-black text-white' : 'text-gray-300 hover:text-black border border-transparent hover:border-gray-100'}`}
                        >
                            <IconWand className="w-4 h-4" /> AI Manipulate
                        </button>
                        <button
                            onClick={() => handleCompile(code)}
                            disabled={isCompiling || isStreaming}
                            className="flex items-center gap-2 px-5 py-2 bg-white border border-gray-100 text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-black transition-all disabled:opacity-30"
                        >
                            {isCompiling ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconPlayerPlay className="w-4 h-4" />}
                            Execute
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isStreaming}
                            className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1A1A1A] transition-all shadow-xl"
                        >
                            <IconDeviceFloppy className="w-4 h-4" /> Commit
                        </button>
                        <div className="w-px h-6 bg-gray-100 mx-2" />
                        <button onClick={onClose} className="p-2 text-gray-300 hover:text-black transition-colors">
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
                                {isStreaming && <span className="text-gray-300 animate-pulse font-bold ml-2">AI typing...</span>}
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
                                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="absolute bottom-6 left-6 right-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] border border-gray-100 rounded-[28px] overflow-hidden bg-white flex flex-col p-2">
                                    <div className="px-4 py-2 text-[9px] font-black text-black uppercase tracking-[0.25em] flex items-center gap-2">
                                       <IconWand className="w-3.5 h-3.5" /> Logical Instruction
                                    </div>
                                    <textarea
                                        value={editPrompt}
                                        onChange={e => setEditPrompt(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAIEdit(); } }}
                                        placeholder="Describe the structural or visual shift..."
                                        disabled={isStreaming}
                                        className="w-full outline-none px-4 py-3 text-[13px] font-bold text-black bg-white placeholder:text-gray-100 resize-none"
                                        rows={2}
                                    />
                                    <div className="flex justify-end p-2 px-4">
                                        <button onClick={handleAIEdit} disabled={!editPrompt.trim() || isStreaming} className="px-6 py-2 bg-black text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#222] disabled:opacity-30 transition-all flex items-center gap-2">
                                            {isStreaming ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <>Apply <IconArrowRight className="w-3.5 h-3.5" /></>}
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
                                        <IconLoader2 className="w-6 h-6 text-gray-800 animate-spin" />
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
