"use client";

import { useState, useRef, useEffect } from "react";
import { useAdmin } from "@/components/AdminContext";
import { motion, AnimatePresence } from "framer-motion";
import JSZip from "jszip";
import {
    IconCloudUpload, IconFileTypePdf, IconLoader2, IconDownload, IconArrowLeft,
    IconFileDescription, IconPhoto, IconFileText, IconPresentation, IconCode, IconX,
    IconFileCheck, IconBrandTelegram, IconLock, IconLockOpen, IconScissors, IconArrowsShuffle,
    IconRotate, IconLayersIntersect, IconEraser, IconWand, IconMaximize, IconMinimize, IconTxt,
    IconBrowser, IconFileZip, IconShield
} from "@tabler/icons-react";
import MinimalSidebar from "@/components/MinimalSidebar";
import { useToast } from "@/components/ToastContext";

type ToolType = 
    | "file-to-pdf" | "img-to-pdf" | "pdf-to-word" | "pdf-to-ppt" | "pdf-to-text" | "pdf-to-img" | "pdf-to-html" | "pdf-to-xml" | "pdf-to-pdfa"
    | "merge-pdfs" | "split-pages" | "remove-pages" | "rotate-pdf" | "organize-pdf" | "scale-pages" | "crop-pdf"
    | "add-password" | "remove-password" | "add-watermark" | "sanitize-pdf"
    | "compress-pdf" | "ocr-pdf" | "repair-pdf" | "flatten-pdf" | "remove-blanks" | "extract-images";

interface ToolDef {
    id: ToolType;
    title: string;
    desc: string;
    icon: any;
    accept: string;
    outputExt: string;
    category: "Convert" | "Edit" | "Security" | "Misc";
}

