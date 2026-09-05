"use client";

import { useRef, useState } from "react";
import { IconLoader2, IconUpload, IconCheck, IconX, IconFileZip } from "@tabler/icons-react";

// ── Preview SVGs ──────────────────────────────────────────────────────────────
// Each is a 72×96 miniature page illustration.

function PreviewPlain() {
    return (
        <svg width="72" height="96" viewBox="0 0 72 96" fill="none">
            <rect width="72" height="96" rx="3" fill="white" />
            <rect x="8" y="12" width="30" height="4" rx="1" fill="#1a1a1a" opacity=".85" />
            <rect x="8" y="18" width="20" height="2.5" rx="1" fill="#aaa" />
            <rect x="8" y="26" width="56" height="1.5" rx=".5" fill="#e0e0e0" />
            {[32, 37, 42, 47, 52, 57, 62, 67, 72, 77].map((y, i) => (
                <rect key={i} x="8" y={y} width={i % 3 === 2 ? 38 : 56} height="1.5" rx=".5" fill="#d4d4d4" />
            ))}
        </svg>
    );
}

function PreviewAcademic() {
    return (
        <svg width="72" height="96" viewBox="0 0 72 96" fill="none">
            <rect width="72" height="96" rx="3" fill="white" />
            {/* header bar */}
            <rect y="0" width="72" height="9" rx="3" fill="#1a1a1a" />
            <rect y="6" width="72" height="3" fill="#1a1a1a" />
            <rect x="4" y="2" width="20" height="2" rx=".5" fill="white" opacity=".6" />
            <rect x="48" y="2" width="20" height="2" rx=".5" fill="white" opacity=".6" />
            {/* title */}
            <rect x="12" y="14" width="48" height="4.5" rx="1" fill="#1a1a1a" opacity=".8" />
            <rect x="20" y="20" width="32" height="2.5" rx=".5" fill="#888" />
            <rect x="8" y="26" width="56" height="0.8" rx=".4" fill="#1a1a1a" opacity=".3" />
            {[31, 36, 41, 46, 51, 56, 61, 66, 71, 76].map((y, i) => (
                <rect key={i} x="8" y={y} width={i % 3 === 2 ? 38 : 56} height="1.5" rx=".5" fill="#d4d4d4" />
            ))}
            {/* footer line */}
            <rect x="8" y="90" width="56" height="0.8" rx=".4" fill="#1a1a1a" opacity=".2" />
            <rect x="30" y="92" width="12" height="1.5" rx=".5" fill="#ccc" />
        </svg>
    );
}

function PreviewIEEE() {
    return (
        <svg width="72" height="96" viewBox="0 0 72 96" fill="none">
            <rect width="72" height="96" rx="3" fill="white" />
            {/* title spanning full width */}
            <rect x="6" y="8" width="60" height="4" rx="1" fill="#1a1a1a" opacity=".8" />
            <rect x="16" y="14" width="40" height="2.5" rx=".5" fill="#999" />
            <rect x="6" y="19" width="60" height="0.8" rx=".4" fill="#bbb" />
            {/* two columns */}
            {[23, 28, 33, 38, 43, 48, 53, 58, 63, 68, 73, 78].map((y, i) => (
                <rect key={i} x="6" y={y} width={i % 4 === 3 ? 22 : 28} height="1.3" rx=".4" fill="#d4d4d4" />
            ))}
            {[23, 28, 33, 38, 43, 48, 53, 58, 63, 68, 73, 78].map((y, i) => (
                <rect key={i} x="38" y={y} width={i % 4 === 2 ? 20 : 28} height="1.3" rx=".4" fill="#d4d4d4" />
            ))}
            <rect x="34" y="19" width="0.8" height="72" fill="#e5e5e5" />
        </svg>
    );
}

