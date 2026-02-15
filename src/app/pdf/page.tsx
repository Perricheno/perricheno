"use client";

import { useState, useRef } from "react";
import { DockSidebar } from "@/components/ui/DockSidebar";
import { AdminBar } from "@/components/AdminBar";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconCloudUpload, IconFileTypePdf, IconLoader2, IconDownload, IconArrowLeft,
    IconFileDescription, IconPhoto, IconFileText, IconPresentation, IconCode
} from "@tabler/icons-react";

type ToolType = "file-to-pdf" | "img-to-pdf" | "pdf-to-word" | "pdf-to-ppt" | "pdf-to-text" | "pdf-to-img";

interface ToolDef {
    id: ToolType;
    title: string;
    desc: string;
    icon: any;
    accept: string;
    color: string;
    bg: string;
}

const TOOLS: ToolDef[] = [
    { id: "file-to-pdf", title: "File to PDF", desc: "Convert Word, Excel, PPT to PDF", icon: IconFileDescription, accept: ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.html", color: "text-blue-400", bg: "bg-blue-500/10" },
    { id: "img-to-pdf", title: "Image to PDF", desc: "Convert JPG, PNG to PDF", icon: IconPhoto, accept: "image/*", color: "text-purple-400", bg: "bg-purple-500/10" },
    { id: "pdf-to-word", title: "PDF to Word", desc: "Convert PDF to Editable Word", icon: IconFileText, accept: ".pdf", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { id: "pdf-to-ppt", title: "PDF to PPT", desc: "Convert PDF to PowerPoint", icon: IconPresentation, accept: ".pdf", color: "text-orange-400", bg: "bg-orange-500/10" },
    { id: "pdf-to-img", title: "PDF to Images", desc: "Extract pages as images", icon: IconPhoto, accept: ".pdf", color: "text-pink-400", bg: "bg-pink-500/10" },
    { id: "pdf-to-text", title: "PDF to Text", desc: "Extract text from PDF", icon: IconCode, accept: ".pdf", color: "text-cyan-400", bg: "bg-cyan-500/10" },
];

export default function PDFPage() {
    const [activeTool, setActiveTool] = useState<ToolType | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
    const [downloadUrl, setDownloadUrl] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const tool = TOOLS.find(t => t.id === activeTool);

    const handleFile = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setFile(files[0]);
        setStatus("idle");
        setDownloadUrl("");
    };

    const convert = async () => {
        if (!file || !activeTool) return;
        setStatus("uploading");

        try {
            const formData = new FormData();
            formData.append("fileInput", file);

            // Add options if needed (e.g. for img-to-pdf)
            if (activeTool === "img-to-pdf") {
                formData.append("fitOption", "fillPage");
                formData.append("colorType", "color");
            }

            const res = await fetch(`/api/pdf-proxy?type=${activeTool}`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Conversion failed");

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setDownloadUrl(url);
            setStatus("done");
        } catch (e) {
            console.error(e);
            setStatus("error");
        }
    };

    const reset = () => {
        setFile(null);
        setStatus("idle");
        setDownloadUrl("");
    };

    return (
        <div className="relative z-10 w-full min-h-screen">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-2xl" />
            <AdminBar />

            <div className="relative z-10 max-w-[1200px] mx-auto px-4 pt-24 pb-32 md:py-28 md:pl-24 min-h-[80vh]">

                <AnimatePresence mode="wait">
                    {!activeTool ? (
                        <motion.div key="grid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col items-center">
                            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 text-center">PDF Tools</h1>
                            <p className="text-white/40 mb-12 text-center max-w-lg">Secure, private, and powerful PDF tools powered by Perricheno API.</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                                {TOOLS.map((t) => (
                                    <motion.button key={t.id} onClick={() => setActiveTool(t.id)}
                                        whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
                                        className="group relative p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl hover:bg-white/[0.06] text-left transition-all overflow-hidden h-40 flex flex-col justify-between">
                                        <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl ${t.bg} ${t.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                            <IconFileTypePdf className="w-4 h-4" />
                                        </div>
                                        <div className={`w-10 h-10 rounded-xl ${t.bg} flex items-center justify-center ${t.color} mb-3`}>
                                            <t.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">{t.title}</h3>
                                            <p className="text-white/40 text-xs">{t.desc}</p>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="tool" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="flex flex-col items-center max-w-[800px] mx-auto">

                            <div className="w-full flex items-center justify-between mb-8">
                                <button onClick={() => { setActiveTool(null); reset(); }}
                                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors">
                                    <IconArrowLeft className="w-5 h-5" /> Back to Tools
                                </button>
                                <div className={`px-3 py-1 rounded-full ${tool?.bg} ${tool?.color} text-sm font-medium border border-white/5`}>
                                    {tool?.title}
                                </div>
                            </div>

                            <div className="w-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-3xl p-8 md:p-12 flex flex-col items-center relative overflow-hidden">
                                {status === "uploading" && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                                        <IconLoader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
                                        <p className="text-white font-medium">Processing...</p>
                                    </div>
                                )}

                                {!file ? (
                                    <div
                                        className="w-full border-2 border-dashed border-white/10 rounded-2xl h-64 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-emerald-500/50 hover:bg-white/[0.02] transition-all group"
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files); }}
                                    >
                                        <input ref={fileInputRef} type="file" className="hidden" accept={tool?.accept} onChange={(e) => handleFile(e.target.files)} />
                                        <div className={`p-4 rounded-full bg-white/5 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 transition-colors`}>
                                            <IconCloudUpload className="w-8 h-8 text-white/40 group-hover:text-emerald-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-medium">Click to upload or drag and drop</p>
                                            <p className="text-white/30 text-sm mt-1">Supported: {tool?.accept.replace(/\./g, " ").toUpperCase()}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col gap-6">
                                        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                            <div className={`p-3 rounded-lg ${tool?.bg} ${tool?.color}`}>
                                                {tool && <tool.icon className="w-6 h-6" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-medium truncate">{file.name}</p>
                                                <p className="text-white/30 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                            <button onClick={reset} className="text-white/30 hover:text-red-400 text-sm">Remove</button>
                                        </div>

                                        {status === "done" ? (
                                            <div className="flex flex-col gap-4 items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                                                    <IconDownload className="w-6 h-6" />
                                                </div>
                                                <p className="text-emerald-400 font-medium">Success!</p>
                                                <a href={downloadUrl} download={`converted-${file.name}`}
                                                    className="px-8 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
                                                    Download Result
                                                </a>
                                                <button onClick={reset} className="text-white/40 text-sm hover:text-white mt-2">Convert another file</button>
                                            </div>
                                        ) : (
                                            <button onClick={convert}
                                                className="w-full py-3.5 rounded-xl bg-white text-black font-bold hover:bg-white/90 transition-all shadow-lg text-sm uppercase tracking-wide">
                                                Convert Now
                                            </button>
                                        )}

                                        {status === "error" && (
                                            <p className="text-red-400 text-center text-sm">Conversion failed. Please try again.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            <DockSidebar />
        </div>
    );
}
