"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
    IconUpload, IconFileText, IconX, IconLoader2,
    IconCheck, IconAlertTriangle, IconDownload, IconFileTypePdf,
} from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";
import { TemplatePicker } from "../agent/TemplatePicker";

type Mode = "faithful" | "rewrite";
type Phase = "idle" | "uploading" | "ready" | "generating" | "done" | "error";

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
const LANGUAGES: { id: string; label: string }[] = [
    { id: "en", label: "English" },
    { id: "ru", label: "Русский" },
    { id: "kk", label: "Қазақша" },
];

export default function DocToTexPage() {
    const t = useTranslations("docToTex");
    const { user, setShowLogin } = useAdmin();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [phase, setPhase] = useState<Phase>("idle");
    const [upload, setUpload] = useState<UploadInfo | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const [mode, setMode] = useState<Mode>("faithful");
    const [templateId, setTemplateId] = useState("plain");
    const [customTemplatePreamble, setCustomTemplatePreamble] = useState("");
    const [language, setLanguage] = useState("en");
    const [authorName, setAuthorName] = useState("");
    const [dateStr, setDateStr] = useState("");

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [stage, setStage] = useState<StageJson | null>(null);
    const [mainTex, setMainTex] = useState<string | null>(null);
    const [compiled, setCompiled] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
            setUpload({
                uploadId: data.uploadId, filename: data.filename,
                charCount: data.charCount, imageCount: data.imageCount, pageCount: data.pageCount,
            });
            setPhase("ready");
        } catch (e: any) {
            setUploadError(e.message || "Upload failed.");
            setPhase("idle");
        }
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
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
                const data = await res.json();
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
                    language, authorName: authorName || undefined, dateStr: dateStr || undefined,
                    title: upload.filename.replace(/\.[^.]+$/, ""),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.details || data.error || `HTTP ${res.status}`);
            setSessionId(data.sessionId);
            pollSession(data.sessionId);
        } catch (e: any) {
            setErrorMsg(e.message || "Failed to start conversion.");
            setPhase("error");
        }
    }, [user, setShowLogin, upload, mode, templateId, customTemplatePreamble, language, authorName, dateStr, pollSession]);

    const reset = useCallback(() => {
        stopPolling();
        setPhase("idle"); setUpload(null); setSessionId(null); setStage(null);
        setMainTex(null); setCompiled(false); setErrorMsg(null);
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

    return (
        <div className="max-w-2xl mx-auto px-6 py-16">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{t("title")}</h1>
            <p className="text-sm opacity-50 mb-10">{t("subtitle")}</p>

            {(phase === "idle" || phase === "uploading") && !upload && (
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-[var(--border)] rounded-2xl p-16 text-center cursor-pointer hover:border-gray-400 transition-colors"
                >
                    {phase === "uploading" ? (
                        <IconLoader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
                    ) : (
                        <IconUpload className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    )}
                    <p className="text-sm font-medium">{phase === "uploading" ? t("upload.uploading") : t("upload.cta")}</p>
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
                    <IconFileText className="w-4 h-4 opacity-50 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{upload.filename}</p>
                        <p className="text-xs opacity-40">
                            {upload.charCount.toLocaleString()} chars
                            {upload.imageCount > 0 ? ` · ${upload.imageCount} image(s)` : ""}
                        </p>
                    </div>
                    {phase === "ready" && (
                        <button onClick={removeUpload} className="opacity-40 hover:opacity-100 transition-opacity">
                            <IconX className="w-4 h-4" />
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

                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t("settings.language")}</label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            {LANGUAGES.map((l) => (
                                <button
                                    key={l.id}
                                    onClick={() => setLanguage(l.id)}
                                    className={`p-2 rounded-xl border text-xs font-medium transition-all ${
                                        language === l.id ? "border-[var(--foreground)] bg-[var(--foreground)]/5" : "border-[var(--border)] hover:border-gray-300"
                                    }`}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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
                    </div>

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
                    <IconLoader2 className="w-8 h-8 mx-auto mb-4 animate-spin opacity-40" />
                    <p className="text-sm font-medium">{stage?.label || t("actions.converting")}</p>
                    {stage?.progress && (
                        <p className="text-xs opacity-40 mt-1">{stage.progress.done} / {stage.progress.total}</p>
                    )}
                </div>
            )}

            {phase === "done" && (
                <div className="text-center py-10">
                    {compiled ? (
                        <IconCheck className="w-8 h-8 mx-auto mb-3 text-green-600" />
                    ) : (
                        <IconAlertTriangle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
                    )}
                    <p className="text-sm font-medium mb-6">{t(compiled ? "status.done" : "status.needsAttention")}</p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <button onClick={downloadTex} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[var(--border)] text-[11px] font-bold uppercase tracking-widest hover:border-gray-400 transition-all">
                            <IconDownload className="w-3.5 h-3.5" /> {t("actions.downloadTex")}
                        </button>
                        {compiled && stage?.pdf_storage_path && sessionId && (
                            <a href={`/api/doctotex/pdf/${sessionId}`} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--foreground)] text-[var(--background)] text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
                                <IconFileTypePdf className="w-3.5 h-3.5" /> {t("actions.downloadPdf")}
                            </a>
                        )}
                    </div>
                    <button onClick={reset} className="block mx-auto mt-8 text-xs opacity-40 hover:opacity-100 transition-opacity underline">
                        {t("actions.another")}
                    </button>
                </div>
            )}

            {phase === "error" && (
                <div className="text-center py-10">
                    <IconAlertTriangle className="w-8 h-8 mx-auto mb-3 text-red-500" />
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
