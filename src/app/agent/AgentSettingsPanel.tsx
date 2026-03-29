import { motion, AnimatePresence } from "framer-motion";
import { IconChevronDown } from "@tabler/icons-react";
import { AgentSettings } from "./types";

interface Props {
    settings: AgentSettings;
    updateSetting: <K extends keyof AgentSettings>(key: K, value: AgentSettings[K]) => void;
    detailsOpen: boolean;
    setDetailsOpen: (v: boolean) => void;
}

export function AgentSettingsPanel({ settings, updateSetting, detailsOpen, setDetailsOpen }: Props) {
    const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
        <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
            <button
                onClick={() => onChange(!value)}
                className={`w-11 h-6 rounded-full transition-colors relative ${value ? 'bg-[var(--foreground)]' : 'bg-[var(--border)]'}`}
            >
                <div className={`w-[18px] h-[18px] bg-white rounded-full shadow-sm absolute top-[3px] transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
            </button>
        </div>
    );

    const SegmentedControl = ({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: any) => void }) => (
        <div className="flex bg-[var(--background)] rounded-xl p-1 border border-[var(--border)]">
            {options.map(o => (
                <button
                    key={o.value}
                    onClick={() => onChange(o.value)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${value === o.value ? 'bg-white text-[var(--foreground)] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );

    return (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] p-6 space-y-5 shadow-sm mt-4">
            {/* Row 1: Language + Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Language</label>
                    <SegmentedControl
                        options={[{ label: "English", value: "en" }, { label: "Русский", value: "ru" }]}
                        value={settings.language}
                        onChange={(v) => updateSetting("language", v)}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Style</label>
                    <SegmentedControl
                        options={[{ label: "Simple", value: "simple" }, { label: "Medium", value: "medium" }, { label: "PhD", value: "phd" }]}
                        value={settings.style}
                        onChange={(v) => updateSetting("style", v)}
                    />
                </div>
            </div>

            {/* Row 2: Word count slider */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Word count</label>
                    <span className="text-sm font-mono font-bold text-[var(--foreground)] tabular-nums">{settings.wordCount.toLocaleString()}</span>
                </div>
                <input
                    type="range"
                    min={500}
                    max={6000}
                    step={250}
                    value={settings.wordCount}
                    onChange={(e) => updateSetting("wordCount", Number(e.target.value))}
                    className="w-full h-1.5 bg-[var(--border)] rounded-full appearance-none cursor-pointer accent-[var(--foreground)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[var(--foreground)] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-300 font-mono">
                    <span>500</span><span>2000</span><span>4000</span><span>6000</span>
                </div>
            </div>

            {/* Row 3: Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Columns</label>
                    <SegmentedControl
                        options={[{ label: "One", value: "1" }, { label: "Two", value: "2" }]}
                        value={String(settings.columns)}
                        onChange={(v) => updateSetting("columns", Number(v) as 1 | 2)}
                    />
                </div>
                <div className="space-y-3 pt-5 md:pt-0 md:space-y-2">
                    <Toggle label="Use Perricheno Template" value={settings.useTemplate} onChange={(v) => updateSetting("useTemplate", v)} />
                    <Toggle label="Include References" value={settings.useReferences} onChange={(v) => updateSetting("useReferences", v)} />
                </div>
            </div>

            {/* Collapsible details */}
            <div>
                <button onClick={() => setDetailsOpen(!detailsOpen)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wider">
                    <IconChevronDown className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
                    Document details
                </button>
                <AnimatePresence>
                    {detailsOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
                                {[
                                    { key: "authorName" as const, label: settings.language === 'ru' ? "Автор" : "Author", placeholder: "Amangeldy Shyngyskhan" },
                                    { key: "courseName" as const, label: settings.language === 'ru' ? "Курс" : "Course", placeholder: "Data Science" },
                                    { key: "groupName" as const, label: settings.language === 'ru' ? "Группа" : "Group", placeholder: "SE-2201" },
                                    { key: "supervisorName" as const, label: settings.language === 'ru' ? "Преподаватель" : "Supervisor", placeholder: "Dr. Smith" },
                                    { key: "dateStr" as const, label: settings.language === 'ru' ? "Дата" : "Date", placeholder: "\\today" },
                                ].map(f => (
                                    <div key={f.key} className="space-y-1">
                                        <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{f.label}</label>
                                        <input
                                            type="text"
                                            value={settings[f.key]}
                                            onChange={(e) => updateSetting(f.key, e.target.value)}
                                            placeholder={f.placeholder}
                                            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-[var(--foreground)] transition-colors placeholder:text-gray-300"
                                        />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
