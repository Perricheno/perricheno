import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { getVisualKnowledge } from '@/lib/agent/knowledge/loader';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
    'boxplot': 'a boxplot showing statistical distribution using ggplot2 with geom_boxplot',
    'violin': 'a violin plot using ggplot2 with geom_violin',
    'network': 'a network/graph visualization using igraph',
    'ridge': 'a ridgeline density plot using ggridges',
    'radar': 'a radar/spider chart using fmsb',
    'waffle': 'a waffle chart using waffle package',
    'waterfall': 'a waterfall chart using waterfalls package',
    'wordcloud': 'a wordcloud visualization using wordcloud package',
    'marginal': 'a scatter plot with marginal histograms/density using ggExtra',
    'dumbbell': 'a dumbbell plot using ggalt::geom_dumbbell',
};

function buildVisualizationPrompt(topic: string, chartType: string, palette: string, language: string, dataContext: string, engine: 'r' | 'python' = 'r') {
    const chartDesc = CHART_PROMPTS[chartType] || `a ${chartType} visualization`;
    const isRu = language === 'ru';
    const isPython = engine === 'python';

  return `You are an expert ${isPython ? 'Python' : 'R'} visualization programmer. Generate a SINGLE, complete, self-contained ${isPython ? 'Python' : 'R'} script.

TASK: Create ${chartDesc} related to this research topic: "${topic}"

${dataContext ? `USER INSTRUCTIONS & DATA CONTEXT:\n${dataContext}\n` : ''}

REQUIREMENTS:
1. Create REALISTIC synthetic data that matches the topic and user instructions.
2. Use the "${palette}" color palette where applicable.
3. The plot must be publication-quality with proper ${isRu ? 'Russian' : 'English'} titles, subtitles, and axis labels.
4. Include: main title, axis labels, legend if applicable.
5. Use clean, modern aesthetics.
6. The script must be completely self-contained - NO external data files.
${isPython ? `7. Use matplotlib and seaborn. Ensure you handle fonts for Cyrillic if language is Russian/Kazakh.` : `7. CRITICAL: Use pacman::p_load(...) for all packages at the top.`}
8. Only output the pure executable code. NO markdown fences. NO commentary.

${getVisualKnowledge()}`;
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key not configured" }, { status: 500 });
    }

    try {
        const { topic, chartType, palette = 'viridis', language = 'en', dataContext = '', engine = 'r' } = await req.json();

        if (!topic || !chartType) {
            return NextResponse.json({ error: "topic and chartType required" }, { status: 400 });
        }

        const prompt = buildVisualizationPrompt(topic, chartType, palette, language, dataContext, engine as 'r' | 'python');

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5.6-terra",
                messages: [
                    { role: "system", content: "You are an expert R programmer. Output ONLY raw executable R code. No markdown fences, no formatting." },
                    { role: "user", content: prompt }
                ],
                stream: true,
            })
        });

        if (!aiRes.ok) {
            const err = await aiRes.text();
            return NextResponse.json({ error: `AI error: ${err}` }, { status: 500 });
        }

        const stream = new ReadableStream({
            async start(controller) {
                const reader = aiRes.body!.getReader();
                const decoder = new TextDecoder();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n').filter(l => l.trim() !== '');

                        for (const line of lines) {
                            if (line === 'data: [DONE]') continue;
                            if (line.startsWith('data: ')) {
                                try {
                                    const parsed = JSON.parse(line.slice(5));
                                    const content = parsed.choices[0]?.delta?.content;
                                    if (content) {
                                        controller.enqueue(new TextEncoder().encode(content));
                                    }
                                } catch (e) {
                                    // ignore parse err
                                }
                            }
                        }
                    }
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (err: any) {
        console.error("Visualize code stream error:", err);
        return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
    }
}
