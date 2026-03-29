import { useState, useEffect } from "react";
import { IconPhotoPlus, IconLoader2, IconCode, IconDownload, IconFileImport, IconReload, IconAlertCircle } from "@tabler/icons-react";
import { RImage, Language } from "./types";

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

// Sub-component for parallel loading
function GeneratingCard({ chartType, topic, palette, language, dataContext, onComplete, onCancel }: any) {
    const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
    const [errorMsg, setErrorMsg] = useState("");

    const generate = async () => {
        setStatus("loading");
        try {
            const res = await fetch('/api/agent/visualize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, chartType, palette, language, dataContext })
            });
            const data = await res.json();
            
            if (res.ok && data.success && data.image) {
                setStatus("done");
                onComplete({
                    image: data.image,
                    chart_type: data.chart_type,
                    r_code: data.r_code
                });
            } else {
                throw new Error(data.error || "Generation failed (timeout or code error)");
            }
        } catch (e: any) {
            setStatus("error");
            setErrorMsg(e.message);
        }
    };

    useEffect(() => {
        generate();
        // eslint-disable-next-line
    }, []);

    if (status === "done") return null; // Unmounts and goes to main grid upon success

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-white border border-[var(--border)] rounded-xl aspect-[4/3] shadow-sm relative overflow-hidden">
            <span className="absolute top-2 left-2 px-2 py-1 bg-black/5 text-gray-500 rounded-md text-[10px] font-bold uppercase tracking-wider">
                {chartType.replace("_", " ")}
            </span>
            <button onClick={onCancel} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                <IconAlertCircle className="w-4 h-4 opacity-0" />
                <span className="text-xs font-bold px-2">Cancel</span>
            </button>
            
            {status === "loading" && (
                <div className="flex flex-col items-center gap-3 text-gray-800">
                    <IconLoader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-900 animate-pulse">Compiling Output...</span>
                </div>
            )}
            {status === "error" && (
                <div className="flex flex-col items-center gap-3 w-full">
                    <div className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                        <IconAlertCircle className="w-5 h-5" />
                    </div>
                    <p className="text-[10px] text-red-500 font-mono text-center line-clamp-3 w-full px-2 leading-relaxed">
                        {errorMsg}
                    </p>
                    <button onClick={generate} className="mt-2 px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-xs font-bold flex items-center gap-1.5">
                        <IconReload className="w-3.5 h-3.5" /> Try again
                    </button>
                </div>
            )}
        </div>
    );
}

