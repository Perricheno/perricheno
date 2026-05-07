export interface ChartEntry {
    id: string;
    name: string;
    tag: string;
    preview: string;
}

export const CHARTS: ChartEntry[] = [
    { id: "violin",            name: "Violin",           tag: "Distribution",  preview: "" },
    { id: "density",           name: "Density",          tag: "Distribution",  preview: "" },
    { id: "histogram",         name: "Histogram",        tag: "Distribution",  preview: "" },
    { id: "boxplot",           name: "Box Plot",         tag: "Distribution",  preview: "" },
    { id: "ridgeline",         name: "Ridgeline",        tag: "Distribution",  preview: "" },
    { id: "beeswarm",          name: "Beeswarm",         tag: "Distribution",  preview: "" },
    { id: "scatter",           name: "Scatter",          tag: "Correlation",   preview: "" },
    { id: "heatmap",           name: "Heatmap",          tag: "Correlation",   preview: "" },
    { id: "correlogram",       name: "Correlogram",      tag: "Correlation",   preview: "" },
    { id: "bubble",            name: "Bubble",           tag: "Correlation",   preview: "" },
    { id: "connected_scatter", name: "Connected Scatter",tag: "Correlation",   preview: "" },
    { id: "density2d",         name: "2D Density",       tag: "Correlation",   preview: "" },
    { id: "marginal",          name: "Marginal",         tag: "Correlation",   preview: "" },
    { id: "bar",               name: "Barplot",          tag: "Ranking",       preview: "" },
    { id: "radar",             name: "Spider / Radar",   tag: "Ranking",       preview: "" },
    { id: "wordcloud",         name: "Word Cloud",       tag: "Ranking",       preview: "" },
    { id: "parallel",          name: "Parallel",         tag: "Ranking",       preview: "" },
    { id: "lollipop",          name: "Lollipop",         tag: "Ranking",       preview: "" },
    { id: "circular_barplot",  name: "Circular Bar",     tag: "Ranking",       preview: "" },
    { id: "dumbbell",          name: "Dumbbell",         tag: "Ranking",       preview: "" },
    { id: "grouped_bar",       name: "Grouped Bar",      tag: "Part-to-Whole", preview: "" },
    { id: "stacked_bar",       name: "Stacked Bar",      tag: "Part-to-Whole", preview: "" },
    { id: "treemap",           name: "Treemap",          tag: "Part-to-Whole", preview: "" },
    { id: "doughnut",          name: "Doughnut",         tag: "Part-to-Whole", preview: "" },
    { id: "pie",               name: "Pie Chart",        tag: "Part-to-Whole", preview: "" },
    { id: "dendrogram",        name: "Dendrogram",       tag: "Part-to-Whole", preview: "" },
    { id: "circlepack",        name: "Circle Pack",      tag: "Part-to-Whole", preview: "" },
    { id: "waffle",            name: "Waffle",           tag: "Part-to-Whole", preview: "" },
    { id: "line",              name: "Line Plot",        tag: "Evolution",     preview: "" },
    { id: "area",              name: "Area",             tag: "Evolution",     preview: "" },
    { id: "stacked_area",      name: "Stacked Area",     tag: "Evolution",     preview: "" },
    { id: "streamchart",       name: "Streamchart",      tag: "Evolution",     preview: "" },
    { id: "timeseries",        name: "Time Series",      tag: "Evolution",     preview: "" },
    { id: "choropleth",        name: "Choropleth",       tag: "Map",           preview: "" },
    { id: "hexbin_map",        name: "Hexbin Map",       tag: "Map",           preview: "" },
    { id: "cartogram",         name: "Cartogram",        tag: "Map",           preview: "" },
    { id: "connection_map",    name: "Connection Map",   tag: "Map",           preview: "" },
    { id: "bubble_map",        name: "Bubble Map",       tag: "Map",           preview: "" },
    { id: "chord",             name: "Chord",            tag: "Flow",          preview: "" },
    { id: "network",           name: "Network",          tag: "Flow",          preview: "" },
    { id: "sankey",            name: "Sankey",           tag: "Flow",          preview: "" },
    { id: "arc_diagram",       name: "Arc Diagram",      tag: "Flow",          preview: "" },
    { id: "edge_bundling",     name: "Edge Bundling",    tag: "Flow",          preview: "" },
    { id: "3d_scatter",        name: "3D Scatter",       tag: "3D",            preview: "" },
    { id: "3d_surface",        name: "3D Surface",       tag: "3D",            preview: "" },
];

export const CHART_TAGS = [...new Set(CHARTS.map(c => c.tag))];

export interface GeneratedChart {
    chartType: string;
    name: string;
    image: string;
    code: string;
    status: "pending" | "generating" | "done" | "error";
    error?: string;
}
