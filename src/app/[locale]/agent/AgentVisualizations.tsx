import { useState, useEffect } from "react";
import { IconPhotoPlus, IconLoader2, IconCode, IconDownload, IconFileImport, IconReload, IconAlertCircle, IconWand, IconTrash, IconX, IconLock } from "@tabler/icons-react";
import { CodeImage, Language } from "./types";
import { IconBrandPython, IconLetterR } from "@tabler/icons-react";
import { useAdmin } from "@/components/AdminContext";

interface Props {
    topic: string;
    language: Language;
    visuals: CodeImage[];
    setVisuals: (v: CodeImage[] | ((prev: CodeImage[]) => CodeImage[])) => void;
    sessionId: string | null;
    openEditor: (index: number) => void;
    onAddVisualsToReport: (images: CodeImage[]) => void;
    runtime: 'R' | 'Python';
    setRuntime: (r: 'R' | 'Python') => void;
    onQuotaExceeded?: () => void;
}

const CHART_TYPES = [
    // Basic Geometry
    { id: "bar", label: "Bar Chart", desc: "Best for comparing numerical values across discrete categories." },
    { id: "line", label: "Line Chart", desc: "Shows trends or changes in data over continuous time intervals." },
    { id: "scatter", label: "Scatter Plot", desc: "Displays relationship and correlation between two numerical variables." },
    { id: "bubble", label: "Bubble Chart", desc: "A scatter plot that adds a third dimension through bubble size." },
    { id: "lollipop", label: "Lollipop Chart", desc: "A minimalist alternative to bar charts that reduces visual clutter." },
    
    // Distributions
    { id: "histogram", label: "Histogram", desc: "Visualizes the distribution of a single continuous variable." },
    { id: "density2d", label: "2D Density", desc: "Shows concentrations of data points as contour maps." },
    { id: "ridge", label: "Density Ridge", desc: "Compares distributions of multiple groups elegantly on the same axis." },
    { id: "boxplot", label: "Boxplot", desc: "Shows statistical distribution, median, quartiles, and outliers." },
    { id: "violin", label: "Violin Plot", desc: "Combines a boxplot with a density trace to reveal hidden distributions." },
    { id: "joyplot", label: "Joyplot", desc: "Staggered, overlapping density plots for comparing distributions across categories." },
    { id: "kdensity", label: "K-Density", desc: "Kernel Density Estimate for smooth distribution curves." },
    
    // Relationships & Matrices
    { id: "heatmap", label: "Heatmap", desc: "Matrix representation of relationships or correlations using color intensity." },
    { id: "marginal", label: "Marginal Scatter", desc: "A scatter plot enhanced with density curves on the edges." },
    { id: "hexbin", label: "Hexbin Density", desc: "Aggregates dense scatter plots into colored hexagonal bins." },
    { id: "pairplot", label: "Pairplot", desc: "Matrix of basic scatter plots mapping all variable pairs in a dataset." },
    { id: "qqplot", label: "Q-Q Plot", desc: "Quantile-Quantile plot comparing two probability distributions." },
    
    // Proportions & Hierarchy
    { id: "pie", label: "Pie Chart", desc: "Shows proportional contributions of categories to a whole." },
    { id: "rose", label: "Nightingale Rose", desc: "A polar bar chart, great for cyclical or temporal data." },
    { id: "treemap", label: "Treemap", desc: "Displays hierarchical data as nested rectangles proportional to value." },
    { id: "circlepack", label: "Circle Packing", desc: "A beautiful alternative to treemaps using nested circles." },
    { id: "sunburst", label: "Sunburst", desc: "Shows hierarchical data radially across multiple nested rings." },
    { id: "waffle", label: "Waffle Chart", desc: "Shows composition using a square grid, an elegant alternative to pie charts." },
    { id: "dendrogram", label: "Dendrogram", desc: "Tree diagram showing hierarchical clustering and taxonomy." },
    
    // Advanced & Specialized
    { id: "radar", label: "Radar Chart", desc: "Compares multiple quantitative variables on a radial grid." },
    { id: "network", label: "Network Graph", desc: "Visualizes nodes and complex relationships/edges between them." },
    { id: "sankey", label: "Sankey Diagram", desc: "Shows flow, transfers, and transitions between different states." },
    { id: "chord", label: "Chord Diagram", desc: "Visualizes inter-relationships and flows arranged in a circle." },
    { id: "parallel", label: "Parallel Coords", desc: "Analyzes multivariate data across multiple parallel axes." },
    { id: "waterfall", label: "Waterfall", desc: "Illustrates cumulative effect of sequentially introduced positive or negative values." },
    { id: "dumbbell", label: "Dumbbell Plot", desc: "Highlights the difference or expected change between two points." },
    { id: "volcano", label: "Volcano Plot", desc: "Scatter plot often used to identify meaningful changes in large datasets like genomics." },
    { id: "survival", label: "Survival Curve", desc: "Kaplan-Meier survival curves analyzing time until an event occurs." },
    
    // Word & Maps
    { id: "wordcloud", label: "Wordcloud", desc: "Visual representation of text data, sized proportionally to frequency." },
    { id: "choropleth", label: "Choropleth Map", desc: "Geographical map colored in relation to a data variable." },
    { id: "bubble_map", label: "Bubble Map", desc: "Map using proportionally sized bubbles to display data by location." },
    
    // AI & Machine Learning
    { id: "pca", label: "PCA Plot", desc: "Principal Component Analysis plotting to visualize high-dimensional variance." },
    { id: "kmeans", label: "K-Means Cluster", desc: "Visualizes clustering of data points into distinct categorical groups." },
    { id: "roc", label: "ROC Curve", desc: "Illustrates the diagnostic ability of a binary classifier system." },
    { id: "regression", label: "Regression", desc: "Scatter plot overlayed with a linear or loess regression fit and confidence interval." },
    { id: "arima", label: "ARIMA Forecast", desc: "Time series forecasting showing predicted values and confidence bounds." },
    
    // 3D
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

// Sub-component for generating a single visualization
function GeneratingCard({ chartType, topic, palette, language, dataContext, onComplete, onCancel, onFail, isActive, runtime, onQuotaExceeded }: any) {
    const [status, setStatus] = useState<"pending" | "generating" | "error" | "done">("pending");
    const [errorMsg, setErrorMsg] = useState("");
    const [failedCode, setFailedCode] = useState("");

    const generate = async (isRetry = false) => {
        setStatus("generating");
        setErrorMsg("");

        try {
            const reqBody: any = { 
                topic, chartType, palette, language, dataContext, 
                action: "generate", runtime 
            };
            
            // On retry, pass the error and previous code so AI can self-correct
            if (isRetry && errorMsg && failedCode) {
                reqBody.previousError = errorMsg;
                reqBody.previousCode = failedCode;
            }

            const res = await fetch('/api/agent/visualize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });
            
            const data = await res.json();

            if (res.ok && data.success && data.image) {
                setStatus("done");
                onComplete({
                    image: data.image,
                    chart_type: data.chart_type,
                    code: data.code,
                    language: runtime
                });
            } else {
                setFailedCode(data.code || "");
                if (res.status === 402 && onQuotaExceeded) {
                    onQuotaExceeded();
                    throw new Error("Quota exceeded! Please buy tokens.");
                }
                throw new Error(data.error || `${runtime} visualization failed`);
            }
        } catch (e: any) {
            console.error(e);
            setStatus("error");
            setErrorMsg(e.message);
            onFail();
        }
    };

    useEffect(() => {
        if (isActive && status === "pending") {
            generate();
        }
    }, [isActive, status]);

    if (status === "done") return null;

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-2xl aspect-[4/3] shadow-sm relative overflow-hidden transition-all duration-300">
            <span className="absolute top-3 left-3 px-2 py-1 bg-black text-white rounded text-[9px] font-black uppercase tracking-widest z-10">
                {chartType.replace("_", " ")}
            </span>
            <button onClick={onCancel} className="absolute top-3 right-3 text-gray-300 hover:text-black z-10 transition-colors">
                <IconX className="w-4 h-4" />
            </button>
            
            {status === "pending" && (
                <div className="flex flex-col items-center gap-4 text-gray-300">
                    <IconLoader2 className="w-6 h-6 animate-spin opacity-20" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Queued</span>
                </div>
            )}
            
            {status === "generating" && (
                <div className="flex flex-col items-center gap-5">
                    {/* Animated dots */}
                    <div className="flex items-center gap-1.5">
                        {[0, 1, 2, 3, 4].map(i => (
                            <div 
                                key={i} 
                                className="w-2 h-2 bg-black rounded-full animate-bounce" 
                                style={{ animationDelay: `${i * 0.12}s`, animationDuration: '0.8s' }}
                            />
                        ))}
                    </div>
                    <div className="text-center">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black block">Generating</span>
                        <span className="text-[9px] text-gray-300 mt-1 block">{runtime} • {chartType.replace("_", " ")}</span>
                    </div>
                </div>
            )}

            {status === "error" && (
                <div className="flex flex-col items-center gap-4 w-full p-4 text-center">
                    <IconAlertCircle className="w-6 h-6 text-black opacity-20" />
                    <p className="text-[10px] text-gray-400 font-medium leading-relaxed max-h-20 overflow-y-auto w-full px-2">
                        {errorMsg}
                    </p>
                    <button onClick={() => generate(true)} className="mt-2 px-5 py-2 bg-black text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#333] transition-all">
                        Retry
                    </button>
                </div>
            )}
        </div>
    );
}

export function AgentVisualizations({ topic, language, visuals, setVisuals, sessionId, openEditor, onAddVisualsToReport, runtime, setRuntime, onQuotaExceeded }: Props) {
    const { user } = useAdmin();
    const [selectedCharts, setSelectedCharts] = useState<string[]>(["bar"]);
    const [palette, setPalette] = useState("viridis");
    const [dataContext, setDataContext] = useState("");
    
    // Concurrency states
    const [generatingQueue, setGeneratingQueue] = useState<{ id: string, type: string, isActive: boolean, isFailed: boolean }[]>([]);
    const [isSuggesting, setIsSuggesting] = useState(false);

    useEffect(() => {
        // Process queue in parallel up to 3 jobs at once
        const activeCount = generatingQueue.filter(j => j.isActive).length;
        if (activeCount < 3) {
            const pendingJobs = generatingQueue.filter(j => !j.isActive && !j.isFailed);
            if (pendingJobs.length > 0) {
                const jobsToStart = pendingJobs.slice(0, 3 - activeCount).map(j => j.id);
                setGeneratingQueue(prev => prev.map(j => 
                    jobsToStart.includes(j.id) ? { ...j, isActive: true } : j
                ));
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

    const handleJobComplete = async (jobId: string, resultImg: CodeImage) => {
        setGeneratingQueue(prev => prev.filter(j => j.id !== jobId));
        const updatedImages = [...visuals, resultImg];
        setVisuals(updatedImages);
        
        if (sessionId) {
            await fetch(`/api/agent/sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visuals_json: updatedImages })
            });
        }
    };

    const downloadImage = (base64: string, name: string) => {
        const a = document.createElement("a");
        a.href = `data:image/png;base64,${base64}`;
        a.download = `${name}.png`;
        a.click();
    };

    const handleDeleteImage = async (index: number) => {
        if (!confirm("Delete this visualization?")) return;
        const newArr = visuals.filter((_, i) => i !== index);
        setVisuals(newArr);
        if (sessionId) {
            await fetch(`/api/agent/sessions/${sessionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visuals_json: newArr })
            });
        }
    };

    return (
        <div className="w-full mt-12 p-8 bg-white border border-gray-100 rounded-[32px] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <h3 className="text-sm font-black flex items-center gap-3 uppercase tracking-[0.2em] text-gray-400">
                    <IconPhotoPlus className="w-5 h-5 text-black" stroke={2} />
                    Visual Component
                </h3>
                {visuals.length > 0 && generatingQueue.length === 0 && (
                    <button
                        onClick={() => onAddVisualsToReport(visuals)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#222] transition-all shadow-xl hover:scale-[1.02]"
                    >
                        <IconFileImport className="w-4 h-4" /> Add All to Report
                    </button>
                )}
            </div>

            {/* Controls */}
            <div className="space-y-8 mb-8">
                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-300 ml-1">Analysis Focus</label>
                    <textarea 
                        value={dataContext}
                        onChange={e => setDataContext(e.target.value)}
                        placeholder="E.g., Compare growth rates across regions B and C..."
                        className="w-full h-16 bg-[#FBFBFC] border border-gray-50 rounded-2xl px-5 py-4 text-[13px] font-bold text-black outline-none focus:bg-white focus:border-black resize-none placeholder:text-gray-200 transition-all shadow-none focus:shadow-sm"
                    />
                </div>

                <div>
                    <div className="flex flex-wrap gap-2">
                        {CHART_TYPES.map((c: any) => {
                            const active = selectedCharts.includes(c.id);
                            const isPremium = !["bar", "line", "scatter", "histogram", "pie"].includes(c.id);
                            const isLocked = isPremium && (!user?.plan_tier || user.plan_tier.toLowerCase() === "free");
                            return (
                                <div key={c.id} className="relative group">
                                    <button
                                        onClick={() => !isLocked && toggleChart(c.id)}
                                        disabled={isLocked}
                                        className={`px-4 py-2 flex items-center gap-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isLocked ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50' : active ? 'bg-black text-white border-black shadow-lg z-20' : 'bg-white text-gray-300 border-gray-100 hover:border-gray-300 z-10'}`}
                                    >
                                        {isLocked && <IconLock className="w-3" />}
                                        {c.label}
                                    </button>
                                    
                                    {/* Hover Popover Preview */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl pointer-events-none p-3 translate-y-2 group-hover:translate-y-0">
                                        <div className="w-full aspect-[4/3] bg-gray-50 rounded-xl overflow-hidden mb-3 border border-gray-100 flex items-center justify-center relative">
                                            <img 
                                                src={`/previews/${c.id}.png`} 
                                                alt={c.label} 
                                                className="w-full h-full object-cover block"
                                                onError={(e) => { 
                                                    e.currentTarget.style.display = 'none'; 
                                                    const textElem = e.currentTarget.nextElementSibling;
                                                    if (textElem) textElem.classList.remove('hidden');
                                                }} 
                                            />
                                            <span className="hidden text-[9px] text-gray-300 font-bold uppercase tracking-widest text-center px-4">
                                                No Preview Image
                                            </span>
                                        </div>
                                        <p className="text-[10px] leading-relaxed font-medium text-gray-400">
                                            {c.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-6">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em] block ml-1">Environment</label>
                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                                <button 
                                    disabled={['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free')}
                                    onClick={() => setRuntime('R')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                        ['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free')
                                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-50'
                                            : runtime === 'R' ? 'bg-white text-black shadow-sm' : 'text-gray-300 hover:text-gray-400'
                                    }`}
                                >
                                    {['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free') && <IconLock className="w-3.5 h-3.5" />}
                                    {!['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free') && <IconLetterR className="w-3.5 h-3.5" stroke={3} />}
                                    R
                                </button>
                                <button 
                                    onClick={() => setRuntime('Python')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${runtime === 'Python' ? 'bg-white text-black shadow-sm' : 'text-gray-300 hover:text-gray-400'}`}
                                >
                                    <IconBrandPython className="w-3.5 h-3.5" />
                                    Python
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em] block ml-1">Model</label>
                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                                <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-white text-black shadow-sm">
                                    <IconWand className="w-3.5 h-3.5" />
                                    GPT-5 Mini
                                </button>
                                <button 
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-gray-50 text-gray-300 cursor-not-allowed opacity-50"
                                >
                                    <IconLock className="w-3.5 h-3.5" />
                                    Grok 4.1 Flash
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em] block ml-1">Palette</label>
                            <select
                                value={palette}
                                onChange={(e) => setPalette(e.target.value)}
                                className="text-[11px] font-black bg-white text-black border border-gray-100 rounded-xl px-3 py-1.5 outline-none cursor-pointer hover:border-black transition-colors uppercase tracking-widest h-[34px]"
                            >
                                {PALETTES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleAutoSuggest}
                            disabled={isSuggesting || !topic}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white text-black border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-black transition-all disabled:opacity-30"
                        >
                            {isSuggesting ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconWand className="w-4 h-4" />}
                            Suggest
                        </button>
                        
                        <button
                            onClick={startGenerations}
                            disabled={selectedCharts.length === 0}
                            className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1A1A1A] transition-all disabled:opacity-5 shadow-2xl hover:scale-[1.02] active:scale-95"
                        >
                            <IconPhotoPlus className="w-4 h-4" /> Generate Options
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid of Results + Generating Loaders */}
            {(visuals.length > 0 || generatingQueue.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-8 border-t border-gray-50">
                    
                    {/* Finished Images */}
                    {visuals.map((img, i) => (
                        <div key={i} className="group relative bg-white border border-gray-100 rounded-3xl overflow-hidden hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)] transition-all shadow-[0_4px_12px_-4px_rgba(0,0,0,0.02)]">
                            <img src={`data:image/png;base64,${img.image}`} alt={img.chart_type} className="w-full aspect-square object-cover" />

                            <div className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-4 backdrop-blur-md p-6">
                                <button
                                    onClick={() => {
                                        if (['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free')) return;
                                        openEditor(i);
                                    }}
                                    disabled={['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free')}
                                    className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${
                                        ['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free')
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-75 border border-gray-200'
                                            : 'bg-black text-white hover:bg-[#222] shadow-xl hover:scale-105 active:scale-95'
                                    }`}
                                >
                                    {['free', 'plus'].includes(user?.plan_tier?.toLowerCase() || 'free') ? <IconLock className="w-4 h-4" /> : <IconCode className="w-4 h-4" />}
                                     AI Edit Code
                                </button>
                                <button
                                    onClick={() => downloadImage(img.image, `fig_${i + 1}_${img.chart_type}`)}
                                    className="w-full py-3 bg-white text-black border border-black rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-gray-50 transition-all hover:scale-105 active:scale-95"
                                >
                                    <IconDownload className="w-4 h-4" /> Save PNG
                                </button>
                            </div>

                            <div className="absolute top-4 left-4 flex gap-2">
                                <span className="px-2 py-1 bg-black text-white rounded text-[8px] font-black uppercase tracking-widest shadow-sm">
                                    {(img.chart_type || (img as any).chartType || 'chart').replace("_", " ")}
                                </span>
                            </div>
                            
                            <button
                                onClick={() => handleDeleteImage(i)}
                                className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-black transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <IconTrash className="w-4 h-4" />
                            </button>
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
                            onComplete={(img: CodeImage) => handleJobComplete(job.id, img)}
                            onFail={(status?: number) => {
                                if (status === 402) onQuotaExceeded?.();
                                setGeneratingQueue(q => q.map(i => i.id === job.id ? { ...i, isFailed: true, isActive: false } : i));
                            }}
                            onCancel={() => setGeneratingQueue(prev => prev.filter(j => j.id !== job.id))}
                            runtime={runtime}
                            onQuotaExceeded={onQuotaExceeded}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
