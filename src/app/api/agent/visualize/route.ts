import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const R_COMPILER_URL = process.env.R_COMPILER_URL || 'http://r-compiler:8000';

const CHART_PROMPTS: Record<string, string> = {
    bar: 'a bar chart showing comparative data across categories using ggplot2 with geom_bar',
    line: 'a line chart showing trends over time using ggplot2 with geom_line',
    scatter: 'a scatter plot showing correlations between two variables using ggplot2 with geom_point',
    heatmap: 'a heatmap/correlation matrix using corrplot or pheatmap',
    '3d_surface': 'a 3D surface plot using plot3D::persp3D with realistic data',
    '3d_scatter': 'a 3D scatter plot using scatterplot3d',
    treemap: 'a treemap visualization using treemap package',
    pie: 'a pie chart or donut chart using ggplot2 with coord_polar',
    histogram: 'a histogram showing distribution using ggplot2 with geom_histogram',
    boxplot: 'a boxplot showing statistical distribution using ggplot2 with geom_boxplot',
    violin: 'a violin plot using ggplot2 with geom_violin',
    network: 'a network/graph visualization using igraph',
    ridge: 'a ridgeline density plot using ggridges',
    radar: 'a radar/spider chart using fmsb',
    waffle: 'a waffle chart using waffle package',
    waterfall: 'a waterfall chart using waterfalls package',
    wordcloud: 'a wordcloud visualization using wordcloud package',
    marginal: 'a scatter plot with marginal histograms/density using ggExtra',
    dumbbell: 'a dumbbell plot using ggalt::geom_dumbbell',
    hexbin: 'a hexagonal binning density plot using ggplot2 and hexbin with geom_hex',
    sankey: 'an alluvial or sankey diagram using ggalluvial',
    lollipop: 'a lollipop chart (a dot connected to an axis by a line) using ggplot2',
    parallel: 'a parallel coordinates plot using GGally::ggparcoord',
    dendrogram: 'a hierarchical clustering tree/dendrogram using ggdendro or ggraph',
    density2d: 'a 2D contour density plot using ggplot2 with geom_density_2d_filled',
    gantt: 'a Gantt chart/project timeline using ggplot2 with geom_segment',
    chord: 'a chord diagram representing relational flows using circlize package',
    circlepack: 'a circle packing diagram using packcircles and ggplot2',
    bubble: 'a bubble chart (scatter plot with size aesthetic) using ggplot2',
    rose: 'a polar/Nightingale rose chart using ggplot2 with geom_col and coord_polar',
};

function buildVisualizationPrompt(topic: string, chartType: string, palette: string, language: string, dataContext: string) {
    const chartDesc = CHART_PROMPTS[chartType] || `a ${chartType} visualization`;
    const isRu = language === 'ru';

    return `You are an R visualization expert. Generate a SINGLE, complete, self-contained R script.

TASK: Create ${chartDesc} related to this research topic: "${topic}"

${dataContext ? `USER INSTRUCTIONS & DATA CONTEXT:\n${dataContext}\n` : ''}

REQUIREMENTS:
1. Create REALISTIC synthetic data matching the topic.
2. Use the "${palette}" color palette (from viridis, RColorBrewer, etc).
3. The plot must be publication-quality with proper ${isRu ? 'Russian' : 'English'} titles and axis labels.
4. CRUCIAL: Prevent text overlap! If using x-axis labels, use \`theme(axis.text.x = element_text(angle = 45, hjust = 1))\`. If adding text labels to points/bars, use \`ggrepel\` or adjust \`vjust\`/\`hjust\` to ensure absolute readability. Do NOT clutter the plot with too many labels.
5. Ensure a clean visual layout using \`theme_minimal()\` or similar. Keep font sizes readable but not overly large (e.g., \`base_size = 12\`).
6. The script must be completely self-contained — NO external files.
7. If you use a package (e.g., ggplot2, plotly, ggrepel), use simple \`library(pkgName)\`.
8. DO NOT include Cairo() or png() calls. 
9. The last expression MUST be the plot object itself so it renders.

OUTPUT: Only output the pure R code. NO markdown fences (\`\`\`R). NO commentary. Just executable R code.`;
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    try {
        const { topic, chartType, palette = 'viridis', language = 'en', dataContext = '', action, rCode } = await req.json();

        // MODE 1: COMPILE FINISHED CODE
        if (action === "compile" && rCode) {
            const failSafeCode = `
# Fail-safe auto-installer
options(repos = c(CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"))
.orig_lib <- base::library
library <- function(package, ...) {
  pkg_name <- as.character(substitute(package))
  if (length(pkg_name) == 1 && pkg_name != "package") {
    if (!requireNamespace(pkg_name, quietly = TRUE)) {
        suppressMessages(suppressWarnings(install.packages(pkg_name, quiet = TRUE)))
    }
    invisible(suppressPackageStartupMessages(suppressWarnings(.orig_lib(pkg_name, character.only = TRUE, quietly = TRUE))))
  } else {
    invisible(suppressPackageStartupMessages(suppressWarnings(.orig_lib(...))))
  }
}

# AI Code below
` + rCode;

            const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: failSafeCode }),
                signal: AbortSignal.timeout(45000), 
            });

            if (!compileRes.ok) throw new Error("Compilation server error");
            const compileResult = await compileRes.json();
            
            if (!compileResult.success) {
                return NextResponse.json({ error: compileResult.log || "R Compilation failed", r_code: rCode }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                image: compileResult.image,
                r_code: rCode, // return clean code without wrapper for editor
                chart_type: chartType,
            });
        }

        // MODE 2: STREAM R SCRIPT GENERATION
        const prompt = buildVisualizationPrompt(topic, chartType, palette, language, dataContext);

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                stream: true,
                messages: [
                    { role: "system", content: "You are an expert R programmer. Output ONLY raw executable R code. No markdown fences. Ensure proper syntax." },
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!aiRes.ok) {
            const err = await aiRes.text();
            throw new Error("AI Generation failed: " + err);
        }

        // Pipe the SSE stream back to the client directly
        return new Response(aiRes.body, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });

    } catch (err: any) {
        console.error("Visualize error:", err);
        return NextResponse.json({ error: err.message || "Visualization failed" }, { status: 500 });
    }
}
