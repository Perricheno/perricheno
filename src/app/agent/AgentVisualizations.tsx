import { useState, useRef, useEffect } from "react";
import { IconPhotoPlus, IconLoader2, IconCode, IconDownload, IconFileImport } from "@tabler/icons-react";
import { RImage, Language } from "./types";
import { motion, AnimatePresence } from "framer-motion";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";

interface Props {
    topic: string;
    language: Language;
    rImages: RImage[];
    setRImages: (v: RImage[] | ((prev: RImage[]) => RImage[])) => void;
    sessionId: string | null;
    openEditor: (index: number) => void;
    onAddVisualsToReport: (images: RImage[]) => void;
}

const CHART_TYPES = [
    { id: "bar", label: "Bar Chart" },
    { id: "line", label: "Line Chart" },
    { id: "scatter", label: "Scatter Plot" },
    { id: "heatmap", label: "Heatmap" },
    { id: "3d_surface", label: "3D Surface" },
    { id: "network", label: "Network Graph" },
    { id: "boxplot", label: "Boxplot" },
    { id: "radar", label: "Radar Chart" },
    { id: "waffle", label: "Waffle Chart" },
    { id: "wordcloud", label: "Wordcloud" },
    { id: "waterfall", label: "Waterfall" },
    { id: "ridge", label: "Density Ridge" },
];

const PALETTES = [
    { id: "viridis", label: "Viridis" },
    { id: "Spectral", label: "Spectral" },
    { id: "Blues", label: "Blues" },
    { id: "Dark2", label: "Dark2" },
    { id: "Set1", label: "Set1" },
];

