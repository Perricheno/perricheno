import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { checkAndDeductUsage } from '@/lib/db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const R_COMPILER_URL = process.env.R_COMPILER_URL || 'http://r-compiler:8000';
const PYTHON_COMPILER_URL = process.env.PYTHON_COMPILER_URL || 'http://python-compiler:8000';

const CHART_TYPES = [
    "bar","line","scatter","bubble","lollipop","histogram","density2d","ridge","boxplot","violin",
    "joyplot","kdensity","heatmap","marginal","hexbin","pairplot","qqplot","pie","rose","treemap",
    "circlepack","sunburst","waffle","dendrogram","radar","network","sankey","chord","parallel",
    "waterfall","dumbbell","volcano","survival","wordcloud","choropleth","bubble_map","pca","kmeans",
    "roc","regression","arima","3d_surface","3d_scatter"
];

function buildVisualizationPrompt(prompt: string, dataContext: string, chartType: string, runtime: 'R' | 'Python' = 'Python') {
    const isPython = runtime === 'Python';
    const hasRealData = dataContext && dataContext.length > 50;
    
    // Check if data looks like garbage binary
    const isGarbageData = dataContext && /[\x00-\x08\x0E-\x1F]{5,}|(%[0-9A-Fa-f]{2}){10,}/.test(dataContext.slice(0, 500));
    
    const dataGuard = `
**DATA QUALITY CHECK** (MANDATORY):
- If the provided context below looks like binary garbage, garbled text, base64, hex, or unreadable characters, DO NOT attempt to parse it. It means extraction failed.
- NEVER try to parse file paths, filenames, or metadata markers like "[Failed" as actual data.
- If context is plain readable text (not tabular), extract key facts/numbers and build a dataframe manually.`;
    
    if (isPython) {
        return `You are a strict Data Analytics and Visualization Agent. Generate a SINGLE, complete, self-contained Python script to create a **${chartType.replace("_", " ").toUpperCase()}** chart based on the user's request.
        
        USER REQUEST: "${prompt}"
        ${dataGuard}
        ${dataContext && !isGarbageData ? `USER PROVIDED DATASET/CONTEXT:\n${dataContext}\n` : ''}
        
        REQUIREMENTS:
        ${hasRealData && !isGarbageData
            ? `1. **CRITICAL**: The user has provided REAL DATA/CONTEXT above. You MUST extract, parse, and use THIS ACTUAL DATA in your visualization or analysis. DO NOT invent synthetic data. If the data is text, construct a Pandas dataframe manually containing the relevant facts.`
            : `1. The user didn't provide sufficient extractable data. Focus on creating generic or empty placeholders if actual data isn't available, but try to use the user's prompt as the sole context.`
        }
        2. Chart type to generate: **${chartType.replace("_", " ")}**.
        3. Ensure a clean visual style with \`sns.set_style("whitegrid")\` or similar. Use high-contrast colors (e.g., Seaborn's "husl" or "viridis").
        4. The plot must be professional with proper titles and axis labels.
        5. CRUCIAL: Use \`plt.tight_layout()\` to prevent text overlap.
        6. Essential libraries: \`import matplotlib.pyplot as plt\`, \`import seaborn as sns\`, \`import pandas as pd\`, \`import numpy as np\`.
        7. The script must be completely self-contained.
        8. DO NOT include \`plt.show()\`. 
        9. The compiler will capture the output automatically. Ensure all plots are attached to \`plt\` (e.g. \`fig, ax = plt.subplots()...\` or standard \`plt.plot()\`).
        10. **CRITICAL**: Modern Pandas compatibility. NEVER use \`inplace=True\` (e.g. in \`fillna\`, \`dropna\`, \`replace\`). This is deprecated and will fail. Always use assignment: \`df = df.fillna(...)\`.
        
        OUTPUT: ONLY pure Python code. NO markdown fences (\`\`\`python). NO commentary at the start or end.`;
    }

    const dataGuardR = `
**DATA QUALITY CHECK** (MANDATORY):
- If the provided context below looks like binary garbage, garbled text, base64, hex, or unreadable characters, DO NOT attempt to parse it. Extraction failed.
- NEVER try to parse filenames or metadata markers as actual data.
- If context is plain readable text (not tabular), extract key facts/numbers and build a data.frame manually.`;

    return `You are a strict Data Analytics and Visualization Agent. Generate a SINGLE, complete, self-contained R script to create a **${chartType.replace("_", " ").toUpperCase()}** chart based on the following request.

USER REQUEST: "${prompt}"
${dataGuardR}
${dataContext && !isGarbageData ? `USER PROVIDED DATASET/CONTEXT:\n${dataContext}\n` : ''}

REQUIREMENTS:
${hasRealData && !isGarbageData
    ? `1. **CRITICAL**: The user has provided REAL DATA/CONTEXT above. You MUST extract, parse, and use THIS ACTUAL DATA in your visualization. DO NOT invent synthetic data.`
    : `1. The user didn't provide sufficient extractable data. Use the user prompt info to build simple data, do NOT hallucinate complex datasets.`
}
2. Chart type to generate: **${chartType.replace("_", " ")}**.
3. Prevent text overlap! Ensure a clean visual layout using \`theme_minimal()\`. Use viridis for color scales if needed.
4. The script must be completely self-contained - NO external files.
5. If you use a package (e.g., ggplot2, plotly), use simple \`library(pkgName)\`.
6. DO NOT include Cairo() or png() calls. 
7. The last expression MUST be the plot object itself so it renders.

OUTPUT: Only output the pure executable R code. NO markdown fences (\`\`\`R). NO commentary.`;
}