const TOOLS: ToolDef[] = [
    // Convert
    { id: "file-to-pdf", title: "File to PDF", desc: "Word, Excel, PPT to PDF", icon: IconFileDescription, accept: ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.html", outputExt: ".pdf", category: "Convert" },
    { id: "img-to-pdf", title: "Image to PDF", desc: "JPG, PNG to PDF", icon: IconPhoto, accept: "image/*", outputExt: ".pdf", category: "Convert" },
    { id: "pdf-to-word", title: "PDF to Word", desc: "PDF to Editable Word", icon: IconFileText, accept: ".pdf", outputExt: ".docx", category: "Convert" },
    { id: "pdf-to-ppt", title: "PDF to PPT", desc: "PDF to PowerPoint", icon: IconPresentation, accept: ".pdf", outputExt: ".pptx", category: "Convert" },
    { id: "pdf-to-img", title: "PDF to Images", desc: "Save pages as Images", icon: IconPhoto, accept: ".pdf", outputExt: ".zip", category: "Convert" },
    { id: "pdf-to-text", title: "PDF to Text", desc: "Extract plain text", icon: IconTxt, accept: ".pdf", outputExt: ".txt", category: "Convert" },
    { id: "pdf-to-html", title: "PDF to HTML", desc: "Convert to Web Page", icon: IconBrowser, accept: ".pdf", outputExt: ".html", category: "Convert" },
    { id: "pdf-to-pdfa", title: "PDF to PDF/A", desc: "Archival Format", icon: IconFileCheck, accept: ".pdf", outputExt: ".pdf", category: "Convert" },

    // Edit
    { id: "merge-pdfs", title: "Merge PDFs", desc: "Combine multiple files", icon: IconLayersIntersect, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "split-pages", title: "Split PDF", desc: "Separate pages", icon: IconScissors, accept: ".pdf", outputExt: ".zip", category: "Edit" },
    { id: "remove-pages", title: "Remove Pages", desc: "Delete unwanted pages", icon: IconEraser, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "rotate-pdf", title: "Rotate", desc: "Rotate pages 90°/180°", icon: IconRotate, accept: ".pdf", outputExt: ".pdf", category: "Edit" },
    { id: "organize-pdf", title: "Organize", desc: "Rearrange page order", icon: IconArrowsShuffle, accept: ".pdf", outputExt: ".pdf", category: "Edit" },

    // Security
    { id: "add-password", title: "Protect", desc: "Add Password", icon: IconLock, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "remove-password", title: "Unlock", desc: "Remove Password", icon: IconLockOpen, accept: ".pdf", outputExt: ".pdf", category: "Security" },
    { id: "sanitize-pdf", title: "Sanitize", desc: "Remove metadata/scripts", icon: IconShield, accept: ".pdf", outputExt: ".pdf", category: "Security" },

    // Misc
    { id: "compress-pdf", title: "Compress", desc: "Reduce file size", icon: IconMinimize, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "ocr-pdf", title: "OCR", desc: "Make text searchable", icon: IconCode, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "repair-pdf", title: "Repair", desc: "Fix broken PDFs", icon: IconWand, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "flatten-pdf", title: "Flatten", desc: "Flatten forms/layers", icon: IconMaximize, accept: ".pdf", outputExt: ".pdf", category: "Misc" },
    { id: "extract-images", title: "Extract Images", desc: "Get all images", icon: IconPhoto, accept: ".pdf", outputExt: ".zip", category: "Misc" },
];

const CATEGORIES = ["All", "Convert", "Edit", "Security", "Misc"];

export default function PDFPage() {
    const { user } = useAdmin();
    const { showToast } = useToast();
    const [activeTool, setActiveTool] = useState<ToolType | null>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "zipping" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [uploadProgress, setUploadProgress] = useState(0);
    const [downloadUrl, setDownloadUrl] = useState<string>("");
    const [downloadName, setDownloadName] = useState<string>("");
    const [isSendingToTg, setIsSendingToTg] = useState(false);
    const [activeCategory, setActiveCategory] = useState("All");
    
    // Tool params (simple version for now)
    const [password, setPassword] = useState(""); 

    const fileInputRef = useRef<HTMLInputElement>(null);

    const tool = TOOLS.find(t => t.id === activeTool);

    const filteredTools = activeCategory === "All" ? TOOLS : TOOLS.filter(t => t.category === activeCategory);

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
        setIsSendingToTg(true);
        try {
            const fd = new FormData();
            fd.append("document", blob, downloadName || "converted-file");
            fd.append("chat_id", user.telegram_id);
            const res = await fetch("/api/telegram/send", { method: "POST", body: fd });
            if (res.ok) {
                 showToast("Files sent to Telegram", "success");
            } else {
                 showToast("Failed to send to Telegram", "error");
            }
        } catch (e) {
            console.error("BG Telegram Send Failed", e);
        } finally {
            setIsSendingToTg(false);
        }
    };

    // Fake upload progress effect
    useEffect(() => {
        if (status === "uploading") {
            setUploadProgress(0);
            const interval = setInterval(() => {
                setUploadProgress(prev => {
                    const next = prev + Math.random() * 20;
                    return next > 90 ? 90 : next;
                });
            }, 500);
            return () => clearInterval(interval);
        } else {
            setUploadProgress(0);
        }
    }, [status]);

    const convert = async () => {
        if (files.length === 0 || !activeTool || !tool) return;
        setStatus("uploading");
        setProgress({ current: 0, total: files.length });
        setDownloadUrl("");
        setErrorMsg("");

        try {
            const zip = new JSZip();
            const results: { name: string; blob: Blob }[] = [];

            for (let i = 0; i < files.length; i++) {
                // Simulate "processing" state for each file
                setStatus("processing");
                const file = files[i];
                const formData = new FormData();
                formData.append("fileInput", file);

                // Specific params for Tools
                if (activeTool === "img-to-pdf") {
                    formData.append("fitOption", "fillPage");
                    formData.append("colorType", "color");
                    formData.append("autoRotate", "true");
                } else if (activeTool === "pdf-to-img") {
                    formData.append("imageFormat", "png");
                    formData.append("singlePage", "false");
                    formData.append("dpi", "300");
                } else if (activeTool === "add-password") {
                    formData.append("password", password || "123456"); 
                } else if (activeTool === "ocr-pdf") {
                    formData.append("ocrType", "skip-text");
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

            setStatus("done");
            
            // Auto-send to Telegram
            if (user) sendToTelegram(finalBlob);

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
        setPassword("");
    };

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pl-16 md:pl-64 transition-all">
            <MinimalSidebar />

            <div className="max-w-[1400px] mx-auto px-6 py-20 md:py-32">
                {activeTool && user && <div className="absolute top-6 right-6 z-40 px-3 py-1 rounded-full border border-[var(--border)] text-[var(--foreground)] opacity-50 text-xs flex items-center gap-2">
                    <IconBrandTelegram className="w-3 h-3" /> Auto-send enabled
                </div>}

                <AnimatePresence mode="wait">
                    {!activeTool ? (
                        <motion.div key="grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col">
                            <h1 className="text-[8vw] md:text-8xl font-bold tracking-tighter mb-4 leading-none">
                                PDF Tools<span className="text-[var(--border)]">.</span>
                            </h1>
                            <p className="text-xl opacity-60 mb-8 max-w-lg">Advanced tools for all your document needs.</p>

                            {/* Categories */}
                            <div className="flex flex-wrap gap-2 mb-8">
                                {CATEGORIES.map(cat => (
                                    <button key={cat} onClick={() => setActiveCategory(cat)}
                                        className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                                            activeCategory === cat 
                                            ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]" 
                                            : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                                        }`}>
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-[var(--border)] border border-[var(--border)]">
                                {filteredTools.map((t) => (
                                    <button key={t.id} onClick={() => setActiveTool(t.id)}
                                        className="group relative bg-[var(--background)] p-6 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors duration-200 text-left h-48 flex flex-col justify-between">
                                        
                                        <div className="flex justify-between items-start">
                                            <t.icon className="w-7 h-7 stroke-1" />
                                            <IconArrowLeft className="w-4 h-4 opacity-0 group-hover:opacity-100 rotate-180 transition-opacity" />
                                        </div>
                                        
                                        <div>
                                            <h3 className="text-lg font-bold tracking-tight mb-1">{t.title}</h3>
                                            <p className="text-xs opacity-50 group-hover:opacity-80 leading-relaxed">{t.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="tool" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col max-w-3xl mx-auto w-full">

                            <div className="w-full flex items-center justify-between mb-8">
                                <button onClick={() => { setActiveTool(null); reset(); }}
                                    className="flex items-center gap-2 font-mono text-sm opacity-50 hover:opacity-100 transition-opacity">
                                    <IconArrowLeft className="w-4 h-4" /> BACK
                                </button>
                                <div className="px-3 py-1 rounded-full border border-[var(--border)] text-xs font-mono uppercase">
                                    {tool?.category} / {tool?.title}
                                </div>
                            </div>

                            <div className="w-full border border-[var(--border)] bg-[var(--background)] p-8 md:p-16 relative min-h-[500px] flex flex-col">
                                {(status === "processing" || status === "uploading") && (
                                    <div className="absolute inset-0 bg-[var(--background)] z-20 flex flex-col items-center justify-center">
                                        <IconLoader2 className="w-12 h-12 animate-spin mb-4" stroke={1} />
                                        <p className="font-medium text-lg mb-2">
                                            {status === "uploading" ? "Uploading..." : `Processing ${progress.current + 1} / ${progress.total}`}
                                        </p>
                                        <div className="w-64 h-1 bg-[var(--border)] mt-6 overflow-hidden relative">
                                            <motion.div
                                                className="h-full bg-[var(--foreground)]"
                                                initial={{ width: 0 }}
                                                animate={{ width: status === "uploading" ? `${uploadProgress}%` : `${(progress.current / progress.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {files.length === 0 ? (
                                    <div
                                        className="w-full h-full min-h-[300px] border border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-6 cursor-pointer hover:bg-[var(--muted)] transition-colors group"
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                                    >
                                        <input ref={fileInputRef} type="file" multiple className="hidden" accept={tool?.accept} onChange={(e) => handleFiles(e.target.files)} />
                                        <IconCloudUpload className="w-16 h-16 opacity-20 group-hover:opacity-100 transition-opacity stroke-1" />
                                        <div className="text-center">
                                            <p className="text-xl font-medium mb-1">Drop files here</p>
                                            <p className="opacity-40 text-sm">or click to browse</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col gap-6 flex-1">
                                        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                                            <h3 className="font-bold">Queue ({files.length})</h3>
                                            <button onClick={() => fileInputRef.current?.click()} className="text-sm opacity-50 hover:opacity-100 hover:underline">+ Add more</button>
                                            <input ref={fileInputRef} type="file" multiple className="hidden" accept={tool?.accept} onChange={(e) => handleFiles(e.target.files)} />
                                        </div>

                                        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                                            {files.map((f, i) => (
                                                <div key={i} className="flex items-center gap-4 p-4 border border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                                                    <IconFileDescription className="w-6 h-6 opacity-50" stroke={1} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{f.name}</p>
                                                        <p className="opacity-40 text-xs font-mono">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                    </div>
                                                    <button onClick={() => removeFile(i)} className="opacity-30 hover:opacity-100 hover:text-red-500 p-2">
                                                        <IconX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {activeTool === "add-password" && (
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-mono uppercase opacity-50">Set Password</label>
                                                <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Type password..."
                                                    className="w-full p-3 bg-transparent border border-[var(--border)] outline-none focus:border-[var(--foreground)] text-sm" />
                                            </div>
                                        )}

                                        {status === "done" ? (
                                            <div className="flex flex-col gap-4 items-center pt-8 border-t border-[var(--border)] animate-in fade-in slide-in-from-bottom-4">
                                                <div className="w-16 h-16 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center mb-2">
                                                    <IconFileCheck className="w-8 h-8" stroke={1.5} />
                                                </div>
                                                <p className="font-bold text-2xl">Ready!</p>
                                                {user && (
                                                    <p className={`text-xs flex items-center gap-1 ${isSendingToTg ? "animate-pulse opacity-100" : "opacity-50"}`}>
                                                        <IconBrandTelegram className="w-3 h-3" /> 
                                                        {isSendingToTg ? "Sending to Telegram..." : "Sent to Telegram"}
                                                    </p>
                                                )}
                                                <a href={downloadUrl} download={downloadName}
                                                    className="w-full py-4 bg-[var(--foreground)] text-[var(--background)] font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-4 text-lg">
                                                    <IconDownload className="w-5 h-5" /> DOWNLOAD FILE
                                                </a>
                                                <button onClick={reset} className="opacity-40 text-sm hover:opacity-100 hover:underline mt-2">Convert more files</button>
                                            </div>
                                        ) : (
                                            <button onClick={convert}
                                                disabled={status !== "idle" && status !== "error"}
                                                className="w-full py-5 bg-[var(--foreground)] text-[var(--background)] font-bold tracking-widest hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-lg">
                                                START {activeTool === "compress-pdf" ? "COMPRESSION" : "CONVERSION"}
                                            </button>
                                        )}

                                        {status === "error" && (
                                            <div className="p-4 border border-red-500/20 text-center bg-red-500/5 mt-4">
                                                <p className="text-red-500 font-bold text-sm mb-1">Conversion Failed</p>
                                                <p className="text-red-500/60 text-xs font-mono break-all">{errorMsg}</p>
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
