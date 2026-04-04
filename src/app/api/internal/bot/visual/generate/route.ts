import { NextRequest, NextResponse } from "next/server";
import { createAgentSession, updateAgentSession, getAgentSession, checkAndDeductUsage, getUserByTelegramId } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const R_COMPILER_URL = process.env.R_COMPILER_URL || 'http://r-compiler:8000';
const PYTHON_COMPILER_URL = process.env.PYTHON_COMPILER_URL || 'http://python-compiler:8000';

// ── Prompts (copied from working agent/visualize/route.ts) ──

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

function buildVisualizationPrompt(topic: string, chartType: string, palette: string, language: string, instruction: string, dataContext: string, hasImages: boolean, runtime: 'R' | 'Python' = 'Python') {
    const isPython = runtime === 'Python';
    const prompts = isPython ? PYTHON_CHART_PROMPTS : CHART_PROMPTS;
    const chartDesc = prompts[chartType] || `a ${chartType} visualization`;
    const isRu = language === 'ru';
    
    const hasRealData = (dataContext && dataContext.length > 50) || hasImages;
    
    if (isPython) {
        return `You are a Python data visualization expert (Matplotlib/Seaborn/Pandas). Generate a SINGLE, complete, self-contained Python script.
        
        GOAL: Create ${chartDesc} about "${topic}"
        USER SPECIFIC INSTRUCTION: "${instruction || 'Visualize the data'}"
        
        ${hasImages ? `SOURCE DATA (IMAGES): I have attached images of document pages. You MUST extract numbers, metrics, and categories directly from these images. This is your PRIMARY source of truth.` : ''}
        ${dataContext ? `SOURCE DATA (TEXT/FILES):\n${dataContext}\n` : ''}
        
        REQUIREMENTS:
        1. **CRITICAL**: Use REAL DATA from the sources above. DO NOT analyze the user's instruction "${instruction}" as data itself. The instruction just tells you WHAT to find in the documents.
        2. If the user instruction is "выручка" (revenue), locate revenue tables in the IMAGES/TEXT and visualize them.
        3. If there are multiple pages, aggregate data across them.
        4. Use the "${palette}" palette and professional ${isRu ? 'Russian' : 'English'} styling.
        ${!hasRealData ? '5. If NO data found in images or text, only then use synthetic data.' : '5. DO NOT use synthetic data if images or text are provided.'}
        6. Essential libraries: \`import matplotlib.pyplot as plt\`, \`import seaborn as sns\`, \`import pandas as pd\`, \`import numpy as np\`.
        7. Figure MUST be stored in the \`fig\` variable.
        
        OUTPUT: Only output pure Python code. NO markdown fences. NO commentary.`;
    }

    return `You are an R visualization expert. Generate a SINGLE, complete, self-contained R script.

GOAL: Create ${chartDesc} about "${topic}"
USER SPECIFIC INSTRUCTION: "${instruction || 'Visualize the data'}"

${hasImages ? `SOURCE DATA (IMAGES): Extract data from the provided images.` : ''}
${dataContext ? `SOURCE DATA (TEXT/FILES):\n${dataContext}\n` : ''}

REQUIREMENTS:
1. Use ACTUAL DATA from images/text. The instruction "${instruction}" is NOT the data.
2. The last expression MUST be the plot object.

OUTPUT: Only output the pure R code. NO markdown.`;
}

// ── Helpers (from working agent/visualize/route.ts) ──

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

