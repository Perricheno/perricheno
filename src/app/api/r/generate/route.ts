// R Studio - generate + compile R visualization.
// Multi mode: fire-and-forget background job, client polls session via GET /api/r/sessions/[id].
// Single mode: synchronous, returns result directly.

import { NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { checkAndDeductUsage, getUserById } from "@/lib/db";
import { getVisualKnowledge } from "@/lib/agent/knowledge/loader";
import { createRSession, updateRSession } from "@/lib/r-db";
import type { RResultItem } from "@/lib/r-db";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const R_COMPILER_URL = process.env.R_COMPILER_URL || "http://r-compiler:8000";
const MODEL = "gpt-5-mini-2025-08-07";

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrapRCode(raw: string): string {
    return `
options(repos = c(CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"))
.orig_lib <- base::library
library <- function(package, ...) {
  pkg_name <- as.character(substitute(package))
  if (length(pkg_name) == 1 && pkg_name != "package") {
    if (!requireNamespace(pkg_name, quietly = TRUE))
      suppressMessages(suppressWarnings(install.packages(pkg_name, quiet = TRUE)))
    invisible(suppressPackageStartupMessages(suppressWarnings(
      .orig_lib(pkg_name, character.only = TRUE, quietly = TRUE))))
  } else {
    invisible(suppressPackageStartupMessages(suppressWarnings(.orig_lib(...))))
  }
}
${raw}`;
}

function cleanCode(raw: string): string {
    let c = raw.trim();
    c = c.replace(/^```(?:r|R)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    return c.trim();
}

function isGarbage(text: string): boolean {
    return /[\x00-\x08\x0E-\x1F]{5,}|(%[0-9A-Fa-f]{2}){10,}/.test(text.slice(0, 500));
}

function makeTitle(prompt: string): string {
    return prompt.slice(0, 80).trim();
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildGeneratePrompt(
    prompt: string,
    chartType: string,
    combinedContext: string,
    knowledge: string,
    rFileNames: string[],
): string {
    const hasFiles = rFileNames.length > 0;
    const hasTextData = !hasFiles && combinedContext.length > 50 && !isGarbage(combinedContext);
    const chartDesc = chartType
        ? `a **${chartType.replace(/_/g, " ").toUpperCase()}** chart`
        : "the most appropriate chart type";

    const dataSection = hasFiles
        ? `DATA FILES - pre-loaded into the R working directory:
${rFileNames.map(n => `  • "${n}"`).join("\n")}

READ THE DATA with (choose based on file type):
  df <- read.csv("${rFileNames[0]}")          # CSV
  df <- read.table("${rFileNames[0]}", header=TRUE, sep="\\t")  # TSV

FILE SCHEMA (use for column names - all rows are in the file, not just this sample):
${combinedContext}

RULES FOR REAL DATA:
- ALWAYS load with read.csv() / read.table() from the filename above.
- NEVER hardcode data values or build a data.frame manually from the sample.
- NEVER use synthetic or example data - the full dataset is available on disk.`
        : hasTextData
            ? `USER PROVIDED TEXT/DATA:\n${combinedContext}\n\nExtract facts/numbers and build a data.frame manually.`
            : "No dataset provided - generate realistic synthetic data with set.seed(42).";

    return `You are a strict Data Analytics and Visualization Agent using R/ggplot2.

TASK: Create ${chartDesc} for this request: "${prompt}"

${dataSection}

VISUAL STYLE - Black & White / Grayscale:
- Use theme_minimal(base_size = 13) or theme_classic(base_size = 13)
- White background, minimal grid (#e8e8e8 lines or none)
- FILL SCALE RULES (wrong scale = immediate crash):
  • Discrete fill (bar, boxplot, violin, grouped charts, pie) → scale_fill_grey(start=0.15, end=0.85)
  • Continuous fill (heatmap, density2d, raster, any numeric fill) → scale_fill_gradient(low="grey95", high="grey10")  OR  scale_fill_gradient2(low="grey90", mid="white", high="grey10", midpoint=0)
  • NEVER use scale_fill_grey() when aes(fill=<numeric_column>) - it will crash with "continuous values supplied to discrete scale"
- Color scales: scale_color_grey(start=0.1, end=0.7) for discrete; scale_color_gradient(low="grey80", high="grey10") for continuous

CRITICAL CODE RULES:
1. End the script with the ggplot object \`p\` (for ggplot2), or the bare function call for base-R (circlize, treemap, wordcloud, scatterplot3d, lattice).
2. NEVER call png(), pdf(), ggsave(), cairo_pdf(), dev.off() - compiler captures the graphics device automatically.
3. set.seed(42) before any random generation.
4. Prevent text overlap with ggrepel::geom_text_repel when labeling many points.
5. Keep code under 90 lines.
6. Always filter NA before plotting: filter(!is.na(col)) or na.omit().
7. For heatmaps: melt/pivot to long format first, then geom_tile() + scale_fill_gradient2().

ABSOLUTELY BANNED (produce HTML/widget output, NOT a PNG image):
- plotly / ggplotly() / plot_ly()
- htmlwidgets / networkD3 / sankeyNetwork() / forceNetwork()
- leaflet / dygraphs / rbokeh / highcharter
Instead use: ggalluvial (Sankey), ggraph/igraph (network/arc), scatterplot3d (3D scatter), lattice wireframe (3D surface).

ARC DIAGRAM / NETWORK - safe pattern (do NOT use custom left_join or manual coord tables):
  library(igraph); library(ggraph)
  edges <- data.frame(from=c("A","B"), to=c("B","C"), weight=c(1,2))
  g <- graph_from_data_frame(edges, directed=FALSE)
  ggraph(g, layout="linear") +
    geom_edge_arc(aes(width=weight), color="grey50", alpha=0.7) +
    geom_node_point(size=5, color="grey30") +
    geom_node_text(aes(label=name), vjust=-1, size=3) + theme_void()

${knowledge}

OUTPUT: Only pure executable R code. No markdown fences. No commentary.`;
}

function buildSuggestPrompt(prompt: string, combinedContext: string, maxCharts = 4): string {
    const hasData = combinedContext.length > 50 && !isGarbage(combinedContext);
    return `You are a data visualization expert. Given the user's request and optionally their data, suggest the best R chart types.

User request: "${prompt}"
${hasData ? `\nData preview:\n${combinedContext.slice(0, 3000)}\n` : "\nNo data provided.\n"}

Respond ONLY with valid JSON (no markdown):
{"charts": ["chart_id_1", "chart_id_2", ...], "reasoning": "1-2 sentence explanation"}

Available chart ids:
Distribution: violin, density, histogram, boxplot, ridgeline, beeswarm
Correlation: scatter, heatmap, correlogram, bubble, connected_scatter, density2d, marginal
Ranking: bar, radar, wordcloud, parallel, lollipop, circular_barplot, dumbbell
Part-to-whole: grouped_bar, stacked_bar, treemap, doughnut, pie, dendrogram, circlepack, waffle
Evolution: line, area, stacked_area, streamchart, timeseries
Map: choropleth, hexbin_map, cartogram, connection_map, bubble_map
Flow: chord, network, sankey, arc_diagram, edge_bundling
3D: 3d_scatter, 3d_surface

Pick ${maxCharts <= 4 ? "2-4" : `up to ${maxCharts}`} that best fit the data shape and question. Order by relevance.`;
}

// ── OpenAI fetch with exponential backoff ────────────────────────────────────
// Retries on 429 (rate limit) and 5xx (transient server errors / HTML responses).
// Also retries if the response body is HTML instead of JSON.

async function callOpenAI(
    apiKey: string,
    body: object,
    timeoutMs = 60_000,
    maxAttempts = 4,
): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
    const RETRY_STATUSES = new Set([429, 500, 502, 503, 524, 0]);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const backoffMs = attempt > 0 ? Math.min(2 ** attempt * 1500, 16_000) : 0;
        if (backoffMs > 0) {
            await new Promise(r => setTimeout(r, backoffMs));
        }

        let res: Response;
        try {
            res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (err: any) {
            const isLast = attempt === maxAttempts - 1;
            if (isLast) return { ok: false, error: `Network error: ${err?.message ?? "timeout"}` };
            continue; // retry on network / timeout
        }

        const rawText = await res.text();

        // Detect HTML response (Cloudflare, CDN error page, etc.)
        if (rawText.trimStart().startsWith("<")) {
            const isLast = attempt === maxAttempts - 1;
            if (!isLast && (res.status === 0 || RETRY_STATUSES.has(res.status) || res.status >= 500)) continue;
            return { ok: false, error: `OpenAI returned HTML (status ${res.status}) - likely a rate limit or outage` };
        }

        let data: any;
        try {
            data = JSON.parse(rawText);
        } catch {
            const isLast = attempt === maxAttempts - 1;
            if (!isLast) continue;
            return { ok: false, error: `OpenAI returned non-JSON response (status ${res.status})` };
        }

        if (!res.ok) {
            const isLast = attempt === maxAttempts - 1;
            if (!isLast && RETRY_STATUSES.has(res.status)) continue;
            return { ok: false, error: `OpenAI HTTP ${res.status}: ${data?.error?.message ?? rawText.slice(0, 200)}` };
        }

        return { ok: true, data };
    }

    return { ok: false, error: "OpenAI: max retries exceeded" };
}

// ── Logger ────────────────────────────────────────────────────────────────────

function rLog(sessionId: string, chartId: string, msg: string, extra?: Record<string, unknown>) {
    const ts = new Date().toISOString();
    const prefix = `[R][${sessionId.slice(0, 8)}][${chartId}]`;
    if (extra) {
        console.log(`${ts} ${prefix} ${msg}`, JSON.stringify(extra));
    } else {
        console.log(`${ts} ${prefix} ${msg}`);
    }
}

// ── Background multi-chart generation (fire-and-forget) ───────────────────────

async function runMultiGeneration(params: {
    sessionId: string;
    userId: number;
    prompt: string;
    chartsToGenerate: string[];
    combinedContext: string;
    rFileNames: string[];
    rFiles: { name: string; content_b64: string }[];
    contextImages: string[];
    knowledge: string;
    apiKey: string;
}): Promise<void> {
    const {
        sessionId, userId, prompt, chartsToGenerate,
        combinedContext, rFileNames, rFiles, contextImages, knowledge, apiKey,
    } = params;

    console.log(`${new Date().toISOString()} [R][${sessionId.slice(0, 8)}] Starting session - ${chartsToGenerate.length} charts: ${chartsToGenerate.join(", ")}`);
    if (rFileNames.length > 0) {
        console.log(`${new Date().toISOString()} [R][${sessionId.slice(0, 8)}] Files: ${rFileNames.join(", ")}`);
    }

    const systemPrompt = `You are an expert R programmer. Output ONLY raw executable R code. No markdown fences. No commentary.`;

    // Initialize all charts as pending immediately - client sees full list on first poll
    const results: RResultItem[] = chartsToGenerate.map(id => ({
        chartType: id,
        name: id.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        image: "", code: "", status: "pending",
    }));
    await updateRSession(sessionId, { results_json: JSON.stringify(results) });

    let successCount = 0;

    for (let i = 0; i < chartsToGenerate.length; i++) {
        const chartId = chartsToGenerate[i];
        const chartName = results[i].name;
        const chartStart = Date.now();

        rLog(sessionId, chartId, `[${i + 1}/${chartsToGenerate.length}] Starting`);

        // Mark as generating so client shows spinner for this chart
        results[i] = { ...results[i], status: "generating" };
        await updateRSession(sessionId, { results_json: JSON.stringify(results) });

        let finalResult: RResultItem | null = null;
        let lastCode = "";
        let lastError = "";

        // Attempt generation + 1 auto-retry on failure with error feedback
        for (let attempt = 0; attempt <= 1 && !finalResult; attempt++) {
            if (attempt > 0) {
                rLog(sessionId, chartId, `Retry attempt ${attempt} - previous error: ${lastError.slice(0, 200)}`);
            }

            try {
                const userPrompt = buildGeneratePrompt(prompt, chartId, combinedContext, knowledge, rFileNames);
                const baseContent: any = contextImages.length > 0
                    ? [
                        { type: "text", text: userPrompt },
                        ...contextImages.map(img => ({ type: "image_url", image_url: { url: img, detail: "low" } })),
                      ]
                    : userPrompt;

                const messages: any[] = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: baseContent },
                ];

                // On retry: feed previous error back to LLM so it can self-correct
                if (attempt > 0 && lastCode && lastError) {
                    messages.push(
                        { role: "assistant", content: lastCode },
                        { role: "user", content: `That code produced this R error:\n\n${lastError}\n\nFix ALL errors. Output ONLY pure R code.` },
                    );
                }

                rLog(sessionId, chartId, `Calling AI (attempt ${attempt + 1})`);
                const aiStart = Date.now();

                const aiResult = await callOpenAI(apiKey, { model: MODEL, messages });

                if (!aiResult.ok) {
                    lastError = aiResult.error;
                    rLog(sessionId, chartId, `AI failed`, { error: lastError });
                    continue;
                }

                const aiData = aiResult.data;
                const tokens = aiData.usage?.total_tokens ?? 0;
                const aiMs = Date.now() - aiStart;
                rLog(sessionId, chartId, `AI ok`, { ms: aiMs, tokens, finish: aiData.choices?.[0]?.finish_reason });

                const code = cleanCode(aiData.choices?.[0]?.message?.content ?? "");
                if (!code) {
                    lastError = "AI returned empty code.";
                    rLog(sessionId, chartId, `Empty code from AI`);
                    continue;
                }
                lastCode = code;
                rLog(sessionId, chartId, `Code: ${code.split("\n").length} lines`);

                rLog(sessionId, chartId, `Compiling`);
                const compileStart = Date.now();

                const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: wrapRCode(code), files: rFiles }),
                    signal: AbortSignal.timeout(45_000),
                });

                if (!compileRes.ok) {
                    lastError = `Compiler HTTP ${compileRes.status}`;
                    rLog(sessionId, chartId, `Compiler HTTP error`, { status: compileRes.status });
                    continue;
                }

                const result = await compileRes.json();
                const compileMs = Date.now() - compileStart;

                if (!result.success) {
                    lastError = result.log || "R execution failed.";
                    rLog(sessionId, chartId, `R execution failed`, { ms: compileMs, log: lastError.slice(0, 500) });
                    continue;
                }

                rLog(sessionId, chartId, `Compiled ok`, { ms: compileMs });

                if (tokens > 0) await checkAndDeductUsage(userId, "visuals", tokens);

                finalResult = { chartType: chartId, name: chartName, image: result.image, code, status: "done" };
                successCount++;
                rLog(sessionId, chartId, `Done in ${Date.now() - chartStart}ms`);

            } catch (err: any) {
                lastError = err?.message || "Unknown error";
                rLog(sessionId, chartId, `Exception (attempt ${attempt + 1})`, { error: lastError });
            }
        }

        if (!finalResult) {
            rLog(sessionId, chartId, `All attempts failed - final error: ${lastError.slice(0, 300)}`);
        }

        results[i] = finalResult ?? {
            chartType: chartId, name: chartName, image: "", code: lastCode,
            status: "error", error: lastError,
        };
        await updateRSession(sessionId, { results_json: JSON.stringify(results) });
    }

    await updateRSession(sessionId, { status: "done" });
    console.log(`${new Date().toISOString()} [R][${sessionId.slice(0, 8)}] Session complete - ${successCount}/${chartsToGenerate.length} succeeded`);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const precheck = await checkAndDeductUsage(userId, "visuals", 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ error: "LIMIT_REACHED", details: "Visual limit reached." }, { status: 402 });
    }

    if (!OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const {
        action = "generate",
        prompt,
        chartType = "",
        chartTypes,
        contextFiles = [],
        previousCode,
        previousError,
    } = body;

    type ContextFile = { name: string; content: string; rFileName?: string; fileData?: string; images?: string[] };
    const files = contextFiles as ContextFile[];

    // Schema snippets for prompt context (column names + 3-row sample)
    const combinedContext = files
        .map(f => f.content.slice(0, 2_000))
        .join("\n\n");

    // Files to pass directly into R working directory
    const rFiles = files
        .filter(f => f.fileData)
        .map(f => ({ name: f.rFileName || f.name, content_b64: f.fileData as string }));

    const rFileNames = rFiles.map(f => f.name);

    const contextImages: string[] = files
        .flatMap(f => f.images ?? [])
        .slice(0, 10);

    // ── SUGGEST mode ──────────────────────────────────────────────────────────
    if (action === "suggest") {
        if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

        const aiResult = await callOpenAI(OPENAI_API_KEY, {
            model: MODEL,
            messages: [
                { role: "system", content: "You are a data visualization expert. Output only valid JSON." },
                { role: "user", content: buildSuggestPrompt(prompt, combinedContext) },
            ],
        }, 30_000);

        if (!aiResult.ok) return NextResponse.json({ error: "Suggestion failed." }, { status: 500 });

        const data = aiResult.data;
        let raw = data.choices?.[0]?.message?.content ?? "{}";
        raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

        try {
            const parsed = JSON.parse(raw);
            return NextResponse.json({
                charts: parsed.charts ?? ["bar", "histogram", "scatter"],
                reasoning: parsed.reasoning ?? "",
            });
        } catch {
            return NextResponse.json({ charts: ["bar", "histogram", "heatmap"], reasoning: "" });
        }
    }

    // ── MULTI mode - fire-and-forget ──────────────────────────────────────────
    if (action === "multi") {
        if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

        const user = await getUserById(userId);
        const planTier = (user?.plan_tier ?? "free") as string;
        const planLimits: Record<string, number> = { free: 1, plus: 3, pro: 10, ultra: 15 };
        const maxCharts = planLimits[planTier] ?? 1;

        // Determine chart list
        let chartsToGenerate: string[];
        if (Array.isArray(chartTypes) && chartTypes.length > 0) {
            chartsToGenerate = chartTypes.slice(0, maxCharts);
        } else {
            const suggestResult = await callOpenAI(OPENAI_API_KEY, {
                model: MODEL,
                messages: [
                    { role: "system", content: "You are a data visualization expert. Output only valid JSON." },
                    { role: "user", content: buildSuggestPrompt(prompt, combinedContext, maxCharts) },
                ],
            }, 30_000);

            let suggestedCharts: string[] = ["bar", "histogram", "scatter"];
            if (suggestResult.ok) {
                let raw = suggestResult.data.choices?.[0]?.message?.content ?? "{}";
                raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
                try { suggestedCharts = JSON.parse(raw).charts ?? suggestedCharts; } catch { /* use defaults */ }
            }
            chartsToGenerate = suggestedCharts.slice(0, maxCharts);
        }

        // Create session - visible in sidebar immediately
        const session = await createRSession({ userId, title: makeTitle(prompt), prompt });

        // Fire background job - does NOT block the response
        runMultiGeneration({
            sessionId: session.id,
            userId,
            prompt,
            chartsToGenerate,
            combinedContext,
            rFileNames,
            rFiles,
            contextImages,
            knowledge: getVisualKnowledge(),
            apiKey: OPENAI_API_KEY,
        }).catch(async () => {
            await updateRSession(session.id, { status: "error" });
        });

        // Return immediately - client will poll
        return NextResponse.json({
            sessionId: session.id,
            chartsPlanned: chartsToGenerate,
        });
    }

    // ── GENERATE mode (single chart) - synchronous ────────────────────────────
    if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

    const knowledge = getVisualKnowledge();
    const systemPrompt = `You are an expert R programmer. Output ONLY raw executable R code. No markdown fences. No commentary.`;
    const userPrompt = buildGeneratePrompt(prompt, chartType, combinedContext, knowledge, rFileNames);

    const userContent: any = contextImages.length > 0
        ? [
            { type: "text", text: userPrompt },
            ...contextImages.map(img => ({ type: "image_url", image_url: { url: img, detail: "low" } })),
          ]
        : userPrompt;

    const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
    ];

    if (previousError && previousCode) {
        messages.push(
            { role: "assistant", content: previousCode },
            { role: "user", content: `That code produced this R error:\n\n${previousError}\n\nFix ALL errors. Output ONLY pure R code.` },
        );
    }

    const session = await createRSession({ userId, title: makeTitle(prompt), prompt });
    const sid = session.id.slice(0, 8);
    console.log(`${new Date().toISOString()} [R][${sid}] Single chart: ${chartType || "auto"}`);

    const aiStart = Date.now();
    const aiResult = await callOpenAI(OPENAI_API_KEY, { model: MODEL, messages });

    if (!aiResult.ok) {
        console.error(`${new Date().toISOString()} [R][${sid}] AI failed: ${aiResult.error}`);
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: aiResult.error }, { status: 500 });
    }

    const aiData = aiResult.data;
    const tokens = aiData.usage?.total_tokens ?? 0;
    console.log(`${new Date().toISOString()} [R][${sid}] AI ok - ${Date.now() - aiStart}ms, tokens=${tokens}`);

    const code = cleanCode(aiData.choices?.[0]?.message?.content ?? "");
    if (!code) {
        console.error(`${new Date().toISOString()} [R][${sid}] Empty code from AI`);
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: "AI returned empty code." }, { status: 500 });
    }

    console.log(`${new Date().toISOString()} [R][${sid}] Code: ${code.split("\n").length} lines - compiling`);
    const compileStart = Date.now();

    const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: wrapRCode(code), files: rFiles }),
        signal: AbortSignal.timeout(45_000),
    });

    if (!compileRes.ok) {
        console.error(`${new Date().toISOString()} [R][${sid}] Compiler HTTP ${compileRes.status}`);
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: "R compiler error.", code }, { status: 500 });
    }

    const result = await compileRes.json();
    if (!result.success) {
        console.error(`${new Date().toISOString()} [R][${sid}] R execution failed (${Date.now() - compileStart}ms): ${(result.log || "").slice(0, 500)}`);
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: result.log || "R execution failed.", code }, { status: 422 });
    }

    console.log(`${new Date().toISOString()} [R][${sid}] Compiled ok - ${Date.now() - compileStart}ms`);

    if (tokens > 0) await checkAndDeductUsage(userId, "visuals", tokens);

    const chartName = (chartType || "chart").replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
    const resultItem: RResultItem = { chartType: chartType || "chart", name: chartName, image: result.image, code, status: "done" };
    await updateRSession(session.id, { results_json: JSON.stringify([resultItem]), status: "done" });
    console.log(`${new Date().toISOString()} [R][${sid}] Session complete`);

    return NextResponse.json({ image: result.image, code, chartType, sessionId: session.id });
}
