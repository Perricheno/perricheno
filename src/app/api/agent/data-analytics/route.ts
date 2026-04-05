import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/session';
import { checkAndDeductUsage } from '@/lib/db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const R_COMPILER_URL = process.env.R_COMPILER_URL || 'http://r-compiler:8000';
const PYTHON_COMPILER_URL = process.env.PYTHON_COMPILER_URL || 'http://python-compiler:8000';

function buildVisualizationPrompt(prompt: string, dataContext: string, runtime: 'R' | 'Python' = 'Python') {
    const isPython = runtime === 'Python';
    const hasRealData = dataContext && dataContext.length > 50;
    
    if (isPython) {
        return `You are a strict Data Analytics and Visualization Agent. Generate a SINGLE, complete, self-contained Python script to solve the user's request.
        
        USER REQUEST: "${prompt}"
        
        ${dataContext ? `USER PROVIDED DATASET/CONTEXT:\n${dataContext}\n` : ''}
        
        REQUIREMENTS:
        ${hasRealData 
            ? `1. **CRITICAL**: The user has provided REAL DATA/CONTEXT above. You MUST extract, parse, and use THIS ACTUAL DATA in your visualization or analysis. DO NOT invent synthetic data. If the data is text, construct a Pandas dataframe manually containing the relevant facts.`
            : `1. Create REALISTIC synthetic data matching the topic using Pandas if needed.`
        }
        2. Ensure a clean visual style with \`sns.set_style("whitegrid")\` or similar. Use high-contrast colors (e.g., Seaborn's "husl" or "viridis").
        3. The plot must be professional with proper titles and axis labels.
        4. CRUCIAL: Use \`plt.tight_layout()\` to prevent text overlap.
        5. Essential libraries: \`import matplotlib.pyplot as plt\`, \`import seaborn as sns\`, \`import pandas as pd\`, \`import numpy as np\`.
        6. The script must be completely self-contained.
        7. DO NOT include \`plt.show()\`. 
        8. The compiler will capture the output automatically. Ensure all plots are attached to \`plt\` (e.g. \`fig, ax = plt.subplots()...\` or standard \`plt.plot()\`).
        9. **CRITICAL**: Modern Pandas compatibility. NEVER use \`inplace=True\` (e.g. in \`fillna\`, \`dropna\`, \`replace\`). This is deprecated and will fail. Always use assignment: \`df = df.fillna(...)\`.
        
        OUTPUT: ONLY pure Python code. NO markdown fences (\`\`\`python). NO commentary at the start or end.`;
    }

    return `You are a strict Data Analytics and Visualization Agent. Generate a SINGLE, complete, self-contained R script based on the following request.

USER REQUEST: "${prompt}"

${dataContext ? `USER PROVIDED DATASET/CONTEXT:\n${dataContext}\n` : ''}

REQUIREMENTS:
${hasRealData 
    ? `1. **CRITICAL**: The user has provided REAL DATA/CONTEXT above. You MUST extract, parse, and use THIS ACTUAL DATA in your visualization. DO NOT invent synthetic data.`
    : `1. Create REALISTIC synthetic data matching the topic if necessary.`
}
2. Prevent text overlap! Ensure a clean visual layout using \`theme_minimal()\`. Use viridis for color scales if needed.
3. The script must be completely self-contained — NO external files.
4. If you use a package (e.g., ggplot2, plotly), use simple \`library(pkgName)\`.
5. DO NOT include Cairo() or png() calls. 
6. The last expression MUST be the plot object itself so it renders.

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

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const precheck = checkAndDeductUsage(userId, 'visuals', 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ error: "LIMIT_REACHED", details: "Visual tokens limit reached." }, { status: 402 });
    }

    try {
        const { prompt, dataContext = '', runtime = 'Python' } = await req.json();

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                const sendEvent = (event: string, data: any) => {
                    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(payload));
                };

                try {
                    // Step 1: Init check
                    sendEvent('status', { id: 'init', label: 'Initializing Analyst Workflow', status: 'done', log: 'Starting analytic engine...' });
                    
                    // Step 2: Validate Data
                    sendEvent('status', { id: 'data', label: 'Parsing Instructions & Data', status: 'done', log: dataContext.length > 50 ? `Received dataset/context: ${dataContext.length} chars.` : 'No extensive data context provided. Proceeding with synthetic assumption.' });

                    // Step 3: Call AI
                    sendEvent('status', { id: 'ai', label: 'Generating Computation Logic', status: 'running', log: 'Connecting to gpt-5-mini-2025-08-07...' });

                    const aiPrompt = buildVisualizationPrompt(prompt, dataContext, runtime);

                    let fullCode = "";

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
                                { role: "system", content: `You are an expert ${runtime} programmer. Output ONLY raw executable code. No markdown fences.` },
                                { role: "user", content: aiPrompt }
                            ]
                        })
                    });

                    if (!aiRes.ok) {
                        const errText = await aiRes.text();
                        throw new Error(`AI Error: ${errText}`);
                    }

                    if (aiRes.body) {
                        const reader = aiRes.body.getReader();
                        const decoder = new TextDecoder("utf-8");
                        let done = false;

                        sendEvent('log', { message: 'Streaming logic:\n' });

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
                                            // Send partial log so user sees code typing
                                            sendEvent('code_chunk', { delta });
                                        } catch (e) {}
                                    }
                                }
                            }
                        }
                    }

                    const cleanedCode = cleanCode(fullCode);
                    if (!cleanedCode) throw new Error("AI returned no code.");

                    sendEvent('status', { id: 'ai', label: 'Generating Computation Logic', status: 'done', log: 'Logic constructed successfully.' });

                    // Step 4: Execution
                    sendEvent('status', { id: 'exec', label: `Execution via ${runtime} Subsystem`, status: 'running', log: `Compiling ${runtime} environment...\n` });

                    const isPython = runtime === 'Python';
                    const compilerUrl = isPython ? PYTHON_COMPILER_URL : R_COMPILER_URL;
                    const finalCode = isPython ? cleanedCode : wrapRCode(cleanedCode);

                    const compileRes = await fetch(`${compilerUrl}/compile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: finalCode }),
                        signal: AbortSignal.timeout(45000),
                    });

                    if (!compileRes.ok) throw new Error(`${runtime} Execution failed (${compileRes.status})`);
                    
                    const compileResult = await compileRes.json();

                    if (!compileResult.success) {
                        // Send failure but include the log
                        sendEvent('status', { id: 'exec', label: `Execution via ${runtime} Subsystem`, status: 'error', log: `\n--- COMPILE ERROR ---\n${compileResult.log}` });
                        sendEvent('error', { message: 'Failed to compile script', code: cleanedCode, log: compileResult.log });
                        controller.close();
                        return;
                    }

                    // Deduct usage since it was successful
                    checkAndDeductUsage(userId, 'chars', cleanedCode.length);
                    checkAndDeductUsage(userId, 'visuals', 1);

                    sendEvent('status', { id: 'exec', label: `Execution via ${runtime} Subsystem`, status: 'done', log: 'Execution successful. Chart generated.' });

                    // Final step: done
                    sendEvent('done', { 
                        image: compileResult.image,
                        code: cleanedCode,
                        log: compileResult.log
                    });

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

    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to start analytics stream." }, { status: 500 });
    }
}
