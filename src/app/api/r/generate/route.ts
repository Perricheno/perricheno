// R Studio — generate + compile R visualization.
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
        ? `DATA FILES — pre-loaded into the R working directory:
${rFileNames.map(n => `  • "${n}"`).join("\n")}

READ THE DATA with (choose based on file type):
  df <- read.csv("${rFileNames[0]}")          # CSV
  df <- read.table("${rFileNames[0]}", header=TRUE, sep="\\t")  # TSV

FILE SCHEMA (use for column names — all rows are in the file, not just this sample):
${combinedContext}

RULES FOR REAL DATA:
- ALWAYS load with read.csv() / read.table() from the filename above.
- NEVER hardcode data values or build a data.frame manually from the sample.
- NEVER use synthetic or example data — the full dataset is available on disk.`
        : hasTextData
            ? `USER PROVIDED TEXT/DATA:\n${combinedContext}\n\nExtract facts/numbers and build a data.frame manually.`
            : "No dataset provided — generate realistic synthetic data with set.seed(42).";

    return `You are a strict Data Analytics and Visualization Agent using R/ggplot2.

TASK: Create ${chartDesc} for this request: "${prompt}"

${dataSection}

VISUAL STYLE — Black & White / Grayscale:
- Use theme_minimal(base_size = 13) or theme_classic(base_size = 13)
- Use scale_fill_grey(start = 0.15, end = 0.85) for fills
- Use scale_color_grey(start = 0.1, end = 0.7) for lines/points
- White background, minimal grid (#e8e8e8 lines or none)

CRITICAL CODE RULES:
1. End the script with the ggplot object \`p\` (for ggplot2), or let the rendering function be the last call (for base-R plots).
2. NEVER call png(), pdf(), ggsave(), cairo_pdf(), dev.off() — compiler captures output.
3. set.seed(42) before any random generation.
4. Prevent text overlap with ggrepel::geom_text_repel when labeling many points.
5. Keep code under 80 lines.

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

    const systemPrompt = `You are an expert R programmer. Output ONLY raw executable R code. No markdown fences. No commentary.`;

    // Initialize all charts as pending immediately — client sees full list on first poll
    const results: RResultItem[] = chartsToGenerate.map(id => ({
        chartType: id,
        name: id.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        image: "", code: "", status: "pending",
    }));
    await updateRSession(sessionId, { results_json: JSON.stringify(results) });

    for (let i = 0; i < chartsToGenerate.length; i++) {
        const chartId = chartsToGenerate[i];
        const chartName = results[i].name;

        // Mark as generating so client shows spinner for this chart
        results[i] = { ...results[i], status: "generating" };
        await updateRSession(sessionId, { results_json: JSON.stringify(results) });

        let finalResult: RResultItem | null = null;
        let lastCode = "";
        let lastError = "";

        // Attempt generation + 1 auto-retry on failure with error feedback
        for (let attempt = 0; attempt <= 1 && !finalResult; attempt++) {
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

                const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                    body: JSON.stringify({ model: MODEL, messages }),
                    signal: AbortSignal.timeout(60_000),
                });

                if (!aiRes.ok) { lastError = "AI generation failed."; continue; }

                const aiData = await aiRes.json();
                const code = cleanCode(aiData.choices?.[0]?.message?.content ?? "");
                if (!code) { lastError = "AI returned empty code."; continue; }
                lastCode = code;

                const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: wrapRCode(code), files: rFiles }),
                    signal: AbortSignal.timeout(45_000),
                });

                if (!compileRes.ok) { lastError = "R compiler error."; continue; }

                const result = await compileRes.json();
                if (!result.success) { lastError = result.log || "R execution failed."; continue; }

                const tokens = aiData.usage?.total_tokens ?? 0;
                if (tokens > 0) await checkAndDeductUsage(userId, "visuals", tokens);

                finalResult = { chartType: chartId, name: chartName, image: result.image, code, status: "done" };

            } catch (err: any) {
                lastError = err?.message || "Unknown error";
            }
        }

        results[i] = finalResult ?? {
            chartType: chartId, name: chartName, image: "", code: lastCode,
            status: "error", error: lastError,
        };
        await updateRSession(sessionId, { results_json: JSON.stringify(results) });
    }

    await updateRSession(sessionId, { status: "done" });
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

        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: "system", content: "You are a data visualization expert. Output only valid JSON." },
                    { role: "user", content: buildSuggestPrompt(prompt, combinedContext) },
                ],
            }),
            signal: AbortSignal.timeout(30_000),
        });

        if (!aiRes.ok) return NextResponse.json({ error: "Suggestion failed." }, { status: 500 });

        const data = await aiRes.json();
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

    // ── MULTI mode — fire-and-forget ──────────────────────────────────────────
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
            const suggestRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { role: "system", content: "You are a data visualization expert. Output only valid JSON." },
                        { role: "user", content: buildSuggestPrompt(prompt, combinedContext, maxCharts) },
                    ],
                }),
                signal: AbortSignal.timeout(30_000),
            });

            let suggestedCharts: string[] = ["bar", "histogram", "scatter"];
            if (suggestRes.ok) {
                const suggestData = await suggestRes.json();
                let raw = suggestData.choices?.[0]?.message?.content ?? "{}";
                raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
                try { suggestedCharts = JSON.parse(raw).charts ?? suggestedCharts; } catch { /* use defaults */ }
            }
            chartsToGenerate = suggestedCharts.slice(0, maxCharts);
        }

        // Create session — visible in sidebar immediately
        const session = await createRSession({ userId, title: makeTitle(prompt), prompt });

        // Fire background job — does NOT block the response
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

        // Return immediately — client will poll
        return NextResponse.json({
            sessionId: session.id,
            chartsPlanned: chartsToGenerate,
        });
    }

    // ── GENERATE mode (single chart) — synchronous ────────────────────────────
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

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: MODEL, messages }),
        signal: AbortSignal.timeout(60_000),
    });

    if (!aiRes.ok) {
        await updateRSession(session.id, { status: "error" });
        const err = await aiRes.text();
        return NextResponse.json({ error: "AI generation failed: " + err.slice(0, 200) }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const code = cleanCode(aiData.choices?.[0]?.message?.content ?? "");
    if (!code) {
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: "AI returned empty code." }, { status: 500 });
    }

    const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: wrapRCode(code), files: rFiles }),
        signal: AbortSignal.timeout(45_000),
    });

    if (!compileRes.ok) {
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: "R compiler error.", code }, { status: 500 });
    }

    const result = await compileRes.json();
    if (!result.success) {
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: result.log || "R execution failed.", code }, { status: 422 });
    }

    const tokens = aiData.usage?.total_tokens ?? 0;
    if (tokens > 0) await checkAndDeductUsage(userId, "visuals", tokens);

    const chartName = (chartType || "chart").replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
    const resultItem: RResultItem = { chartType: chartType || "chart", name: chartName, image: result.image, code, status: "done" };
    await updateRSession(session.id, { results_json: JSON.stringify([resultItem]), status: "done" });

    return NextResponse.json({ image: result.image, code, chartType, sessionId: session.id });
}
