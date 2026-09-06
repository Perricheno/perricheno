"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload, FileText, X, Loader2, AlertTriangle, Download, FileType, Info,
} from "lucide-react";
import { Upload as UploadData, Check, Copy, TriangleAlert } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useAdmin } from "@/components/AdminContext";
import { TemplatePicker } from "../agent/TemplatePicker";

type Mode = "faithful" | "rewrite";
type Phase = "idle" | "uploading" | "uploaded" | "ready" | "generating" | "done" | "error";

// Templates whose title block actually uses author/date - only these show
// those fields. Everything else renders a plain \title/\author/\maketitle
// (or, for a custom upload, respects the uploaded preamble's own convention)
// where an unused field would just be confusing UI.
const TITLE_PAGE_TEMPLATES = new Set(["thesis", "academic"]);

interface UploadInfo {
    uploadId: string;
    filename: string;
    charCount: number;
    imageCount: number;
    pageCount: number;
}

interface StageJson {
    label?: string;
    progress?: { done: number; total: number };
    pdf_storage_path?: string;
}

const ACCEPT = ".pdf,.docx,.doc,.pptx,.ppt,.png,.jpg,.jpeg,.txt,.md";

// Reads a fetch Response defensively: a crashed API route can return an HTML
// error page instead of JSON (a proxy/500 page), which would otherwise throw
// an opaque "Unexpected token '<'" from res.json() with no useful message.
async function readJsonSafe(res: Response): Promise<any> {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Server returned an unexpected response (HTTP ${res.status}). Please try again in a moment.`);
    }
}

export default function DocToTexPage() {
    const t = useTranslations("docToTex");
    const { user, setShowLogin } = useAdmin();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [phase, setPhase] = useState<Phase>("idle");
    const [isDragging, setIsDragging] = useState(false);
    const [upload, setUpload] = useState<UploadInfo | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const [mode, setMode] = useState<Mode>("faithful");
    const [templateId, setTemplateId] = useState("plain");
    const [customTemplatePreamble, setCustomTemplatePreamble] = useState("");
    const [authorName, setAuthorName] = useState("");
    const [dateStr, setDateStr] = useState("");

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [stage, setStage] = useState<StageJson | null>(null);
    const [mainTex, setMainTex] = useState<string | null>(null);
    const [compiled, setCompiled] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showSource, setShowSource] = useState(false);
    const [copied, setCopied] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const showTitleFields = templateId !== "custom" && TITLE_PAGE_TEMPLATES.has(templateId);

    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);
    useEffect(() => () => stopPolling(), [stopPolling]);

    const handleFile = useCallback(async (file: File) => {
        setPhase("uploading");
        setUploadError(null);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("filename", file.name);
            const res = await fetch("/api/doctotex/upload", { method: "POST", body: fd });
            const data = await readJsonSafe(res);
            if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
            setUpload({
                uploadId: data.uploadId, filename: data.filename,
                charCount: data.charCount, imageCount: data.imageCount, pageCount: data.pageCount,
            });
            // Brief morph-to-check confirmation beat before settling into the ready state.
            setPhase("uploaded");
            setTimeout(() => setPhase("ready"), 700);
        } catch (e: any) {
            setUploadError(e.message || "Upload failed.");
            setPhase("idle");
        }
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const removeUpload = useCallback(async () => {
        if (upload) {
            fetch(`/api/doctotex/upload?id=${upload.uploadId}`, { method: "DELETE" }).catch(() => {});
        }
        setUpload(null);
        setPhase("idle");
    }, [upload]);

    const pollSession = useCallback((id: string) => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/agent/sessions/${id}`);
                if (!res.ok) return;
                const data = await readJsonSafe(res);
                const s = data.session;
                if (!s) return;

                let stageJson: StageJson = {};
                try { stageJson = s.stage_json ? (typeof s.stage_json === "string" ? JSON.parse(s.stage_json) : s.stage_json) : {}; } catch {}
                setStage(stageJson);

                if (s.status === "done" || s.status === "needs_attention") {
                    setMainTex(s.main_tex || "");
                    setCompiled(s.status === "done");
                    setPhase("done");
                    stopPolling();
                } else if (s.status === "error") {
                    setErrorMsg(s.error_msg || "Conversion failed.");
                    setPhase("error");
                    stopPolling();
                }
            } catch {}
        }, 3000);
    }, [stopPolling]);

    const startConversion = useCallback(async () => {
        if (!user) { setShowLogin(true); return; }
        if (!upload) return;
        setPhase("generating");
        setErrorMsg(null);
        try {
            const res = await fetch("/api/doctotex/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uploadIds: [upload.uploadId],
                    mode, templateId,
                    customTemplatePreamble: customTemplatePreamble || undefined,
                    authorName: showTitleFields ? (authorName || undefined) : undefined,
                    dateStr: showTitleFields ? (dateStr || undefined) : undefined,
                    title: upload.filename.replace(/\.[^.]+$/, ""),
                }),
            });
            const data = await readJsonSafe(res);
            if (!res.ok) throw new Error(data.details || data.error || `HTTP ${res.status}`);
            setSessionId(data.sessionId);
            pollSession(data.sessionId);
        } catch (e: any) {
            setErrorMsg(e.message || "Failed to start conversion.");
            setPhase("error");
        }
    }, [user, setShowLogin, upload, mode, templateId, customTemplatePreamble, showTitleFields, authorName, dateStr, pollSession]);

    const reset = useCallback(() => {
        stopPolling();
        setPhase("idle"); setUpload(null); setSessionId(null); setStage(null);
        setMainTex(null); setCompiled(false); setErrorMsg(null); setShowSource(false);
    }, [stopPolling]);

    const downloadTex = useCallback(() => {
        if (!mainTex) return;
        const blob = new Blob([mainTex], { type: "text/x-tex" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "document.tex";
        a.click();
        URL.revokeObjectURL(url);
    }, [mainTex]);

    const copySource = useCallback(() => {
        if (!mainTex) return;
        navigator.clipboard.writeText(mainTex);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    }, [mainTex]);

    return (
        <div className="max-w-2xl mx-auto px-6 py-16">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{t("title")}</h1>
            <p className="text-sm opacity-50 mb-6">{t("subtitle")}</p>

            {/* ── Guide ── */}
            <div className="mb-10 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Info className="w-4 h-4 opacity-50" />
                    <p className="text-xs font-bold uppercase tracking-wider opacity-60">{t("guide.title")}</p>
                </div>
                <ul className="space-y-2 text-[13px] leading-relaxed opacity-70">
                    <li>{t("guide.mode")}</li>
                    <li>{t("guide.template")}</li>
                    <li>{t("guide.images")}</li>
                    <li>{t("guide.language")}</li>
                </ul>
            </div>

            {(phase === "idle" || phase === "uploading" || phase === "uploaded") && !upload && (
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
                        isDragging ? "border-[var(--foreground)] bg-[var(--foreground)]/5" : "border-[var(--border)] hover:border-gray-400"
                    }`}
                >
                    <AnimatePresence>
                        {isDragging && (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 z-10 bg-[var(--background)]/90 backdrop-blur-sm rounded-2xl border-2 border-dashed border-[var(--foreground)] flex items-center justify-center pointer-events-none"
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <Upload className="w-10 h-10" strokeWidth={2.5} />
                                    <p className="text-sm font-bold">{t("upload.cta")}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <MorphIcon
                        icon={phase === "uploaded" ? Check : UploadData}
                        size={32}
                        className={`mx-auto mb-3 ${phase === "uploaded" ? "text-emerald-500" : "opacity-40"} ${phase === "uploading" ? "animate-pulse" : ""}`}
                    />
                    <p className="text-sm font-medium">
                        {phase === "uploading" ? t("upload.uploading") : phase === "uploaded" ? t("status.done") : t("upload.cta")}
                    </p>
                    <p className="text-xs opacity-40 mt-1">{t("upload.hint")}</p>
                    <input
                        ref={fileInputRef} type="file" accept={ACCEPT} className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                    />
                </div>
            )}
            {uploadError && <p className="text-xs text-red-500 mt-3">{uploadError}</p>}

            {upload && (
                <div className="flex items-center gap-3 px-4 py-3 border border-[var(--border)] rounded-xl mb-8">
                    <FileText className="w-4 h-4 opacity-50 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{upload.filename}</p>
                        <p className="text-xs opacity-40">
                            {upload.charCount.toLocaleString()} chars
                            {upload.imageCount > 0 ? ` · ${upload.imageCount} image(s)` : ""}
                        </p>
                    </div>
                    {phase === "ready" && (
                        <button onClick={removeUpload} className="opacity-40 hover:opacity-100 transition-opacity">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            {phase === "ready" && upload && (
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("settings.mode")}</label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            {(["faithful", "rewrite"] as Mode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    className={`text-left p-3 rounded-xl border transition-all ${
                                        mode === m ? "border-[var(--foreground)] bg-[var(--foreground)]/5" : "border-[var(--border)] hover:border-gray-300"
                                    }`}
                                >
                                    <p className="text-xs font-bold">{t(m === "faithful" ? "settings.modeFaithful" : "settings.modeRewrite")}</p>
                                    <p className="text-[10px] opacity-40 mt-0.5">{t(m === "faithful" ? "settings.modeFaithfulHint" : "settings.modeRewriteHint")}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <TemplatePicker
                        templateId={templateId}
                        customTemplatePreamble={customTemplatePreamble}
                        onTemplateChange={setTemplateId}
                        onCustomPreamble={setCustomTemplatePreamble}
                    />

                    <AnimatePresence>
                        {showTitleFields && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                className="grid grid-cols-2 gap-3 overflow-hidden"
                            >
                                <input
                                    value={authorName} onChange={(e) => setAuthorName(e.target.value)}
                                    placeholder={t("settings.author")}
                                    className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-gray-400"
                                />
                                <input
                                    value={dateStr} onChange={(e) => setDateStr(e.target.value)}
                                    placeholder={t("settings.date")}
                                    className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-gray-400"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={startConversion}
                        className="w-full py-3.5 rounded-xl bg-[var(--foreground)] text-[var(--background)] text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                    >
                        {t("actions.convert")}
                    </button>
                </div>
            )}

            {phase === "generating" && (
                <div className="text-center py-16">
                    <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin opacity-40" />
                    <p className="text-sm font-medium">{stage?.label || t("actions.converting")}</p>
                    {stage?.progress && (
                        <p className="text-xs opacity-40 mt-1">{stage.progress.done} / {stage.progress.total}</p>
                    )}
                </div>
            )}

            {phase === "done" && (
                <div className="py-6">
                    <div className="text-center mb-6">
                        <MorphIcon icon={compiled ? Check : TriangleAlert} size={32} className={`mx-auto mb-3 ${compiled ? "text-emerald-500" : "text-amber-500"}`} />
                        <p className="text-sm font-medium">{t(compiled ? "status.done" : "status.needsAttention")}</p>
                    </div>

                    {/* Action bar - same pattern as R Studio / TikZ Studio result panels */}
                    <div className="flex items-center gap-2 flex-wrap justify-center mb-4">
                        <button
                            onClick={() => setShowSource(s => !s)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                showSource ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]" : "bg-[var(--background)] text-gray-500 border-[var(--border)] hover:border-gray-400"
                            }`}
                        >
                            <FileType size={12} /> {t("results.viewSource")}
                        </button>
                        <button onClick={copySource}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[var(--border)] bg-[var(--background)] text-gray-500 hover:border-gray-400 transition-colors">
                            <MorphIcon icon={copied ? Check : Copy} size={12} />
                            {copied ? t("results.copied") : t("results.copy")}
                        </button>
                        <button onClick={downloadTex}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[var(--border)] bg-[var(--background)] text-gray-500 hover:border-gray-400 transition-colors">
                            <Download size={12} /> {t("actions.downloadTex")}
                        </button>
                        {compiled && stage?.pdf_storage_path && sessionId && (
                            <a href={`/api/doctotex/pdf/${sessionId}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity">
                                <Download size={12} /> {t("actions.downloadPdf")}
                            </a>
                        )}
                    </div>

                    {/* PDF preview */}
                    {compiled && stage?.pdf_storage_path && sessionId && (
                        <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--card)] mb-4">
                            <iframe src={`/api/doctotex/pdf/${sessionId}`} title="Compiled document preview" className="w-full block" style={{ height: "480px", border: "none" }} />
                        </div>
                    )}

                    {/* LaTeX source */}
                    <AnimatePresence>
                        {showSource && mainTex && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                className="rounded-2xl border border-[var(--border)] bg-[#1e1e2e] overflow-hidden"
                            >
                                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                                    <span className="text-[11px] font-medium text-gray-400">{t("results.sourceTitle")}</span>
                                </div>
                                <pre className="max-h-96 overflow-auto p-4 text-[11px] leading-relaxed text-[#cdd6f4] font-mono whitespace-pre-wrap">{mainTex}</pre>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button onClick={reset} className="block mx-auto mt-8 text-xs opacity-40 hover:opacity-100 transition-opacity underline">
                        {t("actions.another")}
                    </button>
                </div>
            )}

            {phase === "error" && (
                <div className="text-center py-10">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-500" />
                    <p className="text-sm font-medium mb-2">{t("status.error")}</p>
                    {errorMsg && <p className="text-xs opacity-50 max-w-md mx-auto">{errorMsg}</p>}
                    <button onClick={reset} className="block mx-auto mt-8 text-xs opacity-40 hover:opacity-100 transition-opacity underline">
                        {t("actions.another")}
                    </button>
                </div>
            )}
        </div>
    );
}
