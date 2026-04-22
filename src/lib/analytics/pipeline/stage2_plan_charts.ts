// Stage 2 — Chart Planning
// AI analyzes REAL data and plans which charts to generate.
// Uses verified data structure to ensure charts use actual columns/metrics.

import { chatCompletion, parseJsonLoose, type ChatMessage } from "@/lib/agent/pipeline/llm";
import type { ChartPlan, ChartType, DataVerification, AnalyticsSettings } from "./types";
import type { AgentUpload } from "@/lib/db";

const AVAILABLE_CHARTS: ChartType[] = [
    "bar", "line", "scatter", "bubble", "lollipop", "histogram", 
    "density2d", "ridge", "boxplot", "violin", "joyplot", "kdensity", 
    "heatmap", "marginal", "hexbin", "pairplot", "qqplot", "pie", 
    "rose", "treemap", "circlepack", "sunburst", "waffle", "dendrogram", 
    "radar", "network", "sankey", "chord", "parallel", "waterfall", 
    "dumbbell", "volcano", "survival", "wordcloud", "choropleth", 
    "bubble_map", "pca", "kmeans", "roc", "regression", "arima", 
    "3d_surface", "3d_scatter"
];

function buildSystemPrompt(): string {
    return `You are an expert Data Visualization Architect. Based on REAL data provided, plan which charts to generate.

Available chart types: ${AVAILABLE_CHARTS.join(", ")}

Return ONLY valid JSON:
{
  "plans": [
    {
      "chartType": "bar",
      "reasoning": "Why this chart is appropriate for this data",
      "dataColumns": ["column1", "column2"],
      "priority": 5
    }
  ]
}

Rules:
- ONLY recommend charts that can be created with the ACTUAL data provided
- dataColumns MUST be real column names from the data (case-sensitive!)
- priority: 1-5 (5=most important/insightful, 1=optional/supplementary)
- Recommend 2-5 charts maximum (focus on quality over quantity)
- DO NOT recommend charts if data doesn't support them
- Consider data type: tabular vs text vs image
- Match chart type to data characteristics:
  * Categorical data → bar, pie, treemap
  * Time series → line, area
  * Distributions → histogram, boxplot, violin
  * Correlations → scatter, heatmap
  * Comparisons → bar, lollipop, dumbbell

CRITICAL: You MUST use the actual column names and data structure provided. NO synthetic data.

No markdown fences. JSON only.`;
}

function buildUserPrompt(
    settings: AnalyticsSettings,
    verifications: DataVerification[],
    uploads: AgentUpload[]
): string {
    const verifiedData = verifications.filter(v => v.verified);
    
    // CRITICAL: Don't use text_content at all! Use only metadata from verifications
    const dataContext = verifiedData.map(v => {
        return `━━━ ${v.filename} ━━━
Type: ${v.dataType}
${v.rowCount ? `Rows: ${v.rowCount}` : ''}
${v.columnCount ? `Columns: ${v.columnCount}` : ''}
${v.columns?.length ? `Column Names: ${v.columns.join(", ")}` : ''}

Summary: ${v.summary}

This file is available for analysis and visualization.
`;
    }).join("\n\n");
    
    return `USER REQUEST: "${settings.prompt}"

AVAILABLE DATA:
${dataContext}

TASK:
Plan 2-5 visualizations using the ACTUAL data above.
- Use real column names
- Match chart types to data structure
- Prioritize most insightful visualizations
- Consider user's request

Return JSON with chart plans.`;
}

function validatePlans(raw: any, verifications: DataVerification[]): ChartPlan[] {
    if (!raw || !Array.isArray(raw.plans)) {
        return [];
    }
    
    const allColumns = new Set<string>();
    verifications.forEach(v => {
        if (v.columns) {
            v.columns.forEach(col => allColumns.add(col));
        }
    });
    
    const plans: ChartPlan[] = [];
    
    for (const p of raw.plans) {
        if (!p || typeof p !== 'object') continue;
        
        const chartType = p.chartType as ChartType;
        if (!AVAILABLE_CHARTS.includes(chartType)) continue;
        
        const reasoning = typeof p.reasoning === 'string' ? p.reasoning.trim() : "";
        if (!reasoning) continue;
        
        const dataColumns = Array.isArray(p.dataColumns)
            ? p.dataColumns.map(String).filter(Boolean)
            : [];
        
        // Validate that columns exist in data (if tabular and columns are known)
        const hasTabularData = verifications.some(v => v.dataType === 'tabular');
        const hasKnownColumns = allColumns.size > 0;
        
        if (hasTabularData && hasKnownColumns && dataColumns.length > 0) {
            const validColumns = dataColumns.filter((col: string) => allColumns.has(col));
            if (validColumns.length === 0) {
                console.warn(`[Stage2] Chart ${chartType} references non-existent columns: ${dataColumns.join(", ")}`);
                // Don't skip - XLSX files don't have columns extracted yet
                // continue;
            }
        }
        
        const priority = typeof p.priority === 'number' 
            ? Math.max(1, Math.min(5, Math.round(p.priority)))
            : 3;
        
        plans.push({
            chartType,
            reasoning,
            dataColumns,
            priority,
        });
    }
    
    // Sort by priority (highest first)
    plans.sort((a, b) => b.priority - a.priority);
    
    return plans.slice(0, 5);  // Max 5 charts
}

export async function runStage2(
    settings: AnalyticsSettings,
    verifications: DataVerification[],
    uploads: AgentUpload[],
): Promise<{ plans: ChartPlan[]; tokensUsed: number }> {
    const verifiedData = verifications.filter(v => v.verified);
    
    if (verifiedData.length === 0) {
        throw new Error("No verified data available for chart planning");
    }
    
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(settings, verifications, uploads);
    
    const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ];
    
    try {
        const r = await chatCompletion(messages, {
            jsonMode: true,
            timeoutMs: 90_000,
        });
        
        const parsed = parseJsonLoose(r.text);
        const plans = validatePlans(parsed, verifications);
        
        if (plans.length === 0) {
            throw new Error("AI failed to generate valid chart plans. Data may not be suitable for visualization.");
        }
        
        console.log(`[Analytics-Stage2] Generated ${plans.length} chart plans:`);
        plans.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.chartType} (priority ${p.priority}): ${p.reasoning.slice(0, 80)}...`);
        });
        
        return { plans, tokensUsed: r.totalTokens };
    } catch (e: any) {
        console.error(`[Analytics-Stage2] Planning failed:`, e?.message);
        throw new Error(`Chart planning failed: ${e?.message || 'Unknown error'}`);
    }
}
