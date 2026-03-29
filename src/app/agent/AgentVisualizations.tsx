import { useState } from "react";
import { IconPhotoPlus, IconLoader2, IconCode, IconDownload } from "@tabler/icons-react";
import { RImage, Language } from "./types";

interface Props {
    topic: string;
    language: Language;
    rImages: RImage[];
    setRImages: (v: RImage[] | ((prev: RImage[]) => RImage[])) => void;
    sessionId: string | null;
    openEditor: (index: number) => void;
}

const CHART_TYPES = [
    { id: "bar", label: "Bar Chart" },
    { id: "line", label: "Line Chart" },
    { id: "scatter", label: "Scatter Plot" },
    { id: "heatmap", label: "Heatmap" },
    { id: "3d_surface", label: "3D Surface" },
    { id: "network", label: "Network Graph" },
    { id: "pie", label: "Pie Chart" },
    { id: "boxplot", label: "Boxplot" },
];

const PALETTES = [
    { id: "viridis", label: "Viridis" },
    { id: "Spectral", label: "Spectral" },
    { id: "Blues", label: "Blues" },
    { id: "Dark2", label: "Dark2" },
    { id: "Set1", label: "Set1" },
];

export function AgentVisualizations({ topic, language, rImages, setRImages, sessionId, openEditor }: Props) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedCharts, setSelectedCharts] = useState<string[]>(["bar"]);
    const [palette, setPalette] = useState("viridis");
    const [error, setError] = useState<string | null>(null);

    const toggleChart = (id: string) => {
        if (selectedCharts.includes(id)) {
            setSelectedCharts(selectedCharts.filter(c => c !== id));
        } else {
            if (selectedCharts.length >= 4) return; // max 4 at once
            setSelectedCharts([...selectedCharts, id]);
        }
    };

    const generateImages = async () => {
        if (!topic) return;
        setIsGenerating(true);
        setError(null);

        const newImages: RImage[] = [];

        try {
            for (const chartType of selectedCharts) {
                const res = await fetch('/api/agent/visualize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topic, chartType, palette, language })
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.error || `Failed to generate ${chartType}`);
                }

                const data = await res.json();
                if (data.success && data.image) {
                    newImages.push({
                        image: data.image,
                        chart_type: data.chart_type,
                        r_code: data.r_code
                    });
                }
            }

            if (newImages.length > 0) {
                const updatedImages = [...rImages, ...newImages];
                setRImages(updatedImages);

                if (sessionId) {
                    // Update session
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
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                    <IconPhotoPlus className="w-4 h-4" />
                </span>
                Add Visualizations (R Compiler)
            </h3>

            {/* Controls */}
            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Chart Types (max 4)</label>
                    <div className="flex flex-wrap gap-2">
                        {CHART_TYPES.map(c => {
                            const active = selectedCharts.includes(c.id);
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => toggleChart(c.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${active ? 'bg-[var(--foreground)] text-[var(--card)] border-[var(--foreground)]' : 'bg-transparent text-gray-500 border-[var(--border)] hover:border-gray-400'}`}
                                >
                                    {c.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Palette</label>
                        <select
                            value={palette}
                            onChange={(e) => setPalette(e.target.value)}
                            className="text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg px-2 py-1 outline-none"
                        >
                            {PALETTES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={generateImages}
                        disabled={isGenerating || selectedCharts.length === 0}
                        className="mt-6 flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-full text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                        {isGenerating ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconPhotoPlus className="w-4 h-4" />}
                        Generate Images
                    </button>
                </div>
                {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            {/* Generated Images Grid */}
            {rImages.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-[var(--border)]">
                    {rImages.map((img, i) => (
                        <div key={i} className="group relative bg-[var(--background)] border border-[var(--border)] rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                            <img src={`data:image/png;base64,${img.image}`} alt={img.chart_type} className="w-full aspect-[4/3] object-cover" />

                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                <button
                                    onClick={() => openEditor(i)}
                                    className="px-4 py-2 bg-white text-black rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-gray-200 transition-colors"
                                >
                                    <IconCode className="w-4 h-4" /> Edit Code
                                </button>
                                <button
                                    onClick={() => downloadImage(img.image, `fig_${i + 1}_${img.chart_type}`)}
                                    className="px-4 py-2 bg-transparent border border-white text-white rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-white/20 transition-colors"
                                >
                                    <IconDownload className="w-4 h-4" /> Download PNG
                                </button>
                            </div>

                            <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-white rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                                {img.chart_type.replace("_", " ")}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