function PreviewElegant() {
    return (
        <svg width="72" height="96" viewBox="0 0 72 96" fill="none">
            <rect width="72" height="96" rx="3" fill="white" />
            {/* wider margins */}
            <rect x="14" y="14" width="44" height="5" rx="1" fill="#1a1a1a" opacity=".75" />
            <rect x="20" y="21" width="32" height="2" rx=".5" fill="#aaa" />
            {[28, 34, 40, 46, 52, 58, 64, 70, 76].map((y, i) => (
                <rect key={i} x="14" y={y} width={i % 3 === 2 ? 28 : 44} height="1.8" rx=".5" fill="#ddd" />
            ))}
        </svg>
    );
}

function PreviewMinimal() {
    return (
        <svg width="72" height="96" viewBox="0 0 72 96" fill="none">
            <rect width="72" height="96" rx="3" fill="white" />
            <rect x="6" y="10" width="36" height="3.5" rx=".8" fill="#333" opacity=".75" />
            <rect x="6" y="15" width="24" height="2" rx=".5" fill="#bbb" />
            {[22, 27, 32, 37, 42, 47, 52, 57, 62, 67].map((y, i) => (
                <rect key={i} x="6" y={y} width={i % 4 === 3 ? 40 : 60} height="1.5" rx=".5" fill="#e0e0e0" />
            ))}
        </svg>
    );
}

function PreviewThesis() {
    return (
        <svg width="72" height="96" viewBox="0 0 72 96" fill="none">
            <rect width="72" height="96" rx="3" fill="white" />
            {/* title-page style: centered block, generous whitespace */}
            <rect x="18" y="18" width="36" height="3" rx="1" fill="#1a1a1a" opacity=".8" />
            <rect x="24" y="24" width="24" height="2" rx=".5" fill="#1a1a1a" opacity=".8" />
            <rect x="28" y="40" width="16" height="2" rx=".5" fill="#999" />
            <rect x="26" y="44" width="20" height="1.5" rx=".5" fill="#bbb" />
            <rect x="30" y="80" width="12" height="1.5" rx=".5" fill="#ccc" />
            {/* small TOC-dots hint */}
            <rect x="10" y="58" width="14" height="1.3" rx=".4" fill="#d4d4d4" />
            <rect x="26" y="58" width="24" height="1.3" rx=".4" fill="#e5e5e5" />
            <rect x="10" y="63" width="18" height="1.3" rx=".4" fill="#d4d4d4" />
            <rect x="30" y="63" width="20" height="1.3" rx=".4" fill="#e5e5e5" />
            <rect x="10" y="68" width="12" height="1.3" rx=".4" fill="#d4d4d4" />
            <rect x="24" y="68" width="26" height="1.3" rx=".4" fill="#e5e5e5" />
        </svg>
    );
}

