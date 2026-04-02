import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const R_COMPILER_URL = process.env.R_COMPILER_URL || 'http://r-compiler:8000';
const PYTHON_COMPILER_URL = process.env.PYTHON_COMPILER_URL || 'http://python-compiler:8000';

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

function buildVisualizationPrompt(topic: string, chartType: string, palette: string, language: string, dataContext: string, runtime: 'R' | 'Python' = 'R') {
    const isPython = runtime === 'Python';
    const prompts = isPython ? PYTHON_CHART_PROMPTS : CHART_PROMPTS;
    const chartDesc = prompts[chartType] || `a ${chartType} visualization`;
    const isRu = language === 'ru';
    
    if (isPython) {
        return `You are a Python data visualization expert (Matplotlib/Seaborn/Pandas). Generate a SINGLE, complete, self-contained Python script.
        
        TASK: Create ${chartDesc} related to this research topic: "${topic}"
        
        ${dataContext ? `USER INSTRUCTIONS & DATA CONTEXT:\n${dataContext}\n` : ''}
        
        REQUIREMENTS:
        1. Create REALISTIC synthetic data matching the topic using Pandas.
        2. Use the "${palette}" style color palette (if using Seaborn, use \`sns.set_palette\`).
        3. The plot must be professional with proper ${isRu ? 'Russian' : 'English'} titles and axis labels.
        4. CRUCIAL: Use \`plt.tight_layout()\` to prevent text overlap. Ensure high readability.
        5. Ensure a clean visual style with \`sns.set_style("whitegrid")\` or similar.
        6. Essential libraries: \`import matplotlib.pyplot as plt\`, \`import seaborn as sns\`, \`import pandas as pd\`, \`import numpy as np\`.
        7. The script must be completely self-contained.
        8. DO NOT include \`plt.show()\`. 
        9. The figure MUST be stored in the global \`fig\` variable or just use the functional plt interface. The compiler will capture the output.
        
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

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    try {
        const { 
            topic, chartType, palette = 'viridis', language = 'en', 
            dataContext = '', action, code, previousError, previousCode,
            runtime = 'R'
        } = await req.json();

        const isPython = runtime === 'Python';
        const compilerUrl = isPython ? PYTHON_COMPILER_URL : R_COMPILER_URL;

        // MODE 1: COMPILE FINISHED CODE
        if (action === "compile" && code) {
            let finalCode = code;
            if (!isPython) {
                finalCode = `
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
` + code;
            }

            const compileRes = await fetch(`${compilerUrl}/compile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: finalCode }),
                signal: AbortSignal.timeout(45000), 
            });

            if (!compileRes.ok) throw new Error(`${runtime} Compilation server error`);
            const compileResult = await compileRes.json();
            
            if (!compileResult.success) {
                return NextResponse.json({ error: compileResult.log || `${runtime} Execution failed`, code: code }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                image: compileResult.image,
                code: code, 
                chart_type: chartType,
            });
        }

        // MODE 2: STREAM SCRIPT GENERATION
        const prompt = buildVisualizationPrompt(topic, chartType, palette, language, dataContext, runtime);

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
                    { role: "system", content: `You are an expert ${runtime} programmer. Output ONLY raw executable ${runtime} code. No markdown fences. Ensure proper syntax.` },
                    { role: "user", content: prompt },
                    ...(previousError ? [
                        { role: "assistant", content: previousCode },
                        { role: "user", content: `The code you generated caused this exact ${runtime} execution error:\n\n${previousError}\n\nPlease fix your code and output ONLY pure ${runtime} code that resolves this error.` }
                    ] : [])
                ]
            })
        });

        if (!aiRes.ok) {
            const err = await aiRes.text();
            throw new Error("AI Generation failed: " + err);
        }

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