export function AgentVisualizations({ topic, language, rImages, setRImages, sessionId, openEditor, onAddVisualsToReport }: Props) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedCharts, setSelectedCharts] = useState<string[]>(["bar"]);
    const [palette, setPalette] = useState("viridis");
    const [dataContext, setDataContext] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Streaming state
    const [currentGeneratingChart, setCurrentGeneratingChart] = useState<string | null>(null);
    const [streamedCode, setStreamedCode] = useState("");
    const [isCompiling, setIsCompiling] = useState(false);
    
    const streamBoxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (streamBoxRef.current) streamBoxRef.current.scrollTop = streamBoxRef.current.scrollHeight;
    }, [streamedCode]);

    const toggleChart = (id: string) => {
        if (selectedCharts.includes(id)) {
            setSelectedCharts(selectedCharts.filter(c => c !== id));
        } else {
            if (selectedCharts.length >= 4) return; // max 4
            setSelectedCharts([...selectedCharts, id]);
        }
    };

    const generateImages = async () => {
        if (!topic || selectedCharts.length === 0) return;
        setIsGenerating(true);
        setError(null);

        const newImages: RImage[] = [];

        try {
            for (const chartType of selectedCharts) {
                setCurrentGeneratingChart(chartType);
                setStreamedCode("");
                setIsCompiling(false);

                // Step 1: Stream Code Generation
                const res = await fetch('/api/agent/visualize/generate-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topic, chartType, palette, language, dataContext })
                });

                if (!res.ok) throw new Error(`Code generation failed for ${chartType}`);
                
                const reader = res.body!.getReader();
                const decoder = new TextDecoder();
                let fullCode = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    fullCode += decoder.decode(value, { stream: true });
                    setStreamedCode(fullCode);
                }

                // Step 2: Compile the Code
                setIsCompiling(true);
                const compileRes = await fetch('/api/agent/r-compile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: fullCode })
                });

                if (!compileRes.ok) throw new Error(`Compilation failed for ${chartType}`);

                const compileData = await compileRes.json();
                
                if (compileData.success && compileData.image) {
                    newImages.push({
                        image: compileData.image,
                        chart_type: chartType,
                        r_code: fullCode
                    });
                } else {
                    console.error("Compile log:", compileData.log);
                    throw new Error(`R Error: ${compileData.log || "Unknown compilation issue"}`);
                }
            }

            if (newImages.length > 0) {
                const updatedImages = [...rImages, ...newImages];
                setRImages(updatedImages);

                if (sessionId) {
                    await fetch(`/api/agent/sessions/${sessionId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ r_images_json: updatedImages })
                    });
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
            setCurrentGeneratingChart(null);
            setStreamedCode("");
        }
    };

    const downloadImage = (base64: string, name: string) => {
        const a = document.createElement("a");
        a.href = `data:image/png;base64,${base64}`;
        a.download = `${name}.png`;
        a.click();
    };

    return (
        <div className="w-full mt-8 p-6 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                        <IconPhotoPlus className="w-4 h-4" />
                    </span>
                    Add Visualizations (R Compiler)
                </h3>
                {rImages.length > 0 && !isGenerating && (
                    <button
                        onClick={() => onAddVisualsToReport(rImages)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-xs font-bold hover:bg-emerald-100 transition-colors"
                    >
                        <IconFileImport className="w-4 h-4" /> Add All to Report
                    </button>
                )}
            </div>

            {/* Controls */}
            {!isGenerating && (
                <div className="space-y-5 mb-6">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Data Context & Focus Area (Optional)</label>
                        <textarea 
                            value={dataContext}
                            onChange={e => setDataContext(e.target.value)}
                            placeholder="e.g., Focus the bar chart on years 2020-2024 and highlight the performance drop..."
                            className="w-full h-16 bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--foreground)] resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Chart Types (max 4)</label>
                        <div className="flex flex-wrap gap-2">
                            {CHART_TYPES.map(c => {
                                const active = selectedCharts.includes(c.id);
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => toggleChart(c.id)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors border ${active ? 'bg-[var(--foreground)] text-[var(--card)] border-[var(--foreground)]' : 'bg-transparent text-gray-500 border-[var(--border)] hover:border-gray-400'}`}
                                    >
                                        {c.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Palette</label>
                            <select
                                value={palette}
                                onChange={(e) => setPalette(e.target.value)}
                                className="text-sm font-medium bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1 outline-none"
                            >
                                {PALETTES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>

                        <button
                            onClick={generateImages}
                            disabled={selectedCharts.length === 0}
                            className="mt-6 flex items-center gap-2 px-5 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                            <IconPhotoPlus className="w-4 h-4" /> Generate
                        </button>
                    </div>
                    {error && <p className="text-xs font-medium text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
                </div>
            )}

            {/* Streaming UI */}
            <AnimatePresence>
                {isGenerating && currentGeneratingChart && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-6">
                        <div className="border border-blue-200 rounded-xl overflow-hidden shadow-sm bg-blue-50/30">
                            <div className="h-10 bg-white border-b border-blue-100 flex items-center px-4 gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                                    {isCompiling ? `Compiling ${currentGeneratingChart.replace('_', ' ')}...` : `Writing Code: ${currentGeneratingChart}`}
                                </span>
                                {isCompiling && <IconLoader2 className="w-4 h-4 text-blue-500 animate-spin ml-auto" />}
                            </div>
                            <div ref={streamBoxRef} className="h-48 overflow-auto bg-[#282c34] p-0 font-mono text-[12px]">
                                <CodeMirror
                                    value={streamedCode + (isCompiling ? "" : "\n█")}
                                    theme={oneDark}
                                    editable={false}
                                    extensions={[]}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Generated Images Grid */}
            {rImages.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-4 border-t border-[var(--border)]">
                    {rImages.map((img, i) => (
                        <div key={i} className="group relative bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                            <img src={`data:image/png;base64,${img.image}`} alt={img.chart_type} className="w-full aspect-square object-cover" />

                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                <button
                                    onClick={() => openEditor(i)}
                                    className="px-4 py-2 bg-white text-black rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-gray-200 transition-colors"
                                >
                                    <IconCode className="w-4 h-4" /> AI Edit R Code
                                </button>
                                <button
                                    onClick={() => downloadImage(img.image, `fig_${i + 1}_${img.chart_type}`)}
                                    className="px-4 py-2 bg-transparent border border-white text-white rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-white/20 transition-colors"
                                >
                                    <IconDownload className="w-4 h-4" /> Download PNG
                                </button>
                            </div>

                            <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-white rounded-md text-[9px] font-bold uppercase tracking-wider backdrop-blur-md">
                                {img.chart_type.replace("_", " ")}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
