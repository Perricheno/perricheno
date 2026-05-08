"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
    IconArrowUp, IconLoader2, IconCode, IconX,
    IconCopy, IconCheck, IconRefresh, IconDownload,
    IconPaperclip, IconFile, IconSparkles, IconLayoutGrid,
} from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";
import { useRouter } from "@/i18n/navigation";
import RSidebar from "./RSidebar";
import ChartGallery from "./ChartGallery";
import MultiChartCard from "./MultiChartCard";
import RChartSheet from "./RChartSheet";
import { CHARTS, type GeneratedChart } from "./charts";

const SERVER_EXTRACT_EXTS = ["pdf", "doc", "docx", "ppt", "pptx"];
const CLIENT_TEXT_EXTS = ["csv", "tsv", "txt", "md", "json"];
const CLIENT_EXCEL_EXTS = ["xlsx", "xls"];

// ── Encode ArrayBuffer → base64 ───────────────────────────────────────────
function bufToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

// ── Read file: client-side for text/Excel, server-side for PDF/Office ────────
async function readFileAsContext(file: File): Promise<{ content: string; rFileName?: string; fileData?: string; images?: string[] }> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (CLIENT_TEXT_EXTS.includes(ext)) {
        const MAX_BYTES = 10 * 1024 * 1024;
        const buf = await file.arrayBuffer();
        const safeBuf = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
        const raw = new TextDecoder().decode(safeBuf);

        if (ext === "csv" || ext === "tsv") {
            const sep = ext === "tsv" ? "\t" : ",";
            const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
            const header = lines[0] ?? "";
            const totalRows = lines.length - 1;
            const sample = lines.slice(1, 4).join("\n");
            // Schema snippet - just enough for LLM to know columns & types
            const content = [
                `FILE: "${file.name}" - ${totalRows} rows`,
                `COLUMNS: ${header.split(sep).join(" | ")}`,
                `SAMPLE (3 rows):\n${sample}`,
            ].join("\n");
            return { content, fileData: bufToBase64(safeBuf), rFileName: file.name };
        }

        // Plain text / JSON / MD
        const lines = raw.split("\n");
        return { content: lines.length > 800 ? lines.slice(0, 800).join("\n") : raw };
    }

    if (CLIENT_EXCEL_EXTS.includes(ext)) {
        try {
            const { read, utils } = await import("xlsx");
            const buf = await file.arrayBuffer();
            const wb = read(buf);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const csv = utils.sheet_to_csv(ws);
            const lines = csv.split("\n").map(l => l.trim()).filter(Boolean);
            const header = lines[0] ?? "";
            const totalRows = lines.length - 1;
            const sample = lines.slice(1, 4).join("\n");
            const rFileName = file.name.replace(/\.[^.]+$/, ".csv");
            const content = [
                `FILE: "${rFileName}" - ${totalRows} rows (converted from Excel)`,
                `COLUMNS: ${header.split(",").join(" | ")}`,
                `SAMPLE (3 rows):\n${sample}`,
            ].join("\n");
            // Encode CSV text (not raw Excel) so R can read it with read.csv()
            const csvBuf = new TextEncoder().encode(csv).buffer;
            return { content, fileData: bufToBase64(csvBuf), rFileName };
        } catch {
            return { content: "[Excel parsing failed - please convert to CSV]" };
        }
    }

    if (SERVER_EXTRACT_EXTS.includes(ext)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/r/upload", { method: "POST", body: form });
        if (!res.ok) return { content: `[Failed to extract ${file.name}]` };
        const data = await res.json();
        return { content: data.content ?? "", images: data.images ?? [] };
    }

    return { content: "" };
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface AttachedFile {
    name: string;
    content: string;       // schema snippet for LLM context
    rFileName?: string;    // filename R will use (may differ for Excel→CSV)
    fileData?: string;     // base64 of full file for R compiler
    images?: string[];
    size: number;
}