export function AgentVisualizations({ topic, language, rImages, setRImages, sessionId, openEditor, onAddVisualsToReport }: Props) {
    const [selectedCharts, setSelectedCharts] = useState<string[]>(["bar"]);
    const [palette, setPalette] = useState("viridis");
    const [dataContext, setDataContext] = useState("");
    
    // Concurrency states
    const [generatingQueue, setGeneratingQueue] = useState<{ id: string, type: string }[]>([]);

    const toggleChart = (id: string) => {
        if (selectedCharts.includes(id)) setSelectedCharts(selectedCharts.filter(c => c !== id));
        else if (selectedCharts.length < 4) setSelectedCharts([...selectedCharts, id]);
    };

    const startGenerations = () => {
        if (!topic || selectedCharts.length === 0) return;
        const newJobs = selectedCharts.map(type => ({
            id: Math.random().toString(36).substring(7),
            type: type
        }));
        setGeneratingQueue([...generatingQueue, ...newJobs]);
    };

    const handleJobComplete = async (jobId: string, resultImg: RImage) => {
        setGeneratingQueue(prev => prev.filter(j => j.id !== jobId));
        const updatedImages = [...rImages, resultImg];
        setRImages(updatedImages);
        
        if (sessionId) {
            await fetch(`/api/agent/sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ r_images_json: updatedImages })
            });
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
                    <span className="w-6 h-6 rounded-full bg-[var(--foreground)] text-[var(--card)] flex items-center justify-center">
                        <IconPhotoPlus className="w-4 h-4" />
                    </span>
                    Add Visualizations (R Compiler)
                </h3>
                {rImages.length > 0 && generatingQueue.length === 0 && (
                    <button
                        onClick={() => onAddVisualsToReport(rImages)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 border border-gray-200 shadow-sm rounded-full text-xs font-bold hover:bg-gray-50 transition-colors"
                    >
                        <IconFileImport className="w-4 h-4" /> Add All to Report
                    </button>
                )}
            </div>

            {/* Controls */}
            <div className="space-y-5 mb-6">
                <div className="space-y-2">
                    <textarea 
                        value={dataContext}
                        onChange={e => setDataContext(e.target.value)}
                        placeholder="Data Context & Focus Area (Optional). e.g., Focus the bar chart on years 2020-2024..."
                        className="w-full h-12 bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 text-[13px] font-medium text-gray-700 outline-none focus:border-[var(--foreground)] resize-none placeholder:text-gray-400 focus:shadow-sm transition-all"
                    />
                </div>

                <div>
                    <div className="flex flex-wrap gap-2">
                        {CHART_TYPES.map(c => {
                            const active = selectedCharts.includes(c.id);
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => toggleChart(c.id)}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors border ${active ? 'bg-[var(--foreground)] text-[var(--card)] border-[var(--foreground)] shadow-sm' : 'bg-[#fbfbfc] text-gray-500 border-[#eaeaea] hover:border-gray-300'}`}
                                >
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block ml-1">Color Palette</label>
                        <select
                            value={palette}
                            onChange={(e) => setPalette(e.target.value)}
                            className="text-[13px] font-bold bg-[#fbfbfc] text-gray-700 border border-[#eaeaea] rounded-full px-4 py-1.5 outline-none cursor-pointer"
                        >
                            {PALETTES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={startGenerations}
                        disabled={selectedCharts.length === 0}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[var(--foreground)] text-[var(--card)] rounded-full text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                    >
                        <IconPhotoPlus className="w-4 h-4" /> Batch Generate Options
                    </button>
                </div>
            </div>

            {/* Grid of Results + Generating Loaders */}
            {(rImages.length > 0 || generatingQueue.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-6 border-t border-[var(--border)] bg-gray-50/30 rounded-xl p-4 mt-4">
                    
                    {/* Finished Images */}
                    {rImages.map((img, i) => (
                        <div key={i} className="group relative bg-white border border-[var(--border)] rounded-xl overflow-hidden hover:shadow-lg transition-all shadow-sm">
                            <img src={`data:image/png;base64,${img.image}`} alt={img.chart_type} className="w-full aspect-square object-cover bg-white" />

                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                                <button
                                    onClick={() => openEditor(i)}
                                    className="px-5 py-2.5 bg-white text-black rounded-full text-xs font-bold flex items-center gap-2 hover:bg-gray-100 transition-colors shadow-lg hover:scale-105 active:scale-95"
                                >
                                    <IconCode className="w-4 h-4 text-black" /> AI Edit Code
                                </button>
                                <button
                                    onClick={() => downloadImage(img.image, `fig_${i + 1}_${img.chart_type}`)}
                                    className="px-5 py-2.5 bg-black/40 border border-white/30 text-white rounded-full text-xs font-bold flex items-center gap-2 hover:bg-black/60 transition-colors hover:scale-105 active:scale-95"
                                >
                                    <IconDownload className="w-4 h-4" /> Download PNG
                                </button>
                            </div>

                            <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 text-gray-900 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm border border-gray-100">
                                {img.chart_type.replace("_", " ")}
                            </div>
                        </div>
                    ))}

                    {/* Pending Jobs */}
                    {generatingQueue.map(job => (
                        <GeneratingCard 
                            key={job.id} 
                            chartType={job.type} 
                            topic={topic}
                            palette={palette}
                            language={language}
                            dataContext={dataContext}
                            onComplete={(img: RImage) => handleJobComplete(job.id, img)}
                            onCancel={() => setGeneratingQueue(prev => prev.filter(j => j.id !== job.id))}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
