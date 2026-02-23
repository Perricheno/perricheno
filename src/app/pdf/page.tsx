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

        if (user) {
             showToast("Processing started. You can safely close the browser. Files will be sent to your Telegram automatically.", "success");
        } else {
             showToast("Processing started. Do not close this tab! Or Login via Telegram to receive the file automatically.", "info");
        }

        try {
            const zip = new JSZip();
            
            // Map files to promises for parallel upload/processing
            const uploadPromises = files.map(async (file, i) => {
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

                // Append the original filename so the backend can use it for the telegram message if needed
                formData.append("originalName", file.name);

                const res = await fetch(`/api/pdf-proxy?type=${activeTool}`, {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.details || errJson.error || `Failed to convert ${file.name}`);
                }

                const blob = await res.blob();
                const newName = getOutputFilename(file.name, tool);
                
                // Update progress as files finish
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                
                return { name: newName, blob };
            });

            setStatus("processing");
            const results = await Promise.all(uploadPromises);

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
            
            // Server now handles Telegram delivery in the background via pdf-proxy
            
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
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] pl-16 md:pl-20 transition-all font-sans">
            <MinimalSidebar />

            <div className="max-w-[1200px] mx-auto px-6 py-12 md:py-24">
                {activeTool && user && <div className="absolute top-6 right-6 z-40 px-4 py-2 bg-white dark:bg-[#18181b] rounded-full shadow-sm border border-[var(--border)] text-sm font-medium flex items-center gap-2">
                    <IconBrandTelegram className="w-4 h-4 text-blue-500" /> Auto-delivery active
                </div>}

                <AnimatePresence mode="wait">
                    {!activeTool ? (
                        <motion.div key="grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                            className="flex flex-col">
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                                Document Tools
                            </h1>
                            <p className="text-lg text-gray-500 mb-10 max-w-xl">Supercharge your workflow with our advanced suite of PDF utilities.</p>

                            {/* Categories */}
                            <div className="flex flex-wrap gap-2 mb-8 bg-white dark:bg-[#18181b] p-1.5 rounded-[var(--radius)] w-fit border border-[var(--border)] shadow-sm">
                                {CATEGORIES.map(cat => (
                                    <button key={cat} onClick={() => setActiveCategory(cat)}
                                        className={`px-4 py-1.5 rounded-[calc(var(--radius)-4px)] text-sm font-medium transition-all ${
                                            activeCategory === cat 
                                            ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm" 
                                            : "text-gray-500 hover:text-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5"
                                        }`}>
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredTools.map((t) => (
                                    <button key={t.id} onClick={() => setActiveTool(t.id)}
                                        className="group relative bg-white dark:bg-[#18181b] p-6 hover:shadow-md border border-[var(--border)] hover:border-gray-300 dark:hover:border-gray-600 rounded-[var(--radius)] transition-all duration-200 text-left h-44 flex flex-col justify-between overflow-hidden">
                                        
                                        <div className="flex justify-between items-start z-10">
                                            <div className="p-2.5 bg-black/5 dark:bg-white/5 rounded-lg text-[var(--foreground)] group-hover:scale-110 transition-transform">
                                                <t.icon className="w-6 h-6 stroke-[1.5]" />
                                            </div>
                                            <IconArrowLeft className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 -rotate-45 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                                        </div>
                                        
                                        <div className="z-10">
                                            <h3 className="text-base font-semibold mb-1">{t.title}</h3>
                                            <p className="text-sm text-gray-500 line-clamp-2">{t.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="tool" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col max-w-2xl mx-auto w-full">

                            <div className="w-full flex items-center justify-between mb-6">
                                <button onClick={() => { setActiveTool(null); reset(); }}
                                    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[var(--foreground)] transition-colors px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 -ml-3">
                                    <IconArrowLeft className="w-4 h-4" /> Back to tools
                                </button>
                                <div className="px-3 py-1 bg-white dark:bg-[#18181b] rounded-full border border-[var(--border)] text-xs font-semibold text-gray-500 shadow-sm">
                                    {tool?.category} / {tool?.title}
                                </div>
                            </div>

                            <div className="w-full border border-[var(--border)] bg-white dark:bg-[#18181b] rounded-[var(--radius)] shadow-sm p-8 md:p-12 relative min-h-[400px] flex flex-col overflow-hidden">
                                {(status === "processing" || status === "uploading" || status === "zipping") && (
                                    <div className="absolute inset-0 bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-8 text-center rounded-[var(--radius)]">
                                        <div className="relative w-16 h-16 mb-6">
                                            <svg className="animate-spin w-full h-full text-gray-200 dark:text-gray-800" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                                                {status === "uploading" ? Math.round(uploadProgress) + "%" : Math.round((progress.current / progress.total) * 100) + "%"}
                                            </div>
                                        </div>
                                        
                                        <h3 className="font-semibold text-xl mb-2 text-[var(--foreground)]">
                                            {status === "uploading" ? "Uploading your files..." : status === "zipping" ? "Packaging results..." : "Converting document..."}
                                        </h3>
                                        
                                        {user ? (
                                            <p className="text-sm text-gray-500 max-w-xs">
                                                You can safely close this page. The result will be sent to your Telegram automagically. ✨
                                            </p>
                                        ) : (
                                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-4 rounded-xl mt-4 border border-blue-100 dark:border-blue-800/50 max-w-sm">
                                                <p className="text-sm mb-3"><strong>Guest Mode:</strong> Please don't close this tab until the download is ready.</p>
                                                <p className="text-xs opacity-80">Link your Telegram account to let us process this in the background while you do other things.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {files.length === 0 ? (
                                    <div
                                        className="w-full h-full min-h-[300px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[var(--foreground)] hover:bg-black/5 dark:hover:bg-white/5 transition-all group p-6"
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                                    >
                                        <input ref={fileInputRef} type="file" multiple className="hidden" accept={tool?.accept} onChange={(e) => handleFiles(e.target.files)} />
                                        <div className="w-16 h-16 bg-white dark:bg-black rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <IconCloudUpload className="w-8 h-8 text-gray-400 group-hover:text-[var(--foreground)] transition-colors" stroke={1.5} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-semibold mb-1">Click to upload or drag & drop</p>
                                            <p className="text-sm text-gray-500">Supports {tool?.accept} files up to 50MB</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col gap-6 flex-1">
                                        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-black/5 dark:bg-white/5 rounded-lg flex items-center justify-center">
                                                    <IconFileDescription className="w-5 h-5" stroke={1.5} />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-sm leading-tight">Selected Files</h3>
                                                    <p className="text-xs text-gray-500">{files.length} file{files.length !== 1 ? 's' : ''} queued</p>
                                                </div>
                                            </div>
                                            <button onClick={() => fileInputRef.current?.click()} className="text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">+ Add</button>
                                            <input ref={fileInputRef} type="file" multiple className="hidden" accept={tool?.accept} onChange={(e) => handleFiles(e.target.files)} />
                                        </div>

                                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 minimal-scrollbar max-h-[300px]">
                                            {files.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 group hover:shadow-sm transition-all">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded flex items-center justify-center shrink-0">
                                                            <span className="text-[10px] font-bold uppercase">{f.name.split('.').pop()}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{f.name}</p>
                                                            <p className="text-xs text-gray-500">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => removeFile(i)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                                        <IconX className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {activeTool === "add-password" && (
                                            <div className="flex flex-col gap-2 p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-[var(--border)]">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Document Password</label>
                                                <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter a secure password..."
                                                    className="w-full bg-transparent border-b border-gray-300 dark:border-gray-700 outline-none focus:border-[var(--foreground)] pb-2 text-sm transition-colors" />
                                            </div>
                                        )}

                                        {status === "done" ? (
                                            <div className="flex flex-col items-center justify-center py-6 animate-in fade-in slide-in-from-bottom-4">
                                                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center mb-4">
                                                    <IconFileCheck className="w-8 h-8" stroke={1.5} />
                                                </div>
                                                <p className="font-bold text-xl mb-1 text-[var(--foreground)]">Success!</p>
                                                <p className="text-sm text-gray-500 text-center max-w-xs mb-6">
                                                   Your document has been processed. Download it below.
                                                </p>
                                                
                                                <a href={downloadUrl} download={downloadName}
                                                    className="w-full py-3.5 bg-[var(--foreground)] text-[var(--background)] rounded-xl font-semibold hover:opacity-90 hover:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md">
                                                    <IconDownload className="w-5 h-5" /> Download Result
                                                </a>
                                                <button onClick={reset} className="mt-4 text-sm font-medium text-gray-500 hover:text-[var(--foreground)] transition-colors">Process another file</button>
                                            </div>
                                        ) : (
                                            <button onClick={convert}
                                                disabled={status !== "idle" && status !== "error"}
                                                className="w-full py-4 bg-[var(--foreground)] text-[var(--background)] rounded-xl font-bold hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md mt-2 flex items-center justify-center gap-2">
                                                Start Processing
                                            </button>
                                        )}

                                        {status === "error" && (
                                            <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 mt-2 flex gap-3 text-red-600 dark:text-red-400">
                                                <IconX className="w-5 h-5 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-semibold text-sm mb-0.5">Operation failed</p>
                                                    <p className="text-xs opacity-80 break-all">{errorMsg}</p>
                                                </div>
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
