// Types for Data Analytics Pipeline

export type ChartType = 
    | "bar" | "line" | "scatter" | "bubble" | "lollipop" | "histogram" 
    | "density2d" | "ridge" | "boxplot" | "violin" | "joyplot" | "kdensity" 
    | "heatmap" | "marginal" | "hexbin" | "pairplot" | "qqplot" | "pie" 
    | "rose" | "treemap" | "circlepack" | "sunburst" | "waffle" | "dendrogram" 
    | "radar" | "network" | "sankey" | "chord" | "parallel" | "waterfall" 
    | "dumbbell" | "volcano" | "survival" | "wordcloud" | "choropleth" 
    | "bubble_map" | "pca" | "kmeans" | "roc" | "regression" | "arima" 
    | "3d_surface" | "3d_scatter";

export type Runtime = 'R' | 'Python';

export interface AnalyticsSettings {
    prompt: string;
    runtime: Runtime;
    chartTypes: ChartType[];
    uploadIds: string[];  // IDs from agent_uploads (server-side ingested)
}

export interface DataVerification {
    uploadId: string;
    filename: string;
    verified: boolean;
    dataType: 'tabular' | 'text' | 'image' | 'mixed';
    rowCount?: number;
    columnCount?: number;
    columns?: string[];
    summary: string;  // What data is available
    warnings: string[];
}

export interface ChartPlan {
    chartType: ChartType;
    reasoning: string;
    dataColumns: string[];  // Which columns to use
    priority: number;  // 1-5, higher = more important
}

export interface GeneratedChart {
    chart_type: ChartType;  // snake_case for frontend compatibility
    image: string;  // base64
    code: string;
    runtime: Runtime;
    dataUsed: string[];  // Which columns/data were actually used
    tokensUsed: number;
}

export interface AnalyticsPipelineResult {
    verifications: DataVerification[];
    chartPlans: ChartPlan[];
    charts: GeneratedChart[];
    totalTokens: number;
    status: 'done' | 'partial' | 'failed';
}