export default function RPage() {
    const t = useTranslations("r");
    const { user, setShowLogin } = useAdmin();
    const router = useRouter();

    const [prompt, setPrompt] = useState("");
    const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [chartSheetOpen, setChartSheetOpen] = useState(false);

    // Suggest state
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedCharts, setSuggestedCharts] = useState<string[]>([]);
    const [suggestReasoning, setSuggestReasoning] = useState("");

    // Single generation states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Single result
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [resultCode, setResultCode] = useState("");
    const [resultChartType, setResultChartType] = useState("");
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

    // Multi generation state
    const [multiResults, setMultiResults] = useState<GeneratedChart[]>([]);
    const [multiLoading, setMultiLoading] = useState(false);
    const [multiError, setMultiError] = useState<string | null>(null);
    const [chartsPlanned, setChartsPlanned] = useState<string[]>([]);

    // Elapsed timer
    const [elapsed, setElapsed] = useState(0);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Polling ref for background session
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sidebar + session state
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [sidebarRefresh, setSidebarRefresh] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-grow textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }, [prompt]);

    // ── File handling ──
    const handleFiles = async (rawFiles: FileList | File[]) => {
        if (!user) { setShowLogin(true); return; }
        setUploading(true);
        const arr = Array.from(rawFiles);
        const results: AttachedFile[] = [];

        for (const f of arr) {
            const { content, rFileName, fileData, images } = await readFileAsContext(f);
            if (content || images?.length) {
                results.push({ name: f.name, content, rFileName, fileData, images, size: f.size });
            }
        }

        setFiles(prev => [...prev, ...results]);
        setUploading(false);
    };

    const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i));

    // ── Suggest chart types (called when files attached + no chart selected) ──
    const suggestCharts = useCallback(async (): Promise<string> => {
        if (!files.length) return selectedCharts[0] ?? "";
        setSuggesting(true);
        try {
            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "suggest",
                    prompt,
                    contextFiles: files.map(f => ({ name: f.name, content: f.content, rFileName: f.rFileName, fileData: f.fileData, images: f.images ?? [] })),
                }),
            });
            if (!res.ok) return "";
            const data = await res.json();
            const charts: string[] = data.charts ?? [];
            setSuggestedCharts(charts);
            setSuggestReasoning(data.reasoning ?? "");
            return charts[0] ?? "";
        } catch {
            return "";
        } finally {
            setSuggesting(false);
        }
    }, [prompt, files, selectedCharts]);

    // ── Stop polling helper ──
    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    }, []);

    // ── Poll a session until done ──
    // startedAt: epoch ms of session creation - timer counts from there so reloads don't reset it
    const pollSession = useCallback((sessionId: string, startedAt?: number) => {
        stopPolling();
        const startTime = startedAt ?? Date.now();
        setElapsed((Date.now() - startTime) / 1000);
        elapsedRef.current = setInterval(() => setElapsed((Date.now() - startTime) / 1000), 100);

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/r/sessions/${sessionId}`);
                if (!res.ok) return;
                const data = await res.json();
                const s = data.session;

                const results: GeneratedChart[] = (s.results ?? []).map((r: any) => ({
                    chartType: r.chartType,
                    name: r.name || r.chartType.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    image: r.image ?? "",
                    code: r.code ?? "",
                    status: r.status ?? "done",
                    error: r.error,
                }));

                setMultiResults(results);

                if (s.status === "done" || s.status === "error") {
                    stopPolling();
                    setMultiLoading(false);
                    setSidebarRefresh(n => n + 1);
                    if (s.status === "error" && results.length === 0) {
                        setMultiError(t("generationFailed"));
                    }
                }
            } catch { /* ignore transient errors */ }
        }, 2500);
    }, [stopPolling]);

    // ── Multi polling flow ──
    const runMulti = useCallback(async () => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;

        setMultiLoading(true);
        setMultiError(null);
        setMultiResults([]);
        setChartsPlanned([]);
        setElapsed(0);
        setResultImage(null);
        setResultCode("");
        setError(null);
        stopPolling();

        try {
            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "multi",
                    prompt,
                    contextFiles: files.map(f => ({ name: f.name, content: f.content, rFileName: f.rFileName, fileData: f.fileData, images: f.images ?? [] })),
                    ...(selectedCharts.length > 0 ? { chartTypes: selectedCharts } : {}),
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setMultiError(res.status === 402 ? t("quotaReached") : data.error || `HTTP ${res.status}`);
                setMultiLoading(false);
                return;
            }

            const { sessionId, chartsPlanned: planned = [] } = data;
            
            // Redirect to session page immediately
            router.push(`/r/${sessionId}`);

        } catch (e: any) {
            setMultiError(e.message || "Multi-generation failed.");
            setMultiLoading(false);
        }
    }, [user, prompt, files, selectedCharts, setShowLogin, stopPolling, pollSession]);

    // Retry a single chart within multi results
    const retryMultiChart = useCallback(async (index: number, chartType: string) => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;

        setMultiResults(prev => prev.map((c, i) =>
            i === index ? { ...c, status: "generating", error: undefined } : c
        ));

        try {
            const body: any = {
                action: "generate",
                prompt,
                chartType,
                contextFiles: files.map(f => ({ name: f.name, content: f.content, rFileName: f.rFileName, fileData: f.fileData, images: f.images ?? [] })),
            };

            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (!res.ok) {
                setMultiResults(prev => prev.map((c, i) =>
                    i === index ? { ...c, status: "error", error: data.error || `HTTP ${res.status}` } : c
                ));
                return;
            }

            const name = (data.chartType || chartType).replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
            setMultiResults(prev => prev.map((c, i) =>
                i === index ? { ...c, chartType: data.chartType || chartType, name, image: data.image, code: data.code, status: "done", error: undefined } : c
            ));
        } catch (e: any) {
            setMultiResults(prev => prev.map((c, i) =>
                i === index ? { ...c, status: "error", error: e.message || "Retry failed." } : c
            ));
        }
    }, [user, prompt, files, setShowLogin]);

    // ── Generate (single) ──
    const generate = useCallback(async (retryWithError = false, chartOverride?: string) => {
        if (!user) { setShowLogin(true); return; }
        if (!prompt.trim()) return;

        // 2+ charts selected, or no chart selected + files → use multi flow
        if (!retryWithError && !chartOverride && (selectedCharts.length >= 2 || (selectedCharts.length === 0 && files.length > 0))) {
            await runMulti();
            return;
        }

        // Single chart: use selection or ask AI
        let chartToUse = chartOverride ?? selectedCharts[0] ?? "";
        if (!retryWithError && files.length > 0 && !chartToUse) {
            chartToUse = await suggestCharts();
        }

        setLoading(true);
        setError(null);
        // Clear multi results when running single
        setMultiResults([]);
        setMultiError(null);
        if (!retryWithError) {
            setResultImage(null);
            setResultCode("");
            setResultChartType("");
        }

        try {
            const body: any = {
                action: "generate",
                prompt,
                chartType: chartToUse,
                contextFiles: files.map(f => ({ name: f.name, content: f.content, rFileName: f.rFileName, fileData: f.fileData, images: f.images ?? [] })),
            };

            if (retryWithError && resultCode) {
                body.previousCode = resultCode;
                body.previousError = error;
            }

            const res = await fetch("/api/r/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 402) {
                    setError(t("quotaReached"));
                    if (data.code) setResultCode(data.code);
                    return;
                }
                if (res.status === 422 && data.code) {
                    setResultCode(data.code);
                    setError(data.error || t("generationFailed"));
                    return;
                }
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            // Redirect to session page
            if (data.sessionId) {
                router.push(`/r/${data.sessionId}`);
            }
        } catch (e: any) {
            setError(e.message || "Generation failed.");
        } finally {
            setLoading(false);
        }
    }, [user, prompt, selectedCharts, files, resultCode, error, setShowLogin, suggestCharts, runMulti]);

    const handleRetry = () => generate(true);

    const handleNew = () => {
        setResultImage(null);
        setResultCode("");
        setError(null);
        setShowCode(false);
        setPrompt("");
        setSelectedCharts([]);
        setSuggestedCharts([]);
        setSuggestReasoning("");
        setMultiResults([]);
        setMultiError(null);
        setActiveSessionId(null);
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

    const loadSession = useCallback((id: string) => {
        router.push(`/r/${id}`);
    }, [router]);

    const handleCopy = () => {
        if (!resultCode) return;
        navigator.clipboard.writeText(resultCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const handleDownload = () => {
        if (!resultImage) return;
        const a = document.createElement("a");
        a.href = resultImage;
        a.download = `r-${resultChartType || "plot"}.png`;
        a.click();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    };

    // Determine whether submit will trigger multi
    const willRunMulti = selectedCharts.length >= 2 || (selectedCharts.length === 0 && files.length > 0);

    return (
        <div className="h-full relative flex flex-col bg-[#F9F9F9]" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>

            <RSidebar
                open={sidebarOpen}
                onToggle={() => setSidebarOpen(v => !v)}
                activeSessionId={activeSessionId}
                refreshTrigger={sidebarRefresh}
                onSelectSession={loadSession}
                onNewSession={handleNew}
            />

            {/* ── Mobile chart type sheet ── */}
            <RChartSheet
                open={chartSheetOpen}
                onClose={() => setChartSheetOpen(false)}
                selectedCharts={selectedCharts}
                suggestedCharts={suggestedCharts}
                onSelectChart={(id) => {
                    setSelectedCharts(prev =>
                        prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
                    );
                    setSuggestedCharts([]);
                    setSuggestReasoning("");
                }}
                onClearCharts={() => { setSelectedCharts([]); setSuggestedCharts([]); setSuggestReasoning(""); }}
            />

            {/* ── Page header ── */}
            <div className="max-w-3xl mx-auto w-full px-5 pt-10 pb-2 shrink-0">
                <div className="flex items-end gap-4">
                    {/* Spacer for hamburger when sidebar closed */}
                    <div className="w-8 shrink-0" />
                    <div>
                        <p className="text-[11px] font-bold text-gray-300 uppercase tracking-[0.2em] mb-1 font-mono">{t("studioLabel")}</p>
                        <h1 className="text-[28px] md:text-[34px] font-black text-[#1a1a1a] tracking-tight leading-none">
                            {t("title")}
                        </h1>
                    </div>
                </div>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <main className="max-w-3xl mx-auto w-full px-5 pt-6 space-y-6 pb-6">

                {/* ── Chart gallery — desktop only; mobile uses RChartSheet ── */}
                <div className="hidden md:block">
                    <ChartGallery
                        selectedCharts={selectedCharts}
                        suggestedCharts={suggestedCharts}
                        suggestReasoning={suggestReasoning}
                        loading={loading}
                        onSelectChart={(id) => {
                            setSelectedCharts(prev =>
                                prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
                            );
                            setSuggestedCharts([]);
                            setSuggestReasoning("");
                        }}
                        onClearCharts={() => { setSelectedCharts([]); setSuggestedCharts([]); setSuggestReasoning(""); }}
                    />
                </div>

                {/* ── Single error banner ── */}
                <AnimatePresence>
                    {error && !loading && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-start gap-3 px-4 py-3 bg-white border border-red-100 rounded-2xl
                                       text-[13px] text-red-500 shadow-sm"
                        >
                            <span className="flex-1 leading-snug">{error}</span>
                            <div className="flex items-center gap-2 shrink-0">
                                {resultCode && (
                                    <button
                                        onClick={handleRetry}
                                        className="text-[11px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wide"
                                    >
                                        Retry
                                    </button>
                                )}
                                <button onClick={() => setError(null)} className="text-red-300 hover:text-red-500 transition-colors">
                                    <IconX className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Multi error banner ── */}
                <AnimatePresence>
                    {multiError && !multiLoading && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-start gap-3 px-4 py-3 bg-white border border-red-100 rounded-2xl
                                       text-[13px] text-red-500 shadow-sm"
                        >
                            <span className="flex-1 leading-snug">{multiError}</span>
                            <button onClick={() => setMultiError(null)} className="text-red-300 hover:text-red-500 transition-colors">
                                <IconX className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Single result panel ── */}
                <AnimatePresence mode="popLayout">
                    {(loading || resultImage) && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="bg-white rounded-2xl border border-[#e8e8e8] shadow-sm overflow-hidden"
                        >
                            {/* Image */}
                            <div className="min-h-[280px] flex items-center justify-center bg-[#FAFAFA] border-b border-[#f0f0f0]">
                                {loading && !resultImage ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white border border-[#e8e8e8] shadow-sm
                                                        flex items-center justify-center">
                                            <IconLoader2 className="w-4 h-4 animate-spin text-[#1a1a1a]" />
                                        </div>
                                        <p className="text-[12px] text-gray-400 font-medium">
                                            {suggesting ? t("analysing") : t("runningR")}
                                        </p>
                                    </div>
                                ) : resultImage ? (
                                    <img
                                        src={resultImage}
                                        alt="R visualization"
                                        className="max-w-full max-h-[520px] object-contain p-4"
                                    />
                                ) : null}
                            </div>

                            {/* Toolbar */}
                            {resultImage && (
                                <div className="flex items-center justify-between px-4 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setShowCode(v => !v)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold
                                                        uppercase tracking-wide transition-all border
                                                        ${showCode
                                                            ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                                                            : "text-gray-400 border-[#ebebeb] hover:border-[#aaa] hover:text-[#1a1a1a]"}`}
                                        >
                                            <IconCode className="w-3.5 h-3.5" />
                                            Code
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold
                                                       uppercase tracking-wide border border-[#ebebeb] text-gray-400
                                                       hover:border-[#aaa] hover:text-[#1a1a1a] transition-all"
                                        >
                                            <IconDownload className="w-3.5 h-3.5" />
                                            PNG
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={handleRetry}
                                            disabled={loading}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold
                                                       uppercase tracking-wide border border-[#ebebeb] text-gray-400
                                                       hover:border-[#aaa] hover:text-[#1a1a1a] transition-all disabled:opacity-30"
                                        >
                                            <IconRefresh className="w-3.5 h-3.5" />
                                            Retry
                                        </button>
                                        <button
                                            onClick={handleNew}
                                            className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide
                                                       bg-[#1a1a1a] text-white hover:bg-black transition-all"
                                        >
                                            New
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Code panel */}
                            <AnimatePresence>
                                {showCode && resultCode && (
                                    <motion.div
                                        key="code"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden border-t border-[#f0f0f0]"
                                    >
                                        <div className="flex items-center justify-between px-4 py-2 bg-[#f8f8f8] border-b border-[#eeeeee]">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">R Code</span>
                                            <button
                                                onClick={handleCopy}
                                                className="flex items-center gap-1 text-[10px] font-bold text-gray-400
                                                           hover:text-[#1a1a1a] transition-colors uppercase tracking-wide"
                                            >
                                                {copied
                                                    ? <><IconCheck className="w-3.5 h-3.5 text-green-500" /> Copied</>
                                                    : <><IconCopy className="w-3.5 h-3.5" /> Copy</>
                                                }
                                            </button>
                                        </div>
                                        <pre className="px-5 py-4 text-[12px] leading-relaxed overflow-x-auto font-mono
                                                        text-[#1a1a1a] bg-[#f8f8f8] max-h-[360px] thin-scrollbar whitespace-pre-wrap">
                                            {resultCode}
                                        </pre>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Multi: stepper + results ── */}
                <AnimatePresence mode="popLayout">
                    {(multiLoading || multiResults.length > 0) && (
                        <motion.div
                            key="multi"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="space-y-4"
                        >
                            {/* ── Progress card (while polling) ── */}
                            {multiLoading && (() => {
                                const done = multiResults.filter(c => c.status === "done").length;
                                const total = chartsPlanned.length || multiResults.length;
                                const pct = total > 0 ? (done / total) * 100 : 0;
                                return (
                                    <div className="bg-white border border-[#e8e8e8] rounded-2xl p-6 shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <IconLoader2 className="w-4 h-4 animate-spin text-[#1a1a1a] shrink-0" />
                                            <p className="text-[13px] font-bold text-[#1a1a1a] flex-1">
                                                {done === 0 ? t("generating") : t("chartsReady").replace("{done}", String(done)).replace("{total}", String(total))}
                                            </p>
                                            <span className="text-[11px] font-mono text-gray-300 tabular-nums shrink-0">
                                                {elapsed.toFixed(1)}s
                                            </span>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="w-full bg-[#f5f5f5] h-1 rounded-full overflow-hidden mb-4">
                                            <motion.div
                                                className="h-full bg-[#1a1a1a] rounded-full"
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.5, ease: "easeOut" }}
                                            />
                                        </div>

                                        {/* Per-chart status list */}
                                        {(multiResults.length > 0 || chartsPlanned.length > 0) && (
                                            <div className="space-y-1">
                                                {(chartsPlanned.length > 0 ? chartsPlanned : multiResults.map(c => c.chartType)).map((ct, i) => {
                                                    const res = multiResults[i];
                                                    const status = res?.status ?? "pending";
                                                    const name = (res?.name) || ct.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
                                                    return (
                                                        <div key={i} className="flex items-center gap-2.5 px-1">
                                                            <div className="shrink-0 w-4 flex justify-center">
                                                                {status === "generating" && <IconLoader2 className="w-3 h-3 animate-spin text-gray-400" />}
                                                                {status === "done" && <IconCheck className="w-3 h-3 text-[#1a1a1a]" stroke={2.5} />}
                                                                {status === "error" && <IconX className="w-3 h-3 text-red-400" />}
                                                                {status === "pending" && <div className="w-2 h-2 rounded-full bg-[#e0e0e0]" />}
                                                            </div>
                                                            <p className={`text-[11px] font-medium flex-1 ${status === "done" ? "text-[#1a1a1a]" : "text-gray-400"}`}>
                                                                {name}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* ── Header when done ── */}
                            {!multiLoading && multiResults.length > 0 && (
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.18em]">
                                        {multiResults.filter(c => c.status === "done").length} charts · {elapsed.toFixed(1)}s
                                    </p>
                                    <button onClick={handleNew} className="text-[11px] text-gray-400 hover:text-[#1a1a1a] font-medium transition-colors">
                                        {t("clear")}
                                    </button>
                                </div>
                            )}

                            {/* ── Results grid ── */}
                            {multiResults.some(c => c.status === "done") && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {multiResults.filter(c => c.status === "done").map((chart, i) => (
                                        <MultiChartCard
                                            key={`done-${i}`}
                                            chart={chart}
                                            index={multiResults.indexOf(chart)}
                                            onRetry={retryMultiChart}
                                        />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                </main>
            </div>

            {/* ── Bottom input (sticky) ── */}
            <div className="shrink-0 bg-[#F9F9F9]/95 backdrop-blur-sm pt-3 pb-[76px] md:pb-4">
                <div className="max-w-3xl mx-auto w-full px-5">
                    <div
                        className="bg-white rounded-2xl overflow-hidden"
                        style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.08)" }}
                    >
                        {/* Textarea */}
                        <div className="px-4 pt-4 pb-2">
                            <textarea
                                ref={textareaRef}
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && !e.shiftKey && !loading && !multiLoading) {
                                        e.preventDefault();
                                        generate();
                                    }
                                }}
                                placeholder={t("placeholder")}
                                style={{ fontSize: "16px", touchAction: "manipulation" }}
                                className="w-full leading-relaxed text-[#1a1a1a] bg-transparent outline-none
                                           placeholder:text-[#bbb] resize-none min-h-[52px]"
                                autoFocus
                            />
                        </div>

                        {/* Attached files row */}
                        {(files.length > 0 || uploading) && (
                            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                                {files.map((f, i) => (
                                    <span
                                        key={i}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f3f3f3] rounded-lg
                                                   text-[11px] font-medium text-[#444] border border-[#e8e8e8]"
                                    >
                                        <IconFile className="w-3 h-3 text-gray-400 shrink-0" />
                                        <span className="truncate max-w-[120px]">{f.name}</span>
                                        <button
                                            onClick={() => removeFile(i)}
                                            className="text-gray-300 hover:text-gray-600 transition-colors"
                                        >
                                            <IconX className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                                {uploading && (
                                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f3f3f3] rounded-lg text-[11px] text-gray-400">
                                        <IconLoader2 className="w-3 h-3 animate-spin" />
                                        {t("reading")}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                            <div className="flex items-center gap-1 flex-wrap">
                                {/* Attach file */}
                                <label className="cursor-pointer p-1.5 text-gray-400 hover:text-[#1a1a1a] rounded-lg
                                                  hover:bg-[#f5f5f5] transition-colors" title="Attach CSV / Excel">
                                    <IconPaperclip className="w-4 h-4" stroke={1.8} />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        multiple
                                        accept=".csv,.tsv,.xlsx,.xls,.txt,.json,.pdf,.doc,.docx,.ppt,.pptx"
                                        onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
                                    />
                                </label>

                                {/* Mobile: open chart type sheet */}
                                <button
                                    onClick={() => setChartSheetOpen(true)}
                                    className="md:hidden p-1.5 text-gray-400 hover:text-[#1a1a1a] rounded-lg hover:bg-[#f5f5f5] transition-colors"
                                    title="Chart type"
                                    style={{ touchAction: "manipulation" }}
                                >
                                    <IconLayoutGrid className="w-4 h-4" stroke={1.8} />
                                </button>

                                {/* Selected chart chips */}
                                {selectedCharts.length > 0 ? (
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {selectedCharts.map(id => (
                                            <span key={id} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-[#1a1a1a] text-white
                                                             rounded-lg text-[11px] font-semibold">
                                                {CHARTS.find(c => c.id === id)?.name ?? id}
                                                <button onClick={() => setSelectedCharts(prev => prev.filter(c => c !== id))} className="hover:opacity-60 transition-opacity ml-0.5">
                                                    <IconX className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : willRunMulti ? (
                                    <span className="flex items-center gap-1 px-2 py-1 bg-[#f5f5f5] text-[#555] border border-[#e8e8e8]
                                                     rounded-lg text-[11px] font-semibold">
                                        <IconSparkles className="w-3 h-3" />
                                        {t("multiChart")}
                                    </span>
                                ) : (
                                    <span className="text-[11px] text-gray-300 px-1 hidden sm:block">
                                        {t("selectOrLetAi")}
                                    </span>
                                )}
                            </div>

                            {/* Submit */}
                            <button
                                onClick={() => generate()}
                                disabled={!prompt.trim() || loading || suggesting || multiLoading}
                                className="w-8 h-8 bg-[#1a1a1a] text-white rounded-xl flex items-center justify-center
                                           disabled:opacity-15 transition-all hover:bg-black active:scale-95 shrink-0"
                                style={{ touchAction: "manipulation" }}
                            >
                                {(loading || suggesting || multiLoading)
                                    ? <IconLoader2 className="w-4 h-4 animate-spin" />
                                    : <IconArrowUp className="w-4 h-4" />
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
