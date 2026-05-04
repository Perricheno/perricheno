import { useState, useRef, useEffect } from "react";
import { IconDeviceFloppy, IconPlayerPlay, IconX, IconLoader2, IconDownload, IconWand, IconArrowRight, IconBrandPython, IconLetterR } from "@tabler/icons-react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { CodeImage } from "./types";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
    image: CodeImage;
    index: number;
    onClose: () => void;
    onSave: (index: number, newImg: CodeImage) => void;
    sessionId: string | null;
}

export function CodeEditorModal({ image, index, onClose, onSave, sessionId }: Props) {
    const isPython = image.language === 'Python';
    const [code, setCode] = useState(image.code);
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
            const endpoint = isPython ? '/api/agent/python-compile' : '/api/agent/r-compile';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: codeToRun })
            });

            if (!res.ok) throw new Error(`${image.language} Compilation failed`);

            const data = await res.json();
            if (data.success && data.image) {
                setPreview(data.image);
            } else {
                throw new Error(data.log || `Unknown ${image.language} error`);
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
                body: JSON.stringify({ currentCode: oldCode, editPrompt, language: image.language })
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
        onSave(index, { ...image, image: preview, code: code });
        onClose();
    };

    const downloadCode = () => {
        const a = document.createElement("a");
        const ext = isPython ? 'py' : 'R';
        a.href = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
        a.download = `fig_${index + 1}_${image.chart_type}.${ext}`;
        a.click();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-6xl h-[90vh] flex flex-col bg-white border border-gray-100 rounded-[32px] shadow-2xl overflow-hidden relative"
            >
                {/* Header */}
                <div className="h-16 border-b border-gray-100 flex flex-wrap items-center justify-between px-6 shrink-0 bg-white">
                    <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 flex items-center gap-1 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded ${isPython ? 'bg-blue-600' : 'bg-black'}`}>
                            {isPython ? <IconBrandPython className="w-3 h-3" /> : <IconLetterR className="w-3 h-3" stroke={3} />}
                            {image.language}
                        </span>
                        <span className="text-sm font-black uppercase tracking-widest text-black">
                            {(image.chart_type || (image as any).chartType || 'chart').replace("_", " ")}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsEditingMode(!isEditingMode)}
                            className={`flex items-center gap-2 px-4 py-2 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest ${isEditingMode ? 'bg-black text-white px-6' : 'text-gray-300 hover:text-black border border-transparent hover:border-gray-100'}`}
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
                            className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1A1A1A] transition-all shadow-xl active:scale-95"
                        >
                            <IconDeviceFloppy className="w-4 h-4" /> Commit
                        </button>
                        <div className="w-px h-6 bg-gray-100 mx-1" />
                        <button onClick={onClose} className="p-2 text-gray-300 hover:text-black transition-colors">
                            <IconX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                    {/* Code editor */}
                    <div className="w-full lg:w-1/2 h-full flex flex-col border-r border-gray-100 relative">
                        <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-3 shrink-0">
                            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                                <span className="opacity-50 font-black uppercase tracking-widest text-[8px]">{isPython ? 'python' : 'r'} code</span>
                                {isStreaming && <span className="text-gray-300 animate-pulse font-bold ml-2 text-[10px]">AI typing...</span>}
                            </div>
                            <button onClick={downloadCode} className="text-gray-400 hover:text-white" title={`Download ${image.language} code`}>
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
                                        className="w-full outline-none px-4 py-3 text-[13px] font-bold text-black bg-white placeholder:text-gray-200 resize-none"
                                        rows={2}
                                        autoFocus
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
                        <div className="h-8 border-b border-gray-100 flex items-center px-4 shrink-0 bg-white">
                            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Environment Output</span>
                        </div>
                        <div className="flex-1 overflow-auto p-8 flex flex-col items-center justify-center gap-4 relative">
                            {preview ? (
                                <img src={`data:image/png;base64,${preview}`} alt="plot" className={`max-w-full max-h-full object-contain drop-shadow-2xl rounded-xl transition-all ${isCompiling ? 'opacity-30 blur-sm scale-95' : 'opacity-100 scale-100'}`} />
                            ) : (
                                <span className="text-sm text-gray-400 font-mono">No output</span>
                            )}

                            {error && (
                                <div className="absolute bottom-6 left-6 right-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl shadow-2xl z-10">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center justify-between">
                                        Execution Failed
                                        <button onClick={() => setError(null)}><IconX className="w-4 h-4" /></button>
                                    </h4>
                                    <pre className="text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-auto scrollbar-hide">{error}</pre>
                                </div>
                            )}

                            {isCompiling && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-0 scale-up">
                                    <div className="w-16 h-16 bg-white rounded-full shadow-2xl flex items-center justify-center border border-gray-100">
                                        <IconLoader2 className="w-8 h-8 text-black animate-spin" />
                                    </div>
                                    <span className="mt-6 text-[10px] font-black text-black uppercase tracking-[0.4em] animate-pulse">Rebuilding Figure...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