function cleanCode(raw: string): string {
    let c = raw.trim();
    if (c.startsWith("```")) c = c.replace(/^```(?:r|R|python|py)?\s*\n?/, "");
    if (c.endsWith("```")) c = c.replace(/\n?```\s*$/, "");
    return c.trim();
}

// ── Main Route ──

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-bot-secret");
    if (secret !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API Key not configured" }, { status: 500 });
    }

    try {
        const { 
            context, 
            language = "python", 
            telegramId, 
            title, 
            chartType = 'auto', 
            chatId, 
            messageId,
            images,
            instruction 
        } = await req.json();
        
        console.log(`[Generate] Request from ${telegramId}: images=${images?.length || 0}, textChars=${context?.text_data?.length || 0}`);

        if (!context) {
            return NextResponse.json({ error: "No context provided" }, { status: 400 });
        }

        const isPython = language !== 'r';
        const runtime = isPython ? 'Python' : 'R';
        const compilerUrl = isPython ? PYTHON_COMPILER_URL : R_COMPILER_URL;
        const BOT_INTERNAL_URL = "http://telegram-bot:3001/bot-internal";

        const sessionId = uuidv4();
        // ── Create DB session ──
        if (telegramId) {
            const user = getUserByTelegramId(String(telegramId));
            if (user) {
                try {
                    createAgentSession({
                        id: sessionId,
                        user_id: user.id,
                        title: title || "Telegram Visual",
                        status: "generating",
                        doc_type: "visual",
                        share_id: uuidv4().split('-')[0],
                    });
                } catch (e) {
                    console.error("Failed to create session:", e);
                }
            }
        }

        // ── Background: Generate + Compile (fire-and-forget, same as agent/visualize) ──
        (async () => {
            try {
                const isPython = language !== 'r';
                const runtime = isPython ? 'Python' : 'R';
                const compilerUrl = isPython ? PYTHON_COMPILER_URL : R_COMPILER_URL;
                const BOT_INTERNAL_URL = "http://telegram-bot:3001/bot-internal";
                
                const hasImages = Array.isArray(images) && images.length > 0;

                // 1. Push status to bot
                if (chatId && messageId) {
                    fetch(`${BOT_INTERNAL_URL}/update-visual`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                        body: JSON.stringify({ chatId, messageId, text: "⏳ Генерация кода...", language })
                    }).catch(() => {});
                }

                // 2. Generate code via OpenAI
                // SIGNATURE: topic, chartType, palette, language, instruction, dataContext, hasImages, runtime
                const prompt = buildVisualizationPrompt(
                    title || "Data Visualization",
                    chartType,
                    'viridis',
                    'ru',
                    instruction || "", // 5. instruction
                    context.text_data || "", // 6. dataContext
                    hasImages, // 7. hasImages (boolean)
                    runtime // 8. runtime
                );

                console.log(`[Generate] Built prompt for ${runtime}. Mode: ${hasImages ? 'VISION' : 'TEXT'}`);

                // Build multimodal content if images are present
                const userContent: any[] = [{ type: "text", text: prompt }];
                if (hasImages) {
                    images.forEach((img: string, idx: number) => {
                        userContent.push({
                            type: "image_url",
                            image_url: { url: img }
                        });
                    });
                }

                const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "gpt-5-mini-2025-08-07",
                        stream: false,
                        messages: [
                            { role: "system", content: `You are an expert ${runtime} visualization engineer. Your task is to extract REAL statistics from the IMAGES of documents provided and visualize them. Use the user instruction only as a guide on WHICH metrics to find in the documents.` },
                            { role: "user", content: userContent }
                        ],
                    }),
                    signal: AbortSignal.timeout(120000), 
                });

                if (!aiRes.ok) {
                    const err = await aiRes.text();
                    console.error("OpenAI Error:", err);
                    updateAgentSession(sessionId, { status: "error", error_msg: `AI Error: ${err.slice(0, 200)}` });
                    if (chatId && messageId) {
                        fetch(`${BOT_INTERNAL_URL}/update-visual`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                            body: JSON.stringify({ chatId, messageId, text: `❌ AI Error: ${err.slice(0, 100)}`, language })
                        }).catch(() => {});
                    }
                    return;
                }

                const aiData = await aiRes.json();
                const rawCode = aiData.choices?.[0]?.message?.content || "";
                const generatedCode = cleanCode(rawCode);

                if (!generatedCode) {
                    updateAgentSession(sessionId, { status: "error", error_msg: "AI returned empty code" });
                    return;
                }

                // Save generated code to DB
                updateAgentSession(sessionId, { stream_text: generatedCode });

                // 3. Push code preview to bot
                if (chatId && messageId) {
                    const preview = generatedCode.length > 800 ? generatedCode.slice(0, 800) + "..." : generatedCode;
                    fetch(`${BOT_INTERNAL_URL}/update-visual`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                        body: JSON.stringify({ chatId, messageId, text: preview, language })
                    }).catch(() => {});
                }

                // 4. Compile with auto-retry on failure (self-correction)
                const MAX_RETRIES = 1;
                let currentCode = generatedCode;
                let compileSuccess = false;
                let lastError = "";

                for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                    const finalCode = isPython ? currentCode : wrapRCode(currentCode);

                    if (chatId && messageId && attempt > 0) {
                        fetch(`${BOT_INTERNAL_URL}/update-visual`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                            body: JSON.stringify({ chatId, messageId, text: `🔄 Retry ${attempt}/${MAX_RETRIES} — исправляю ошибку...`, language })
                        }).catch(() => {});
                    }

                    const compileRes = await fetch(`${compilerUrl}/compile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: finalCode }),
                        signal: AbortSignal.timeout(45000),
                    });

                    if (!compileRes.ok) {
                        lastError = `${runtime} compiler server error (HTTP ${compileRes.status})`;
                        continue;
                    }

                    const compileResult = await compileRes.json();

                    if (compileResult.success && compileResult.image) {
                        // ✅ Success — save to DB
                        const visualEntry = JSON.stringify([{
                            chart_type: chartType,
                            language: language,
                            image: `data:image/png;base64,${compileResult.image}`,
                            source_code: currentCode
                        }]);

                        updateAgentSession(sessionId, {
                            status: "done",
                            stream_text: currentCode,
                            visuals_json: visualEntry,
                        });

                        // Deduct usage
                        if (telegramId) {
                            const user = getUserByTelegramId(String(telegramId));
                            if (user) {
                                checkAndDeductUsage(user.id, 'chars', currentCode.length);
                                checkAndDeductUsage(user.id, 'visuals', 1);
                            }
                        }
                        compileSuccess = true;
                        break;
                    }

                    // ❌ Compilation failed — try self-correction
                    lastError = compileResult.log || `${runtime} execution failed`;
                    console.log(`[Visual] Compile attempt ${attempt + 1} failed: ${lastError.slice(0, 200)}`);

                    if (attempt < MAX_RETRIES) {
                        // Ask AI to fix the code
                        const fixRes = await fetch("https://api.openai.com/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${OPENAI_API_KEY}`
                            },
                            body: JSON.stringify({
                                model: "gpt-5-mini-2025-08-07",
                                stream: false,
                                messages: [
                                    { role: "system", content: `You are an expert ${runtime} debugger. Fix the code below so it runs without errors. Output ONLY the fixed ${runtime} code. No markdown fences. No commentary.` },
                                    { role: "user", content: `This ${runtime} code failed with the following error:\n\n--- ERROR ---\n${lastError}\n--- END ERROR ---\n\n--- CODE ---\n${currentCode}\n--- END CODE ---\n\nFix the code and return ONLY the corrected ${runtime} code.` }
                                ],
                            }),
                            signal: AbortSignal.timeout(60000),
                        });

                        if (fixRes.ok) {
                            const fixData = await fixRes.json();
                            const fixedRaw = fixData.choices?.[0]?.message?.content || "";
                            const fixedCode = cleanCode(fixedRaw);
                            if (fixedCode && fixedCode.length > 20) {
                                currentCode = fixedCode;
                                updateAgentSession(sessionId, { stream_text: currentCode });

                                // Push fixed code preview
                                if (chatId && messageId) {
                                    const preview = currentCode.length > 800 ? currentCode.slice(0, 800) + "..." : currentCode;
                                    fetch(`${BOT_INTERNAL_URL}/update-visual`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                                        body: JSON.stringify({ chatId, messageId, text: preview, language })
                                    }).catch(() => {});
                                }
                            }
                        }
                    }
                }

                // If all attempts failed
                if (!compileSuccess) {
                    updateAgentSession(sessionId, {
                        status: "error",
                        stream_text: currentCode,
                        error_msg: lastError,
                    });
                }

                // 5. Notify bot that generation is complete
                if (chatId && messageId) {
                    fetch(`${BOT_INTERNAL_URL}/complete-visual`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                        body: JSON.stringify({ chatId, messageId, sessionId })
                    }).catch(() => {});
                }

            } catch (err: any) {
                console.error("Bot visual background error:", err);
                updateAgentSession(sessionId, { status: "error", error_msg: err.message });
            }
        })();

        return NextResponse.json({ success: true, sessionId });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
