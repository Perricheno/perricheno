import { NextRequest, NextResponse } from "next/server";
import { createAgentSession, updateAgentSession, getAgentSession, checkAndDeductUsage, getUserByTelegramId, getRecentSessionByTitle } from "@/lib/db";
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
    
    // Logic: Identify if we are dealing with a large dataset schema
    const isDatasetSchema = dataContext.includes('[DATASET SCHEMA DETECTED]');

    if (isPython) {
        return `### DATA SOURCE (THE SOURCE OF TRUTH)
${dataContext ? `[DATA CONTEXT]\n${dataContext}\n[/DATA CONTEXT]` : '[DATA CONTEXT] Empty [/DATA CONTEXT]'}
${hasImages ? `- VISION ASSETS: Images of the document are also provided for visual context.` : ''}

### MASTER DATA SCIENTIST ROLE: VISUALIZATION ENGINEER
You are a Senior Data Scientist at Perricheno. 
Your task: Create a PREMIUM visualization based strictly on the above Data Context.

### 1. TARGET GOAL
- PROJECT: "${topic}"
- VISUAL: ${chartDesc}
- INSTRUCTION: "${instruction || 'Visualize the key patterns'}"

### 2. DATA INVESTIGATION RULES
You MUST use the data provided at the top of this prompt.
BEWARE: Do NOT hallucinate metrics from the project title. If the [DATA CONTEXT] is empty, contains only boilerplate, or is insufficient for the requested chart, STOP and return a Python script that raises an Exception with a message in Russian explaining what is missing.

### 3. TECHNICAL SPECIFICATION (MANDATORY)
- **DATA LOADING**: You are provided with a globally available robust helper function called \`get_dataframe()\`.
- **PYTHON SNIPPET**:
  \`\`\`python
  import pandas as pd
  import matplotlib.pyplot as plt
  import seaborn as sns
  
  # YOU MUST USE THIS HELPER TO LOAD DATA:
  df = get_dataframe()
  
  # Example cleaning:
  # if df.empty: raise Exception("No data available")
  \`\`\`
- **Labels**: Use ${isRu ? 'Russian' : 'English'} for all text in the plot. 

### 4. EXECUTION PLAN
- Import: plt, sns, pd, np.
- **Result**: The final figure MUST be assigned to the variable \`fig\`.
- **CRITICAL COMPATIBILITY**: Modern Pandas. NEVER use \`inplace=True\`. Use assignment: \`df = df.fillna(...)\`.
- **NO EXTERNAL FILES**: Do NOT try to read from "images/" or use "pytesseract".

OUTPUT: Pure Python code only.`;
    }

    return `### DATA CONTEXT
${dataContext ? `${dataContext}\n` : 'Empty'}
${hasImages ? `VISION DATA: Priority data extracted from images.` : ''}

### MASTER DATA SCIENTIST ROLE: R VISUALIZATION ENGINEER
You are a Senior R Developer using \`ggplot2\`.

GOAL: Create ${chartDesc} for "${topic}"
INSTRUCTION: "${instruction}"

### REQUIREMENTS:
1. Load data into \`df\`.
2. Handle factors and dates correctly.
3. Use \`theme_minimal()\` or custom Perricheno styling.
4. Scale color/fill with "${palette}".
5. Ensure the final expression is the ggplot object.

OUTPUT: Pure R code only.`;
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