function cleanCode(raw: string): string {
    let c = raw.trim();
    if (c.startsWith("```")) c = c.replace(/^```(?:r|R|python|py)?\s*\n?/, "");
    if (c.endsWith("```")) c = c.replace(/\n?```\s*$/, "");
    return c.trim();
}

function wrapRCode(rawCode: string) {
    return `
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
` + rawCode;
}

// ─── SUGGEST: AI recommends chart types based on user prompt + data ───
async function handleSuggest(userId: number, body: any) {
    const { prompt, contextFiles = [] } = body;
    
    // Build combined context from all uploaded files
    const combinedContext = contextFiles.map((f: any) => `--- ${f.name} ---\n${f.content.slice(0, 15000)}`).join('\n\n');
    
    if (contextFiles.length > 0 && (combinedContext.includes('Failed to extract') || combinedContext.includes('[Failed'))) {
        throw new Error("Hard Stop: Document data extraction failed. Please ensure the document is readable text or data.");
    }
    
    const systemPrompt = `You are an expert Data Scientist and Visualization Architect. The user wants to visualize data. Based on their request and uploaded data, recommend the best chart types.

Available chart types: ${CHART_TYPES.join(", ")}

Respond ONLY with a valid JSON object: { "charts": ["chart_id_1", "chart_id_2", ...], "count": <number>, "reasoning": "<brief explanation>" }
- "charts" should contain 2-5 chart IDs from the available list, ordered by relevance
- "count" should be how many you recommend generating (2-5)
- "reasoning" should be 1-2 sentences explaining your choices
No markdown fences, no extra text.`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-5.6-terra",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `User request: "${prompt}"\n\n${combinedContext ? `Uploaded data:\n${combinedContext}` : 'No data uploaded.'}` }
            ]
        })
    });

    if (!aiRes.ok) throw new Error("AI Suggestion failed");

    const aiData = await aiRes.json();
    let rawAnswer = aiData.choices[0].message.content.trim();
    if (rawAnswer.startsWith("```")) rawAnswer = rawAnswer.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    
    // Deduct INPUT (system prompt + user message) + OUTPUT (response)
    const inputChars = systemPrompt.length + prompt.length + combinedContext.length;
    checkAndDeductUsage(userId, 'chars', inputChars + rawAnswer.length);

    try {
        const parsed = JSON.parse(rawAnswer);
        const validCharts = (parsed.charts || []).filter((id: string) => CHART_TYPES.includes(id));
        return NextResponse.json({ 
            charts: validCharts.length > 0 ? validCharts : ["bar", "scatter", "line"],
            count: parsed.count || 3,
            reasoning: parsed.reasoning || "Recommended based on your data and request."
        });
    } catch {
        return NextResponse.json({ 
            charts: ["bar", "scatter", "line"], 
            count: 3, 
            reasoning: "Default recommendation." 
        });
    }
}

