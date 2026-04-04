import { NextRequest, NextResponse } from "next/server";
import { updateAgentSession, createAgentSession } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const CHART_PROMPTS: Record<string, string> = {
    bar: 'a bar chart showing comparative data across categories using ggplot2 with geom_bar',
    line: 'a line chart showing trends over time using ggplot2 with geom_line',
    scatter: 'a scatter plot showing correlations between two variables using ggplot2 with geom_point',
    heatmap: 'a heatmap/correlation matrix using pheatmap or corrplot',
    treemap: 'a treemap visualization using the treemap package',
    histogram: 'a histogram showing distribution using ggplot2 with geom_histogram',
    boxplot: 'a boxplot showing statistical distribution using ggplot2 with geom_boxplot',
    violin: 'a violin plot using ggplot2 with geom_violin',
};

const PYTHON_CHART_PROMPTS: Record<string, string> = {
    bar: 'a bar chart using seaborn.barplot or matplotlib.pyplot.bar',
    line: 'a line chart representing trends with seaborn.lineplot or plt.plot',
    scatter: 'a scatter plot showing data correlation with seaborn.scatterplot or plt.scatter',
    heatmap: 'a correlation heatmap using seaborn.heatmap(df.corr())',
    treemap: 'a treemap using squarify or plotly.express.treemap',
    histogram: 'a distribution histogram with seaborn.histplot',
    boxplot: 'a boxplot illustrating statistical variance using seaborn.boxplot',
    violin: 'a violin plot visualizing probability density with seaborn.violinplot',
};

function buildVisualizationPrompt(topic: string, chartType: string, palette: string, language: string, dataContext: string, runtime: 'R' | 'Python' = 'Python') {
    const isPython = runtime === 'Python';
    const prompts = isPython ? PYTHON_CHART_PROMPTS : CHART_PROMPTS;
    const chartDesc = prompts[chartType] || `a ${chartType} visualization`;
    const isRu = language === 'ru';
    
    if (isPython) {
        return `You are a Python data visualization expert (Matplotlib/Seaborn/Pandas). Generate a SINGLE, complete, self-contained Python script.
        
        TASK: Create ${chartDesc} related to this research topic: "${topic}"
        
        ${dataContext ? `USER INSTRUCTIONS & DATA CONTEXT:\n${dataContext}\n` : ''}
        
        REQUIREMENTS:
        1. Create REALISTIC synthetic data matching the topic using Pandas (at least 20-50 rows for depth).
        2. Use the "${palette}" style color palette (if using Seaborn, use \`sns.set_palette\`).
        3. The plot must be professional with proper ${isRu ? 'Russian' : 'English'} titles and axis labels.
        4. CRUCIAL: Use \`plt.tight_layout()\` to prevent text overlap. Ensure high readability.
        5. Ensure a clean visual style with \`sns.set_style("whitegrid")\` or similar.
        6. Essential libraries: \`import matplotlib.pyplot as plt\`, \`import seaborn as sns\`, \`import pandas as pd\`, \`import numpy as np\`.
        7. The script must be completely self-contained.
        8. DO NOT include \`plt.show()\`. 
        9. Save the figure as 'output.png' using \`plt.savefig('output.png', dpi=150, bbox_inches='tight')\`.
        
        OUTPUT: Only output pure Python code. NO markdown fences (\`\`\`python). NO commentary.`;
    }

    return `You are an R visualization expert. Generate a SINGLE, complete, self-contained R script.

TASK: Create ${chartDesc} related to this research topic: "${topic}"

${dataContext ? `USER INSTRUCTIONS & DATA CONTEXT:\n${dataContext}\n` : ''}

REQUIREMENTS:
1. Create REALISTIC synthetic data matching the topic.
2. Use the "${palette}" color palette (from viridis, RColorBrewer, etc).
3. The plot must be publication-quality with proper ${isRu ? 'Russian' : 'English'} titles and axis labels.
4. CRUCIAL: Prevent text overlap! If using x-axis labels, use \`theme(axis.text.x = element_text(angle = 45, hjust = 1))\`.
5. Ensure a clean visual layout using \`theme_minimal()\` or similar.
6. The script must be completely self-contained — NO external files.
7. If you use a package (e.g., ggplot2, plotly, ggrepel), use simple \`library(pkgName)\`.
8. DO NOT include Cairo() or png() calls. 
9. The last expression MUST be the plot object itself so it renders.

OUTPUT: Only output the pure R code. NO markdown fences (\`\`\`R). NO commentary. Just executable R code.`;
}

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { context, language = "python", sessionId: incomingSessionId, telegramId, title, chartType = 'auto' } = await req.json();
        
        if (!context || !context.text_data) {
            return NextResponse.json({ error: "No context provided" }, { status: 400 });
        }

        const sessionId = incomingSessionId || uuidv4();

        // Ensure session exists
        if (telegramId) {
            const { getUserByTelegramId } = await import("@/lib/db");
            const user = getUserByTelegramId(String(telegramId)) as any;
            if (user) {
                try {
                    const existing = await import("@/lib/db").then(m => m.getAgentSession(sessionId));
                    if (!existing) {
                        createAgentSession({
                            id: sessionId,
                            user_id: user.id,
                            title: title || "New Visual",
                            status: "generating",
                            doc_type: "visual",
                            share_id: uuidv4().split('-')[0],
                        });
                    } else {
                        updateAgentSession(sessionId, { status: "generating", stream_text: "" });
                    }
                } catch (e) {}
            }
        }

        const prompt = buildVisualizationPrompt(
            title || "Data Visualization", 
            chartType, 
            'viridis', 
            'ru', 
            `${context.text_data}\n${context.files_text || ''}`,
            language === 'python' ? 'Python' : 'R'
        );

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                messages: [
                    { role: "system", content: `You are an expert ${language === 'python' ? 'Python' : 'R'} programmer. Output ONLY raw executable ${language === 'python' ? 'Python' : 'R'} code. No markdown fences. No commentary. Ensure proper syntax.` },
                    { role: "user", content: prompt }
                ],
                stream: true,
                temperature: 0.1,
            })
        });

        if (!response.ok) {
            const err = await response.text();
            return NextResponse.json({ error: `AI Error: ${err}` }, { status: 502 });
        }

        // --- STREAMING LOGIC ---
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        
        // Start background process for streaming to DB
        (async () => {
            let accumulated = "";
            let lastUpdate = Date.now();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");
                
                for (const line of lines) {
                    if (line.startsWith("data: ") && line !== "data: [DONE]") {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices[0]?.delta?.content;
                            if (content) accumulated += content;
                        } catch (e) {}
                    }
                }
                
                if (sessionId && Date.now() - lastUpdate > 500) {
                    updateAgentSession(sessionId, { stream_text: accumulated });
                    lastUpdate = Date.now();
                }
            }
            
            if (sessionId) {
                updateAgentSession(sessionId, { 
                    status: "done", 
                    stream_text: accumulated.trim() 
                });
            }
        })();

        return NextResponse.json({ success: true, sessionId });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