function PreviewCustom() {
    return (
        <svg width="72" height="96" viewBox="0 0 72 96" fill="none">
            <rect width="72" height="96" rx="3" fill="#fafafa" stroke="#e5e5e5" />
            <rect x="16" y="20" width="40" height="56" rx="2" fill="white" stroke="#e0e0e0" strokeDasharray="4 2" />
            <text x="36" y="50" textAnchor="middle" fontSize="9" fill="#999" fontFamily="system-ui">Your</text>
            <text x="36" y="62" textAnchor="middle" fontSize="9" fill="#999" fontFamily="system-ui">Template</text>
        </svg>
    );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PRESETS = [
    { id: "plain",    name: "Plain",    description: "Standard 1-inch margins", Preview: PreviewPlain },
    { id: "academic", name: "Academic", description: "Headers, ruled title block", Preview: PreviewAcademic },
    { id: "ieee",     name: "IEEE",     description: "Two-column conference style", Preview: PreviewIEEE },
    { id: "elegant",  name: "Elegant",  description: "Palatino, generous margins", Preview: PreviewElegant },
    { id: "minimal",  name: "Minimal",  description: "Bare essentials only", Preview: PreviewMinimal },
    { id: "thesis",   name: "Thesis",   description: "Title page, TOC, chapters", Preview: PreviewThesis },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
    templateId: string;
    customTemplatePreamble: string;
    onTemplateChange: (id: string) => void;
    onCustomPreamble: (preamble: string) => void;
}

export function TemplatePicker({ templateId, customTemplatePreamble, onTemplateChange, onCustomPreamble }: Props) {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";

        setUploading(true);
        setUploadError(null);

        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/agent/templates/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            onCustomPreamble(data.preamble);
            onTemplateChange("custom");
        } catch (err: any) {
            setUploadError(err.message || "Upload failed.");
        } finally {
            setUploading(false);
        }
    };

    const clearCustom = () => {
        onCustomPreamble("");
        onTemplateChange("plain");
        setUploadError(null);
    };

    return (
        <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Template</label>

            {/* Preset grid */}
            <div className="grid grid-cols-3 gap-2">
                {PRESETS.map(({ id, name, description, Preview }) => {
                    const active = templateId === id && !customTemplatePreamble;
                    return (
                        <button
                            key={id}
                            onClick={() => { onTemplateChange(id); onCustomPreamble(""); setUploadError(null); }}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-left ${
                                active
                                    ? "border-[var(--foreground)] bg-[var(--foreground)]/5 shadow-sm"
                                    : "border-[var(--border)] hover:border-gray-300 bg-[var(--background)]"
                            }`}
                        >
                            <div className="relative">
                                <div className="rounded-lg overflow-hidden shadow-sm border border-[var(--border)]">
                                    <Preview />
                                </div>
                                {active && (
                                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                                        <IconCheck className="w-2.5 h-2.5 text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="w-full">
                                <p className="text-[11px] font-bold text-[var(--foreground)] leading-tight">{name}</p>
                                <p className="text-[9px] text-gray-400 leading-tight mt-0.5">{description}</p>
                            </div>
                        </button>
                    );
                })}

                {/* Custom / Overleaf card */}
                <button
                    onClick={() => fileRef.current?.click()}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-left ${
                        templateId === "custom" && customTemplatePreamble
                            ? "border-[var(--foreground)] bg-[var(--foreground)]/5 shadow-sm"
                            : "border-dashed border-[var(--border)] hover:border-gray-400 bg-[var(--background)]"
                    }`}
                >
                    <div className="relative">
                        <div className="rounded-lg overflow-hidden shadow-sm border border-[var(--border)]">
                            {uploading
                                ? <div className="w-[72px] h-[96px] flex items-center justify-center bg-[var(--background)]">
                                    <IconLoader2 className="w-6 h-6 animate-spin text-gray-400" />
                                  </div>
                                : <PreviewCustom />
                            }
                        </div>
                        {templateId === "custom" && customTemplatePreamble && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                                <IconCheck className="w-2.5 h-2.5 text-white" />
                            </div>
                        )}
                    </div>
                    <div className="w-full">
                        <p className="text-[11px] font-bold text-[var(--foreground)] leading-tight">Custom</p>
                        <p className="text-[9px] text-gray-400 leading-tight mt-0.5">Upload Overleaf ZIP</p>
                    </div>
                </button>
            </div>

            <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={handleZipUpload} />

            {/* Active custom template info */}
            {templateId === "custom" && customTemplatePreamble && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl">
                    <IconFileZip className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-xs text-[var(--foreground)] flex-1 truncate">
                        Custom preamble loaded ({customTemplatePreamble.length} chars)
                    </span>
                    <button onClick={clearCustom} className="text-gray-400 hover:text-[var(--foreground)] transition-colors">
                        <IconX className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Upload prompt when "Custom" is selected but no file yet */}
            {templateId !== "custom" || !customTemplatePreamble ? (
                <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[var(--border)] text-[11px] text-gray-400 hover:text-[var(--foreground)] hover:border-gray-300 transition-all"
                >
                    <IconUpload className="w-3.5 h-3.5" />
                    Upload Overleaf template (.zip)
                </button>
            ) : null}

            {uploadError && (
                <p className="text-xs text-red-500 px-1">{uploadError}</p>
            )}
        </div>
    );
}