function wrapPythonCode(rawCode: string, plainTextContext: string) {
    const base64Data = Buffer.from(plainTextContext || '').toString('base64');
    
    // Use regular string literal with concatenation to avoid backtick escaping hell in template literals
    const pythonHelper = [
        "import pandas as pd",
        "import io",
        "import re",
        "import base64",
        "import numpy as np",
        "",
        "# Safely injected data string",
        `data_str = base64.b64decode("${base64Data}").decode('utf-8')`,
        "",
        "def get_dataframe():",
        '    """Advanced robust helper to extract dataframe from context."""',
        "    if not data_str:",
        "        return pd.DataFrame()",
        "    try:",
        "        csv_match = re.search(r'===CSV START===\\n(.*?)\\n===CSV END===', data_str, re.DOTALL)",
        "        if csv_match:",
        "            csv_content = csv_match.group(1)",
        "        else:",
        "            csv_content = re.sub(r'```[a-z]*', '', data_str).strip()",
        "        if not csv_content.strip(): return pd.DataFrame()",
        "        ",
        "        df = pd.read_csv(io.StringIO(csv_content), sep=None, engine='python', on_bad_lines='skip')",
        "        ",
        "        # Deep cleaning",
        "        df = df.dropna(axis=1, how='all').dropna(axis=0, how='all')",
        "        for col in df.columns:",
        "            if pd.api.types.is_object_dtype(df[col]):",
        "                try:",
        "                    # Detect if column is actually numeric with commas",
        "                    test_col = df[col].astype(str).str.replace(',', '.').str.replace(' ', '')",
        "                    if pd.to_numeric(test_col, errors='coerce').notna().sum() > len(df) * 0.5:",
        "                        df[col] = pd.to_numeric(test_col, errors='coerce')",
        "                except Exception:",
        "                    pass",
        "        ",
        "        df = df.fillna(0)",
        "        df.columns = df.columns.astype(str).str.strip()",
        "        return df",
        "    except Exception as e:",
        '        print("Dataframe parse error:", e)',
        "        return pd.DataFrame()",
        "",
        "# AI Code below",
        ""
    ].join("\\n");

    return pythonHelper + rawCode;
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
            instruction,
            attachedFiles = [] 
        } = await req.json();
        
        console.log(`[Generate] Request from ${telegramId}: images=${images?.length || 0}, textChars=${context?.text_data?.length || 0}`);

        if (!context || (!context.text_data && (!images || images.length === 0))) {
            return NextResponse.json({ error: "No context provided" }, { status: 400 });
        }

        // --- Data Integrity Guard: Prevent hallucinations when text extraction fails ---
        const textContent = context.text_data || "";
        const hasVisionData = Array.isArray(images) && images.length > 0;
        
        // Increased threshold from 100 to 400 chars to ensure minimal data for analysis
        if (textContent.length < 400 && !hasVisionData) {
            console.warn(`[Generate] Blocked potential hallucination for ${telegramId} - insufficient context (${textContent.length} chars).`);
            return NextResponse.json({ 
                error: "⚠️ В документе недостаточно данных для анализа. Пожалуйста, убедитесь, что в файле есть количественные показатели или прикрепите детальное описание." 
            }, { status: 422 });
        }

        const isPython = language !== 'r';
        const runtime = isPython ? 'Python' : 'R';
        const compilerUrl = isPython ? PYTHON_COMPILER_URL : R_COMPILER_URL;
        const BOT_INTERNAL_URL = "http://telegram-bot:3001/bot-internal";

        let sessionId = uuidv4();
        // ── Create DB session & Deduct Input Usage ──
        if (telegramId) {
            const user = getUserByTelegramId(String(telegramId));
            if (user) {
                if (user.is_banned) {
                    return NextResponse.json({ error: "Ваш аккаунт заморожен администрацией." }, { status: 403 });
                }
                // Check if a completed session with the exact same title exists to cache output
                const existingSession = getRecentSessionByTitle(user.id, title || "Telegram Visual");
                if (existingSession && existingSession.status === "done" && (existingSession.visuals_json || existingSession.stream_text)) {
                    console.log(`[Generate] Cache hit for session: ${existingSession.id}`);
                    // Return instantly without triggering OpenAI or updating the DB
                    if (chatId && messageId) {
                        fetch(`${BOT_INTERNAL_URL}/complete-visual`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                            body: JSON.stringify({ chatId, messageId, sessionId: existingSession.id })
                        }).catch(() => {});
                    }
                    return NextResponse.json({ success: true, sessionId: existingSession.id, cached: true });
                }

                if (existingSession && existingSession.status !== "done") {
                    sessionId = existingSession.id;
                    console.log(`[Generate] Consolidating into active existing session: ${sessionId}`);
                }

                // Identify Input Data Length
                const inputChars = textContent.length;
                if (inputChars > 0 && (!existingSession || existingSession.status === "done")) { // Only deduct for new sessions
                    const deduction = checkAndDeductUsage(user.id, 'chars', inputChars);
                    if (!deduction.success) {
                        return NextResponse.json({ 
                            error: `Insufficient balance to analyze data. Need ${inputChars} symbols, but you only have ${Math.floor(deduction.remaining)}.` 
                        }, { status: 402 });
                    }
                }

                if (!existingSession || existingSession.status === "done") {
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
                } else {
                    // Update existing active session status
                    updateAgentSession(sessionId, { status: "generating", error_msg: null });
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

                // --- Initialize Real-Time Throttled UI State Updater ---
                const steps = [
                    { text: "Подготовка контекста", state: "done" },
                    { text: "Написание кода (ИИ)", state: "running" },
                    { text: "Генерация графиков", state: "pending" }
                ];
                let statusLogs: string[] = [];
                const addLog = (msg: string) => { statusLogs.push(msg); };
                addLog(`[system] Данные загружены и подготовлены`);
                
                let generatedCode = "";
                let lastUIUpdate = 0;
                
                const pushStatusUpdate = (force = false) => {
                    const now = Date.now();
                    if (chatId && messageId && (force || now - lastUIUpdate > 1500)) {
                        lastUIUpdate = now;
                        fetch(`${BOT_INTERNAL_URL}/update-visual`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-Bot-Secret": WEBHOOK_SECRET! },
                            body: JSON.stringify({ 
                                chatId, messageId, language,
                                statusData: {
                                    steps,
                                    logs: statusLogs.slice(-3),
                                    code: generatedCode
                                }
                            })
                        }).catch(() => {});
                    }
                };

                // Initial Push
                pushStatusUpdate(true);

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

                addLog(`[info] Подготовлен промпт (${runtime}). Режим: ${hasImages ? 'VISION' : 'TEXT'}`);

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

                const systemRole = hasImages 
                    ? `You are an expert ${runtime} visualization engineer and OCR analyst. Your task is to extract REAL statistics from the IMAGES of documents provided and visualize them. Use the user instruction as a guide on WHICH metrics to find. BEWARE: Do NOT hallucinate data from the project title. Use only what you see in the images or text context.`
                    : `You are an expert ${runtime} data scientist. Your task is to analyze the provided TEXT context, extract quantitative metrics, and create a premium visualization. No images are provided, so focus entirely on the provided text. BEWARE: The project title is just a label. Do NOT create visualizations like "Letter frequency in the project name" unless specifically asked. If the [DATA CONTEXT] has NO quantitative metrics, return a clear error in Russian saying that no data is found for analysis.`;

                const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "gpt-5-mini-2025-08-07", // Use reliable model
                        stream: true,
                        messages: [
                            { role: "system", content: systemRole },
                            { role: "user", content: userContent }
                        ],
                    }),
                    signal: AbortSignal.timeout(120000), 
                });

                if (!aiRes.ok || !aiRes.body) {
                    const err = await aiRes.text();
                    addLog(`[error] Ошибка OpenAI API: HTTP ${aiRes.status}`);
                    steps[1].state = "error";
                    pushStatusUpdate(true);
                    updateAgentSession(sessionId, { status: "error", error_msg: `AI Error: ${err.slice(0, 200)}` });
                    return;
                }

                addLog(`[stream] Подключение NodeJS -> OpenAI установлено`);
                pushStatusUpdate(true);

                const reader = aiRes.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let rawCode = "";
                let buffer = "";

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || "";
                        
                        for (const line of lines) {
                            if (line.trim() === "") continue;
                            if (line.startsWith("data: ") && !line.includes("[DONE]")) {
                                try {
                                    const parsed = JSON.parse(line.slice(6));
                                    const token = parsed.choices?.[0]?.delta?.content;
                                    if (token) {
                                        rawCode += token;
                                        // Update preview code (we don't want massive chunks over UI, just first 1000 chars)
                                        generatedCode = rawCode;
                                        pushStatusUpdate(); // Call throttler
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }

                const generatedCodeClean = cleanCode(rawCode);

                if (!generatedCodeClean) {
                    addLog(`[error] ИИ вернул пустой код без объяснений`);
                    steps[1].state = "error";
                    pushStatusUpdate(true);
                    updateAgentSession(sessionId, { status: "error", error_msg: "AI returned empty code" });
                    return;
                }

                // AI step is done, move to compilation
                steps[1].state = "done";
                steps[2].state = "running";
                addLog(`[system] Код получен. Начинаю компиляцию в контейнере...`);
                pushStatusUpdate(true);

                // Save generated code to DB
                updateAgentSession(sessionId, { stream_text: generatedCodeClean });


                // 4. Compile with auto-retry on failure (self-correction)
                const MAX_RETRIES = 1;
                let currentCode = generatedCodeClean;
                let compileSuccess = false;
                let lastError = "";

                for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                    const finalCode = isPython ? wrapPythonCode(currentCode, context.text_data || "") : wrapRCode(currentCode);

                    if (attempt > 0) {
                        steps[2].text = `Исправление ошибки (попытка ${attempt}/${MAX_RETRIES})`;
                        addLog(`[error] Ошибка выполнения: запускаю агента-программиста (ретрай)`);
                        pushStatusUpdate(true);
                    }

                    addLog(`[compile] Отправлен запрос на сервер (${runtime})`);
                    pushStatusUpdate(true);

                    const compileRes = await fetch(`${compilerUrl}/compile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: finalCode, files: attachedFiles }),
                        signal: AbortSignal.timeout(45000),
                    });

                    if (!compileRes.ok) {
                        lastError = `${runtime} compiler server error (HTTP ${compileRes.status})`;
                        addLog(`[error] Сервер компиляции недоступен`);
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
                        steps[2].state = "done";
                        addLog(`[success] Изображение успешно сгенерировано!`);
                        pushStatusUpdate(true);
                        break;
                    }

                    // ❌ Compilation failed — try self-correction
                    lastError = compileResult.log || `${runtime} execution failed`;
                    console.log(`[Visual] Compile attempt ${attempt + 1} failed: ${lastError.slice(0, 200)}`);

                    if (attempt < MAX_RETRIES) {
                        // Ask AI to fix the code
                        addLog(`[stream] Ожидание исправления кода...`);
                        pushStatusUpdate(true);

                        const fixRes = await fetch("https://api.openai.com/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${OPENAI_API_KEY}`
                            },
                            body: JSON.stringify({
                                model: "gpt-5-mini-2025-08-07",
                                stream: false, // For quick error fix, streams are slow and unnecessary
                                messages: [
                                    { role: "system", content: `You are an expert ${runtime} debugger. Fix the code below so it runs without errors. Output ONLY the fixed ${runtime} code. No markdown fences. No commentary.` },
                                    { role: "user", content: `This ${runtime} code failed with the following error:\n\n--- ERROR ---\n${lastError}\n--- END ERROR ---\n\n--- CODE ---\n${currentCode}\n--- END CODE ---\n\nFix the code and return ONLY the corrected ${runtime} code.` }
                                ]
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
                                generatedCode = currentCode;
                            }
                        }
                    }
                }

                // If all attempts failed
                if (!compileSuccess) {
                    steps[2].state = "error";
                    addLog(`[error] Критическая ошибка генерации`);
                    pushStatusUpdate(true);
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

            } catch (err) {
                console.error("Clean code failed:", err);
                updateAgentSession(sessionId, { status: "error", error_msg: err instanceof Error ? err.message : String(err) });
            }
        })();

        return NextResponse.json({ success: true, sessionId });
    } catch (err) {
        console.error("Compile failed:", err);
        return NextResponse.json({ error: err instanceof Error ? err.message : "Compilation failed" }, { status: 500 });
    }
}
