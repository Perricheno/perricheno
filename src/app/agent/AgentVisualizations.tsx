import { useState, useEffect, useRef } from "react";
import { IconPhotoPlus, IconLoader2, IconCode, IconDownload, IconFileImport, IconReload, IconAlertCircle, IconWand } from "@tabler/icons-react";
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
    { id: "bar", label: "Bar Chart", desc: "Best for comparing numerical values across discrete categories." },
    { id: "line", label: "Line Chart", desc: "Shows trends or changes in data over continuous time intervals." },
    { id: "scatter", label: "Scatter Plot", desc: "Displays relationship and correlation between two numerical variables." },
    { id: "bubble", label: "Bubble Chart", desc: "A scatter plot that adds a third dimension through bubble size." },
    { id: "lollipop", label: "Lollipop Chart", desc: "A minimalist alternative to bar charts that reduces visual clutter." },
    { id: "histogram", label: "Histogram", desc: "Visualizes the distribution of a single continuous variable." },
    { id: "density2d", label: "2D Density", desc: "Shows concentrations of data points as contour maps." },
    { id: "ridge", label: "Density Ridge", desc: "Compares distributions of multiple groups elegantly on the same axis." },
    { id: "boxplot", label: "Boxplot", desc: "Shows statistical distribution, median, quartiles, and outliers." },
    { id: "violin", label: "Violin Plot", desc: "Combines a boxplot with a density trace to reveal hidden distributions." },
    { id: "heatmap", label: "Heatmap", desc: "Matrix representation of relationships or correlations using color intensity." },
    { id: "marginal", label: "Marginal Scatter", desc: "A scatter plot enhanced with density curves on the edges." },
    { id: "hexbin", label: "Hexbin Density", desc: "Aggregates dense scatter plots into colored hexagonal bins." },
    { id: "pie", label: "Pie Chart", desc: "Shows proportional contributions of categories to a whole." },
    { id: "rose", label: "Nightingale Rose", desc: "A polar bar chart, great for cyclical or temporal data." },
    { id: "treemap", label: "Treemap", desc: "Displays hierarchical data as nested rectangles proportional to value." },
    { id: "circlepack", label: "Circle Packing", desc: "A beautiful alternative to treemaps using nested circles." },
    { id: "radar", label: "Radar Chart", desc: "Compares multiple quantitative variables on a radial grid." },
    { id: "network", label: "Network Graph", desc: "Visualizes nodes and complex relationships/edges between them." },
    { id: "sankey", label: "Sankey Diagram", desc: "Shows flow, transfers, and transitions between different states." },
    { id: "chord", label: "Chord Diagram", desc: "Visualizes inter-relationships and flows arranged in a circle." },
    { id: "dendrogram", label: "Dendrogram", desc: "Tree diagram showing hierarchical clustering and taxonomy." },
    { id: "parallel", label: "Parallel Coords", desc: "Analyzes multivariate data across multiple parallel axes." },
    { id: "waffle", label: "Waffle Chart", desc: "Shows composition using a square grid, an elegant alternative to pie charts." },
    { id: "waterfall", label: "Waterfall", desc: "Illustrates cumulative effect of sequentially introduced positive or negative values." },
    { id: "wordcloud", label: "Wordcloud", desc: "Visual representation of text data, sized proportionally to frequency." },
    { id: "dumbbell", label: "Dumbbell Plot", desc: "Highlights the difference or expected change between two points." },
    { id: "gantt", label: "Gantt Chart", desc: "Bar chart that illustrates a project schedule or timeline." },
    { id: "3d_surface", label: "3D Surface", desc: "Plots topological data structures on three continuous axes." },
    { id: "3d_scatter", label: "3D Scatter", desc: "Plots individual points in a three-dimensional coordinate system." },
];

const PALETTES = [
    { id: "viridis", label: "Viridis" },
    { id: "Spectral", label: "Spectral" },
    { id: "Blues", label: "Blues" },
    { id: "Dark2", label: "Dark2" },
    { id: "Set1", label: "Set1" },
];

