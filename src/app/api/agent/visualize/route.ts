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
4. The script must be completely self-contained — NO external files.
5. If you use a package (e.g., ggplot2, plotly, etc.), use simple \`library(pkgName)\`.
6. DO NOT include Cairo() or png() calls. 
7. The last expression MUST be the plot object itself so it renders.

OUTPUT: Only output the pure R code. NO markdown fences (\`\`\`R). NO commentary. Just executable R code.`;
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    try {
        const { topic, chartType, palette = 'viridis', language = 'en', dataContext = '' } = await req.json();

        // 1. Generate Code
        const prompt = buildVisualizationPrompt(topic, chartType, palette, language, dataContext);

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                messages: [
                    { role: "system", content: "You are an expert R programmer. Output ONLY raw executable R code. No formatting." },
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!aiRes.ok) throw new Error("AI Generation failed");
        
        const aiData = await aiRes.json();
        let rCode = aiData.choices[0].message.content.trim();
        if (rCode.startsWith("```")) rCode = rCode.replace(/^```(?:r|R)?\s*/, "");
        if (rCode.endsWith("```")) rCode = rCode.replace(/```\s*$/, "");

        // Auto-install wrapper to make it fail-safe:
        // We prepend a block that intercepts package loading and installs them.
        const failSafeCode = `
# Fail-safe auto-installer
options(repos = c(CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"))
.orig_lib <- base::library
library <- function(package, ...) {
  pkg_name <- as.character(substitute(package))
  if (length(pkg_name) == 1 && pkg_name != "package") {
    if (!requireNamespace(pkg_name, quietly = TRUE)) install.packages(pkg_name, quiet = TRUE)
    invisible(.orig_lib(pkg_name, character.only = TRUE, quietly = TRUE))
  } else invisible(.orig_lib(...))
}

# AI Code below
` + rCode;

        // 2. Compile Code
        const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: failSafeCode }),
            signal: AbortSignal.timeout(45000), // wait 45s for compilation & install
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

    } catch (err: any) {
        console.error("Visualize error:", err);
        return NextResponse.json({ error: err.message || "Visualization failed" }, { status: 500 });
    }
}
