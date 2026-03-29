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
};

function buildVisualizationPrompt(topic: string, chartType: string, palette: string, language: string) {
    const chartDesc = CHART_PROMPTS[chartType] || `a ${chartType} visualization`;
    const isRu = language === 'ru';

    return `You are an R visualization expert. Generate a SINGLE, complete, self-contained R script.

TASK: Create ${chartDesc} related to this research topic: "${topic}"

REQUIREMENTS:
1. Create REALISTIC synthetic data that makes sense for the topic
2. Use the ${palette} color palette (from viridis or RColorBrewer)
3. The plot must be publication-quality with proper ${isRu ? 'Russian' : 'English'} labels
4. Include: title, axis labels, legend if applicable
5. Use clean, modern aesthetics (theme_minimal or similar)
6. The script must be completely self-contained — NO external data files
7. Do NOT include library() calls for Cairo — it's pre-loaded
8. Do NOT include CairoPNG() or dev.off() — they're handled externally
9. The last expression should be the plot (print() the ggplot object if using ggplot2)

OUTPUT: Only the R code. No markdown fences, no commentary. Just pure R code.`;
}

// POST /api/agent/visualize — generate R code, compile it, return image
export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key not configured" }, { status: 500 });
    }

    try {
        const { topic, chartType, palette = 'viridis', language = 'en' } = await req.json();

        if (!topic || !chartType) {
            return NextResponse.json({ error: "topic and chartType required" }, { status: 400 });
        }

        // Step 1: Generate R code via OpenAI
        const prompt = buildVisualizationPrompt(topic, chartType, palette, language);

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                messages: [
                    { role: "system", content: "You are an expert R programmer. Output ONLY valid R code. No markdown, no explanations." },
                    { role: "user", content: prompt }
                ],
            })
        });

        if (!aiRes.ok) {
            const err = await aiRes.text();
            return NextResponse.json({ error: `AI error: ${err.slice(0, 200)}` }, { status: 500 });
        }

        const aiData = await aiRes.json();
        let rCode = aiData.choices[0].message.content.trim();

        // Clean markdown fences if present
        if (rCode.startsWith("```")) rCode = rCode.replace(/^```(?:r|R)?\s*/, "");
        if (rCode.endsWith("```")) rCode = rCode.replace(/```\s*$/, "");

        // Step 2: Compile R code
        const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: rCode }),
            signal: AbortSignal.timeout(35000),
        });

        if (!compileRes.ok) {
            return NextResponse.json({ error: "R compilation failed", r_code: rCode }, { status: 500 });
        }

        const compileResult = await compileRes.json();

        return NextResponse.json({
            success: compileResult.success,
            image: compileResult.image, // base64 PNG
            r_code: rCode,
            log: compileResult.log,
            chart_type: chartType,
        });

    } catch (err: any) {
        console.error("Visualize error:", err);
        return NextResponse.json({ error: err.message || "Visualization failed" }, { status: 500 });
    }
}