// Sub-component for parallel/sequential loading
function GeneratingCard({ chartType, topic, palette, language, dataContext, onComplete, onCancel, onFail, isActive }: any) {
    const [status, setStatus] = useState<"pending" | "streaming" | "compiling" | "error" | "done">("pending");
    const [errorMsg, setErrorMsg] = useState("");
    const [code, setCode] = useState("");
    const codeRef = useRef<HTMLPreElement>(null);

    // Auto-scroll code
    useEffect(() => {
        if (codeRef.current) codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }, [code]);

    const generate = async () => {
        setStatus("streaming");
        setCode("");
        try {
            // STEP 1: Stream Code
            const resStream = await fetch('/api/agent/visualize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, chartType, palette, language, dataContext, action: "stream" })
            });
            
            if (!resStream.ok) throw new Error("Stream connection failed");
            if (!resStream.body) throw new Error("No response body");

            const reader = resStream.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let finalCode = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                let boundary = buffer.indexOf("\n\n");
                
                while (boundary !== -1) {
                    const message = buffer.slice(0, boundary).trim();
                    buffer = buffer.slice(boundary + 2);

                    if (message.startsWith("data: ") && message !== "data: [DONE]") {
                        try {
                            const dataStr = message.slice(6);
                            const jsonObj = JSON.parse(dataStr);
                            const token = jsonObj.choices[0]?.delta?.content || "";
                            finalCode += token;
                            setCode(finalCode);
                        } catch (e) {}
                    }
                    boundary = buffer.indexOf("\n\n");
                }
            }

            // Clean code if needed
            let cleanCode = finalCode.trim();
            if (cleanCode.startsWith("```")) cleanCode = cleanCode.replace(/^```(?:r|R)?\s*/, "");
            if (cleanCode.endsWith("```")) cleanCode = cleanCode.replace(/```\s*$/, "");

            // STEP 2: Compile Code
            setStatus("compiling");
            const resCompile = await fetch('/api/agent/visualize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chartType, action: "compile", rCode: cleanCode })
            });

            const data = await resCompile.json();
            if (resCompile.ok && data.success && data.image) {
                setStatus("done");
                onComplete({
                    image: data.image,
                    chart_type: data.chart_type,
                    r_code: data.r_code
                });
            } else {
                throw new Error(data.error || "R Compilation failed (syntax error or timeout)");
            }

        } catch (e: any) {
            console.error(e);
            setStatus("error");
            setErrorMsg(e.message);
            onFail(); // Signal the parent to continue to the next job in queue
        }
    };

    useEffect(() => {
        if (isActive && status === "pending") {
            generate();
        }
    }, [isActive, status]);

    if (status === "done") return null;

    return (
        <div className={`flex flex-col items-center justify-center ${status === "streaming" ? "p-3 pt-10" : "p-6"} bg-white border border-[var(--border)] rounded-xl aspect-[4/3] shadow-sm relative overflow-hidden transition-all duration-300`}>
            <span className="absolute top-2 left-2 px-2 py-1 bg-black/5 text-gray-500 rounded-md text-[10px] font-bold uppercase tracking-wider z-10 shadow-sm backdrop-blur-md">
                {chartType.replace("_", " ")}
            </span>
            <button onClick={onCancel} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 z-10 bg-white/50 backdrop-blur rounded p-0.5">
                <IconAlertCircle className="w-4 h-4 opacity-0" />
                <span className="text-xs font-bold px-2">Cancel</span>
            </button>
            
            {status === "pending" && (
                <div className="flex flex-col items-center gap-3 text-gray-400">
                    <IconLoader2 className="w-8 h-8 opacity-50" />
                    <span className="text-xs font-bold uppercase tracking-widest">Waiting in queue...</span>
                </div>
            )}
            
            {status === "streaming" && (
                <div className="w-full h-full flex flex-col bg-gray-50/50 rounded-lg p-3 overflow-hidden text-left relative border border-gray-100 shadow-inner">
                    <span className="text-[9px] text-gray-400 font-mono font-bold mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse block"></span>
                        AI Writing Script...
                    </span>
                    <pre ref={codeRef} className="text-[9px] text-gray-700 font-mono overflow-y-auto w-full flex-1 whitespace-pre-wrap leading-relaxed outline-none scrollbar-hide pb-4">
                        {code}
                    </pre>
                </div>
            )}

            {status === "compiling" && (
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
                    <div className="text-[10px] text-red-500 font-mono text-left max-h-16 overflow-y-auto w-full px-2 leading-relaxed whitespace-pre-wrap break-all border-t border-red-100 pt-2">
                        {errorMsg}
                    </div>
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
    const [generatingQueue, setGeneratingQueue] = useState<{ id: string, type: string, isActive: boolean, isFailed: boolean }[]>([]);
    const [isSuggesting, setIsSuggesting] = useState(false);

    useEffect(() => {
        // Process queue sequentially
        const activeJob = generatingQueue.find(j => j.isActive);
        if (!activeJob) {
            const nextPending = generatingQueue.find(j => !j.isActive && !j.isFailed);
            if (nextPending) {
                setGeneratingQueue(prev => prev.map(j => j.id === nextPending.id ? { ...j, isActive: true } : j));
            }
        }
    }, [generatingQueue]);

    const handleAutoSuggest = async () => {
        if (!topic) return;
        setIsSuggesting(true);
        try {
            const res = await fetch('/api/agent/visualize/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    topic, 
                    dataContext, 
                    availableTypes: CHART_TYPES.map(c => c.id) 
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.recommended && Array.isArray(data.recommended)) {
                    // Filter to actually existing charts to be safe
                    const validIds = data.recommended.filter((id: string) => CHART_TYPES.some(c => c.id === id));
                    if (validIds.length > 0) setSelectedCharts(validIds.slice(0, 4));
                }
            }
        } catch (e) {
            console.error("Failed to suggest charts", e);
        } finally {
            setIsSuggesting(false);
        }
    };

    const toggleChart = (id: string) => {
        if (selectedCharts.includes(id)) setSelectedCharts(selectedCharts.filter(c => c !== id));
        else setSelectedCharts([...selectedCharts, id]);
    };

    const startGenerations = () => {
        if (!topic || selectedCharts.length === 0) return;
        const newJobs = selectedCharts.map(type => ({
            id: Math.random().toString(36).substring(7),
            type: type,
            isActive: false,
            isFailed: false
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
                        {CHART_TYPES.map((c: any) => {
                            const active = selectedCharts.includes(c.id);
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => toggleChart(c.id)}
                                    className={`relative group/btn hover:z-50 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors border ${active ? 'bg-[var(--foreground)] text-[var(--card)] border-[var(--foreground)] shadow-sm z-20' : 'bg-[#fbfbfc] text-gray-500 border-[#eaeaea] hover:border-gray-300 z-10'}`}
                                >
                                    {c.label}
                                    
                                    {/* Tooltip Hover Box */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white border border-gray-200 shadow-2xl rounded-xl p-2.5 hidden group-hover/btn:block z-[100] cursor-default pointer-events-none text-left opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200">
                                        <div className="w-full aspect-[4/3] bg-gray-50 overflow-hidden rounded-lg border border-gray-100 mb-2 flex items-center justify-center">
                                            {/* Using a placeholder service. Users can swap with local /previews/id.png later */}
                                            <img src={`https://placehold.co/400x300/f8f9fc/a1a1aa.png?text=${encodeURIComponent(c.label)}\nPreview`} alt={c.label} className="w-full h-full object-cover" />
                                        </div>
                                        <p className="text-[10px] text-gray-600 font-medium leading-relaxed normal-case tracking-normal">
                                            {c.desc}
                                        </p>
                                    </div>
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

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleAutoSuggest}
                            disabled={isSuggesting || !topic}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 border border-gray-200 shadow-sm rounded-full text-xs font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            {isSuggesting ? <IconLoader2 className="w-4 h-4 animate-spin text-gray-400" /> : <IconWand className="w-4 h-4 text-gray-500" />}
                            Auto-Suggest
                        </button>
                        
                        <button
                            onClick={startGenerations}
                            disabled={selectedCharts.length === 0}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--foreground)] text-[var(--card)] rounded-full text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                        >
                            <IconPhotoPlus className="w-4 h-4" /> Batch Generate Options
                        </button>
                    </div>
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
                            isActive={job.isActive}
                            onComplete={(img: RImage) => handleJobComplete(job.id, img)}
                            onFail={() => setGeneratingQueue(prev => prev.map(j => j.id === job.id ? { ...j, isActive: false, isFailed: true } : j))}
                            onCancel={() => setGeneratingQueue(prev => prev.filter(j => j.id !== job.id))}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
