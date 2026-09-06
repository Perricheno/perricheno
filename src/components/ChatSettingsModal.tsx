"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check, Plus, Trash2 } from "lucide-react";
import { useAdmin } from "@/components/AdminContext";
import { getSettings, saveSettings, type ChatSettings } from "@/app/actions";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSettingsChanged?: (s: ChatSettings) => void;
}

export default function ChatSettingsModal({ isOpen, onClose, onSettingsChanged }: Props) {
    const { isEditing } = useAdmin();
    const [settings, setSettings] = useState<ChatSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [newModel, setNewModel] = useState("");

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getSettings().then(s => { setSettings(s); setLoading(false); });
        }
    }, [isOpen]);

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await saveSettings(settings);
            onSettingsChanged?.(settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            onClose();
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const addModel = () => {
        if (!settings || !newModel.trim() || settings.models.includes(newModel.trim())) return;
        setSettings({ ...settings, models: [...settings.models, newModel.trim()] });
        setNewModel("");
    };

    const removeModel = (m: string) => {
        if (!settings) return;
        const updated = settings.models.filter(x => x !== m);
        setSettings({ ...settings, models: updated, selectedModel: settings.selectedModel === m ? (updated[0] || "") : settings.selectedModel });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={onClose}>
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">

                        {/* Header */}
                        <div className="flex justify-between items-center p-5 pb-0">
                            <h2 className="text-lg font-bold text-white">Settings</h2>
                            <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                        ) : settings ? (
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">

                                {/* Webhook - admin only */}
                                {isEditing && (
                                    <Section title="Webhook">
                                        <div className="flex rounded-lg overflow-hidden border border-white/10 mb-3">
                                            <button onClick={() => setSettings({ ...settings, useTestWebhook: true })}
                                                className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${settings.useTestWebhook ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
                                                🧪 Test
                                            </button>
                                            <button onClick={() => setSettings({ ...settings, useTestWebhook: false })}
                                                className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${!settings.useTestWebhook ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40 hover:bg-white/10"}`}>
                                                🚀 Production
                                            </button>
                                        </div>
                                        <Field label="Test URL" value={settings.webhookTest} onChange={v => setSettings({ ...settings, webhookTest: v })} mono />
                                        <Field label="Production URL" value={settings.webhookProd} onChange={v => setSettings({ ...settings, webhookProd: v })} mono />
                                    </Section>
                                )}

                                {/* Models */}
                                <Section title="Models">
                                    <div>
                                        <label className="block text-xs text-white/40 mb-1">Active Model</label>
                                        <select value={settings.selectedModel}
                                            onChange={(e) => setSettings({ ...settings, selectedModel: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 cursor-pointer">
                                            {settings.models.map(m => <option key={m} value={m} className="bg-[#222]">{m}</option>)}
                                        </select>
                                    </div>

                                    {isEditing && (
                                        <div className="mt-3">
                                            <label className="block text-xs text-white/40 mb-1.5">Manage Models</label>
                                            <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                                                {settings.models.map(m => (
                                                    <div key={m} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 group">
                                                        <span className="text-xs text-white/70 font-mono">{m}</span>
                                                        <button onClick={() => removeModel(m)} className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 transition-all">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <input value={newModel} onChange={(e) => setNewModel(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && addModel()}
                                                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-500 font-mono"
                                                    placeholder="model-name..." />
                                                <button onClick={addModel} className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </Section>

                                {/* Generation - admin only */}
                                {isEditing && (
                                    <Section title="Generation">
                                        <div>
                                            <label className="block text-xs text-white/40 mb-1">System Prompt</label>
                                            <textarea value={settings.systemPrompt}
                                                onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 min-h-[80px] resize-y" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <Field label="Temperature" value={String(settings.temperature)} onChange={v => setSettings({ ...settings, temperature: parseFloat(v) || 0 })} type="number" step="0.1" />
                                            <Field label="Max Tokens" value={String(settings.maxTokens)} onChange={v => setSettings({ ...settings, maxTokens: parseInt(v) || 0 })} type="number" />
                                        </div>
                                    </Section>
                                )}

                                {/* Save */}
                                <button onClick={handleSave} disabled={saving}
                                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
                                    {saving ? "Saving..." : saved ? "Saved!" : "Save"}
                                </button>
                            </div>
                        ) : (
                            <p className="text-white/40 text-center py-8">Failed to load.</p>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* ── Helpers ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">{title}</h3>
            {children}
        </div>
    );
}

function Field({ label, value, onChange, mono, type, step }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; type?: string; step?: string }) {
    return (
        <div>
            <label className="block text-xs text-white/40 mb-1">{label}</label>
            <input type={type || "text"} step={step} value={value} onChange={(e) => onChange(e.target.value)}
                className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 ${mono ? "font-mono" : ""}`} />
        </div>
    );
}