// ─── GENERATE: Sequential multi-chart generation via SSE ───
async function handleGenerate(userId: number, body: any) {
    const { prompt, contextFiles = [], charts = [], runtime = 'Python' } = body;
    
    const combinedContext = contextFiles.map((f: any) => `--- ${f.name} ---\n${f.content.slice(0, 15000)}`).join('\n\n');
    const chartsToGenerate = charts.slice(0, 8); // Cap at 8

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            const sendEvent = (event: string, data: any) => {
                const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(payload));
            };

            try {
                if (contextFiles.length > 0 && (combinedContext.includes('Failed to extract') || combinedContext.includes('[Failed'))) {
                    throw new Error("Document data extraction completely failed. Please check your uploaded files. Generating synthetic plots matches is turned off.");
                }

                sendEvent('status', { 
                    id: 'init', 
                    label: 'Initializing Analytics Pipeline', 
                    status: 'done', 
                    log: `Generating ${chartsToGenerate.length} visualizations via ${runtime}...` 
                });

                sendEvent('status', { 
                    id: 'data', 
                    label: 'Processing Data Context', 
                    status: 'done', 
                    log: combinedContext.length > 50 
                        ? `Loaded ${contextFiles.length} file(s), ${combinedContext.length} chars total.` 
                        : 'No extensive data. Proceeding with text context.' 
                });

                // Generate each chart sequentially
                for (let i = 0; i < chartsToGenerate.length; i++) {
                    const chartType = chartsToGenerate[i];
                    const chartId = `chart_${i}`;
                    
                    sendEvent('status', { 
                        id: chartId, 
                        label: `Generating ${chartType.replace("_", " ")} (${i + 1}/${chartsToGenerate.length})`, 
                        status: 'running', 
                        log: `Requesting ${runtime} code for ${chartType}...` 
                    });

                    try {
                        // Call AI to generate code for this chart
                        const aiPrompt = buildVisualizationPrompt(prompt, combinedContext, chartType, runtime as 'R' | 'Python');
                        
                        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${OPENAI_API_KEY}`
                            },
                            body: JSON.stringify({
                                model: "gpt-5.6-terra",
                                stream: true,
                                messages: [
                                    { role: "system", content: `You are an expert ${runtime} programmer. Output ONLY raw executable code. No markdown fences.` },
                                    { role: "user", content: aiPrompt }
                                ]
                            })
                        });

                        if (!aiRes.ok) throw new Error(`AI Error for ${chartType}`);

                        let fullCode = "";
                        if (aiRes.body) {
                            const reader = aiRes.body.getReader();
                            const decoder = new TextDecoder("utf-8");
                            let done = false;

                            while (!done) {
                                const { value, done: readerDone } = await reader.read();
                                done = readerDone;
                                if (value) {
                                    const chunk = decoder.decode(value, { stream: true });
                                    const lines = chunk.split('\n');
                                    for (const line of lines) {
                                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                            try {
                                                const data = JSON.parse(line.slice(6));
                                                const delta = data.choices[0]?.delta?.content || "";
                                                fullCode += delta;
                                                sendEvent('code_chunk', { chartType, delta, index: i });
                                            } catch {}
                                        }
                                    }
                                }
                            }
                        }

                        const cleanedCode = cleanCode(fullCode);
                        if (!cleanedCode) throw new Error("AI returned no code");

                        // Execute in compiler
                        const isPython = runtime === 'Python';
                        const compilerUrl = isPython ? PYTHON_COMPILER_URL : R_COMPILER_URL;
                        const finalCode = isPython ? cleanedCode : wrapRCode(cleanedCode);

                        const compileRes = await fetch(`${compilerUrl}/compile`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ code: finalCode }),
                            signal: AbortSignal.timeout(60000),
                        });

                        if (!compileRes.ok) throw new Error(`${runtime} Execution failed (${compileRes.status})`);
                        
                        const compileResult = await compileRes.json();

                        if (!compileResult.success) {
                            throw new Error(compileResult.log || 'Compilation failed');
                        }

                        // Deduct usage: INPUT (prompt) + OUTPUT (code)
                        const inputChars = aiPrompt.length;
                        checkAndDeductUsage(userId, 'chars', inputChars + cleanedCode.length);
                        checkAndDeductUsage(userId, 'visuals', 1);

                        sendEvent('status', { 
                            id: chartId, 
                            label: `${chartType.replace("_", " ")} generated`, 
                            status: 'done', 
                            log: `Successfully compiled ${chartType}.` 
                        });

                        sendEvent('chart_done', {
                            index: i,
                            chartType,
                            image: compileResult.image,
                            code: cleanedCode,
                            runtime
                        });

                    } catch (chartErr: any) {
                        sendEvent('status', { 
                            id: chartId, 
                            label: `${chartType.replace("_", " ")} failed`, 
                            status: 'error', 
                            log: chartErr.message 
                        });
                        sendEvent('chart_error', { 
                            index: i, 
                            chartType, 
                            error: chartErr.message 
                        });
                        // Continue to next chart
                    }
                }

                sendEvent('all_done', { total: chartsToGenerate.length });
                controller.close();
            } catch (err: any) {
                sendEvent('error', { message: err.message || 'Stream processing failed' });
                controller.close();
            }
        }
    });

    return new Response(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive'
        }
    });
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const precheck = await checkAndDeductUsage(userId, 'visuals', 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ error: "LIMIT_REACHED", details: "Visual tokens limit reached." }, { status: 402 });
    }

    try {
        const body = await req.json();
        const { action = 'generate' } = body;

        if (action === 'suggest') {
            return handleSuggest(userId, body);
        }

        return handleGenerate(userId, body);
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to start analytics stream." }, { status: 500 });
    }
}
