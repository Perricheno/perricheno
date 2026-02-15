"use client";

import { useState, useRef } from "react";
import { DockSidebar } from "@/components/ui/DockSidebar";
import { AdminBar } from "@/components/AdminBar";
import { motion, AnimatePresence } from "framer-motion";
import { IconCloudUpload, IconFileTypePdf, IconLoader2, IconDownload } from "@tabler/icons-react";

export default function PDFPage() {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
    const [downloadUrl, setDownloadUrl] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const f = files[0];
        // Basic check, though API might handle others
        // if (f.type !== "application/pdf") return alert("Only PDF files allowed");
        setFile(f);
        setStatus("idle");
        setDownloadUrl("");
    };

    const convert = async () => {
        if (!file) return;
        setStatus("uploading");

        try {
            const formData = new FormData();
            // Stirling PDF API usually expects 'fileInput'
            formData.append("fileInput", file);

            const res = await fetch("/api/pdf-proxy", {
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

    return (
        <div className="relative z-10 w-full min-h-screen">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-2xl" />
            <AdminBar />

            <div className="relative z-10 max-w-[800px] mx-auto px-4 pt-24 pb-32 md:py-28 md:pl-24 flex flex-col items-center justify-center min-h-[80vh]">

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">PDF Converter</h1>
                    <p className="text-white/40">Secure, private, and fast file conversion powered by Perricheno API.</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                    className="w-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-3xl p-8 md:p-12 flex flex-col items-center relative overflow-hidden"
                >
                    {status === "uploading" && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                            <IconLoader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
                            <p className="text-white font-medium">Converting...</p>
                        </div>
                    )}

                    {!file ? (
                        <div
                            className="w-full border-2 border-dashed border-white/10 rounded-2xl h-64 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-emerald-500/50 hover:bg-white/[0.02] transition-all group"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files); }}
                        >
                            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files)} />
                            <div className="p-4 rounded-full bg-white/5 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 transition-colors">
                                <IconCloudUpload className="w-8 h-8 text-white/40 group-hover:text-emerald-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-white font-medium">Click to upload or drag and drop</p>
                                <p className="text-white/30 text-sm mt-1">PDF, DOCX, XLSX, Images...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full flex flex-col gap-6">
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
                                    <IconFileTypePdf className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate">{file.name}</p>
                                    <p className="text-white/30 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                <button onClick={() => { setFile(null); setStatus("idle"); }} className="text-white/30 hover:text-red-400 text-sm">Remove</button>
                            </div>

                            {status === "done" ? (
                                <div className="flex flex-col gap-4 items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                                        <IconDownload className="w-6 h-6" />
                                    </div>
                                    <p className="text-emerald-400 font-medium">Conversion Complete!</p>
                                    <a href={downloadUrl} download={`converted-${file.name}`}
                                        className="px-8 py-3 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20">
                                        Download File
                                    </a>
                                    <button onClick={() => { setFile(null); setStatus("idle"); }} className="text-white/40 text-sm hover:text-white mt-2">Convert another file</button>
                                </div>
                            ) : (
                                <button onClick={convert}
                                    className="w-full py-3.5 rounded-xl bg-white text-black font-bold hover:bg-white/90 transition-all shadow-lg text-sm uppercase tracking-wide">
                                    Convert File
                                </button>
                            )}

                            {status === "error" && (
                                <p className="text-red-400 text-center text-sm">Conversion failed. Please try again.</p>
                            )}
                        </div>
                    )}
                </motion.div>

            </div>

            <DockSidebar />
        </div>
    );
}
