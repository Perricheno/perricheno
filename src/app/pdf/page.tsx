"use client";

import { useState, useRef } from "react";
import { useAdmin } from "@/components/AdminContext";
import { motion, AnimatePresence } from "framer-motion";
import JSZip from "jszip";
import {
    IconCloudUpload, IconFileTypePdf, IconLoader2, IconDownload, IconArrowLeft,
    IconFileDescription, IconPhoto, IconFileText, IconPresentation, IconCode, IconX, IconFileCheck, IconBrandTelegram
} from "@tabler/icons-react";
import MinimalSidebar from "@/components/MinimalSidebar";

type ToolType = "file-to-pdf" | "img-to-pdf" | "pdf-to-word" | "pdf-to-ppt" | "pdf-to-text" | "pdf-to-img";

interface ToolDef {
    id: ToolType;
    title: string;
    desc: string;
    icon: any;
    accept: string;
    outputExt: string;
}

const TOOLS: ToolDef[] = [
    { id: "file-to-pdf", title: "File to PDF", desc: "Word, Excel, PPT to PDF", icon: IconFileDescription, accept: ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.html", outputExt: ".pdf" },
    { id: "img-to-pdf", title: "Image to PDF", desc: "JPG, PNG to PDF", icon: IconPhoto, accept: "image/*", outputExt: ".pdf" },
    { id: "pdf-to-word", title: "PDF to Word", desc: "PDF to Editable Word", icon: IconFileText, accept: ".pdf", outputExt: ".docx" },
    { id: "pdf-to-ppt", title: "PDF to PPT", desc: "PDF to PowerPoint", icon: IconPresentation, accept: ".pdf", outputExt: ".pptx" },
    { id: "pdf-to-img", title: "PDF to Images", desc: "Extract pages as ZIP", icon: IconPhoto, accept: ".pdf", outputExt: ".zip" },
    { id: "pdf-to-text", title: "PDF to Text", desc: "Extract plain text", icon: IconCode, accept: ".pdf", outputExt: ".txt" },
];

export default function PDFPage() {
    const { user } = useAdmin();
    const [activeTool, setActiveTool] = useState<ToolType | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<"idle" | "processing" | "zipping" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [downloadUrl, setDownloadUrl] = useState<string>("");
    const [downloadName, setDownloadName] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const tool = TOOLS.find(t => t.id === activeTool);

    const handleFiles = (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        setFiles(prev => [...prev, ...Array.from(fileList)]);
        setStatus("idle");
        setErrorMsg("");
        setDownloadUrl("");
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const getOutputFilename = (originalName: string, tool: ToolDef) => {
        const base = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
        return `${base}${tool.outputExt}`;
    };

    const sendToTelegram = async (blob: Blob) => {
        if (!user) return;
        try {
            const fd = new FormData();
            fd.append("document", blob, downloadName || "converted-file");
            fd.append("chat_id", user.telegram_id);
            await fetch("/api/telegram/send", { method: "POST", body: fd });
        } catch (e) {
            console.error("BG Telegram Send Failed", e);
        }
    };

    const convert = async () => {
        if (files.length === 0 || !activeTool || !tool) return;
        setStatus("processing");
        setProgress({ current: 0, total: files.length });
        setDownloadUrl("");
        setErrorMsg("");

        try {
            const zip = new JSZip();
            const results: { name: string; blob: Blob }[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append("fileInput", file);

                if (activeTool === "img-to-pdf") {
                    formData.append("fitOption", "fillPage");
                    formData.append("colorType", "color");
                }

                const res = await fetch(`/api/pdf-proxy?type=${activeTool}`, {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) {
                    const errJson = await res.json();
                    throw new Error(errJson.details || errJson.error || `Failed to convert ${file.name}`);
                }

                const blob = await res.blob();
                const newName = getOutputFilename(file.name, tool);

                results.push({ name: newName, blob });
                setProgress(prev => ({ ...prev, current: i + 1 }));
            }

            setStatus("zipping");

            let finalBlob: Blob;
            if (results.length === 1) {
                finalBlob = results[0].blob;
                setDownloadName(`converted-${results[0].name}`);
            } else {
                results.forEach(r => zip.file(r.name, r.blob));
                finalBlob = await zip.generateAsync({ type: "blob" });
                setDownloadName("converted-files.zip");
            }

            const url = URL.createObjectURL(finalBlob);
            setDownloadUrl(url);

            // Auto-send to Telegram
            if (user) sendToTelegram(finalBlob);

            setStatus("done");
        } catch (e: any) {
            console.error(e);
            setStatus("error");
            setErrorMsg(e.message || "Unknown error occurred");
        }
    };

    const reset = () => {
        setFiles([]);
        setStatus("idle");
        setDownloadUrl("");
        setProgress({ current: 0, total: 0 });
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pl-16 md:pl-64 transition-all">
            <MinimalSidebar />

            <div className="max-w-5xl mx-auto px-6 py-20 md:py-32">
                {activeTool && user && <div className="absolute top-6 right-6 z-40 px-3 py-1 rounded-full border border-[var(--border)] text-[var(--foreground)] opacity-50 text-xs flex items-center gap-2">
                    <IconBrandTelegram className="w-3 h-3" /> Auto-send to {user.first_name}
                </div>}

                <AnimatePresence mode="wait">
                    {!activeTool ? (
                        <motion.div key="grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col">
                            <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">PDF Tools.</h1>
                            <p className="text-xl text-[var(--foreground)] opacity-60 mb-12 max-w-lg">Secure, private, and powerful PDF operations.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)]">
                                {TOOLS.map((t) => (
                                    <button key={t.id} onClick={() => setActiveTool(t.id)}
                                        className="group relative bg-[var(--background)] p-8 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors duration-200 text-left h-48 flex flex-col justify-between">
                                        
                                        <div className="flex justify-between items-start">
                                            <t.icon className="w-8 h-8 stroke-1" />
                                            <IconArrowLeft className="w-5 h-5 opacity-0 group-hover:opacity-100 rotate-180 transition-opacity" />
                                        </div>
                                        
                                        <div>
                                            <h3 className="text-lg font-bold tracking-tight mb-1">{t.title}</h3>
                                            <p className="text-sm opacity-50 group-hover:opacity-80">{t.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="tool" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col max-w-3xl mx-auto w-full">

                            <div className="w-full flex items-center justify-between mb-12">
                                <button onClick={() => { setActiveTool(null); reset(); }}
                                    className="flex items-center gap-2 text-[var(--foreground)] opacity-50 hover:opacity-100 transition-opacity">
                                    <IconArrowLeft className="w-5 h-5" /> Back
                                </button>
                                <div className="px-3 py-1 rounded-full border border-[var(--border)] text-sm font-medium">
                                    {tool?.title}
                                </div>
                            </div>

                            <div className="w-full border border-[var(--border)] bg-[var(--background)] p-8 md:p-12 relative min-h-[400px]">
                                {status === "processing" && (
                                    <div className="absolute inset-0 bg-[var(--background)] z-20 flex flex-col items-center justify-center">
                                        <IconLoader2 className="w-12 h-12 animate-spin mb-4" stroke={1} />
                                        <p className="font-medium text-lg mb-2">Processing...</p>
                                        <p className="opacity-50 text-sm">Converted {progress.current} of {progress.total}</p>
                                        <div className="w-64 h-1 bg-[var(--border)] mt-6 overflow-hidden">
                                            <motion.div
                                                className="h-full bg-[var(--foreground)]"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {files.length === 0 ? (
                                    <div
                                        className="w-full border border-dashed border-[var(--border)] h-64 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-[var(--muted)] transition-colors group"
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                                    >
                                        <input ref={fileInputRef} type="file" multiple className="hidden" accept={tool?.accept} onChange={(e) => handleFiles(e.target.files)} />
                                        <IconCloudUpload className="w-10 h-10 opacity-30 group-hover:opacity-100 transition-opacity" stroke={1} />
                                        <div className="text-center">
                                            <p className="font-medium">Click or Drag files</p>
                                            <p className="opacity-40 text-sm mt-1">Up to 100 files</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col gap-6">
                                        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                                            <h3 className="font-bold">Files ({files.length})</h3>
                                            <button onClick={() => fileInputRef.current?.click()} className="text-sm opacity-50 hover:opacity-100 hover:underline">+ Add more</button>
                                            <input ref={fileInputRef} type="file" multiple className="hidden" accept={tool?.accept} onChange={(e) => handleFiles(e.target.files)} />
                                        </div>

                                        <div className="max-h-60 overflow-y-auto space-y-1 pr-2">
                                            {files.map((f, i) => (
                                                <div key={i} className="flex items-center gap-4 p-3 border border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                                                    <IconFileDescription className="w-5 h-5 opacity-50" stroke={1} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{f.name}</p>
                                                        <p className="opacity-40 text-xs">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                    <button onClick={() => removeFile(i)} className="opacity-30 hover:opacity-100 hover:text-red-500 p-1">
                                                        <IconX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {status === "done" ? (
                                            <div className="flex flex-col gap-4 items-center pt-8 border-t border-[var(--border)] animate-in fade-in slide-in-from-bottom-4">
                                                <IconFileCheck className="w-10 h-10 mb-2" stroke={1} />
                                                <p className="font-bold text-lg">Complete</p>
                                                {user && <p className="opacity-50 text-xs flex items-center gap-1"><IconBrandTelegram className="w-3 h-3" /> Sent to Telegram</p>}
                                                <a href={downloadUrl} download={downloadName}
                                                    className="px-8 py-3 bg-[var(--foreground)] text-[var(--background)] font-bold hover:opacity-80 transition-opacity flex items-center gap-2">
                                                    <IconDownload className="w-4 h-4" /> Download
                                                </a>
                                                <button onClick={reset} className="opacity-40 text-sm hover:opacity-100 hover:underline mt-2">Start Over</button>
                                            </div>
                                        ) : (
                                            <button onClick={convert}
                                                disabled={status !== "idle"}
                                                className="w-full py-4 bg-[var(--foreground)] text-[var(--background)] font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-4">
                                                CONVERT FILES
                                            </button>
                                        )}

                                        {status === "error" && (
                                            <div className="p-4 border border-red-500/20 text-center bg-red-500/5">
                                                <p className="text-red-500 font-bold text-sm mb-1">Failed</p>
                                                <p className="text-red-500/60 text-xs">{errorMsg}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
