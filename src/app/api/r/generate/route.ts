// R Studio — generate + compile R visualization.
// Accepts optional contextFiles (CSV/text data) and uses real data in the prompt.

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
): string {
    const hasRealData = combinedContext.length > 50 && !isGarbage(combinedContext);
    const chartDesc = chartType
        ? `a **${chartType.replace(/_/g, " ").toUpperCase()}** chart`
        : "the most appropriate chart type";

    return `You are a strict Data Analytics and Visualization Agent using R/ggplot2.

TASK: Create ${chartDesc} for this request: "${prompt}"

**DATA QUALITY CHECK** (MANDATORY):
- If the context below looks like binary garbage, garbled text, base64, hex, or unreadable characters — DO NOT attempt to parse it. Extraction failed.
- NEVER try to parse filenames or metadata markers as actual data.
- If context is plain readable text (not tabular), extract key facts/numbers and build a data.frame manually.

${hasRealData
    ? `USER PROVIDED DATASET — YOU MUST USE THIS ACTUAL DATA:\n${combinedContext}\n\n**CRITICAL**: Parse and use the data above. DO NOT invent synthetic data.`
    : "No dataset provided — generate realistic synthetic data with set.seed(42)."}

VISUAL STYLE — Black & White / Grayscale:
- Use theme_minimal(base_size = 13) or theme_classic(base_size = 13)
- Use scale_fill_grey(start = 0.15, end = 0.85) for fills
- Use scale_color_grey(start = 0.1, end = 0.7) for lines/points
- White background, minimal grid (#e8e8e8 lines or none)

CRITICAL CODE RULES:
1. End the script with the ggplot object \`p\` (for ggplot2), or let the rendering function be the last call (for base-R plots).
2. NEVER call png(), pdf(), ggsave(), cairo_pdf(), dev.off() — compiler captures output.
3. NEVER reference external files or paths.
4. set.seed(42) before any random generation.
5. Prevent text overlap with ggrepel::geom_text_repel when labeling many points.
6. Keep code under 80 lines.

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

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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

    const combinedContext = (contextFiles as { name: string; content: string; images?: string[] }[])
        .map(f => `--- ${f.name} ---\n${f.content.slice(0, 15_000)}`)
        .join("\n\n");

    const contextImages: string[] = (contextFiles as { images?: string[] }[])
        .flatMap(f => f.images ?? [])
        .slice(0, 10);

    if (contextFiles.length > 0 && (combinedContext.includes("Failed to extract") || combinedContext.includes("[Failed"))) {
        return NextResponse.json({ error: "File extraction failed. Please upload a readable CSV, TSV, or Excel file." }, { status: 400 });
    }

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

    // ── MULTI mode ────────────────────────────────────────────────────────────
    if (action === "multi") {
        if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

        const user = await getUserById(userId);
        const planTier = (user?.plan_tier ?? "free") as string;
        const planLimits: Record<string, number> = {
            free: 1,
            plus: 3,
            pro: 10,
            ultra: 15,
        };
        const maxCharts = planLimits[planTier] ?? 1;

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
                try {
                    const parsed = JSON.parse(raw);
                    suggestedCharts = parsed.charts ?? suggestedCharts;
                } catch { /* use defaults */ }
            }
            chartsToGenerate = suggestedCharts.slice(0, maxCharts);
        }

        // Create session in DB before streaming
        const session = await createRSession({
            userId,
            title: makeTitle(prompt),
            prompt,
        });

        const knowledge = getVisualKnowledge();
        const systemPrompt = `You are an expert R programmer. Output ONLY raw executable R code. No markdown fences. No commentary.`;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

                // Announce session ID first so client can track it
                enqueue(sseEvent("session_created", { sessionId: session.id }));

                enqueue(sseEvent("stage", { stage: 1, total: 3, label: "Analyse", status: "done" }));
                enqueue(sseEvent("stage", { stage: 2, total: 3, label: "Plan", status: "done",
                    charts: chartsToGenerate }));
                enqueue(sseEvent("stage", { stage: 3, total: 3, label: "Visualize", status: "running",
                    progress: { done: 0, total: chartsToGenerate.length } }));

                // Accumulate results to persist incrementally
                const results: RResultItem[] = [];

                for (let i = 0; i < chartsToGenerate.length; i++) {
                    const chartId = chartsToGenerate[i];
                    const chartName = chartId.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

                    enqueue(sseEvent("status", {
                        id: `chart-${i}`,
                        label: chartName,
                        status: "running",
                        log: `Generating ${chartName}…`,
                    }));

                    try {
                        const userPrompt = buildGeneratePrompt(prompt, chartId, combinedContext, knowledge);
                        const userContent: any = contextImages.length > 0
                            ? [
                                { type: "text", text: userPrompt },
                                ...contextImages.map(img => ({ type: "image_url", image_url: { url: img, detail: "low" } })),
                              ]
                            : userPrompt;

                        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
                            body: JSON.stringify({
                                model: MODEL,
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: userContent },
                                ],
                            }),
                            signal: AbortSignal.timeout(60_000),
                        });

                        if (!aiRes.ok) {
                            const item: RResultItem = { chartType: chartId, name: chartName, image: "", code: "", status: "error", error: "AI generation failed." };
                            results[i] = item;
                            await updateRSession(session.id, { results_json: JSON.stringify(results.filter(Boolean)) });
                            enqueue(sseEvent("chart_error", { index: i, chartType: chartId, error: "AI generation failed." }));
                            enqueue(sseEvent("status", { id: `chart-${i}`, label: chartName, status: "error", log: "AI generation failed." }));
                            continue;
                        }

                        const aiData = await aiRes.json();
                        const code = cleanCode(aiData.choices?.[0]?.message?.content ?? "");
                        if (!code) {
                            const item: RResultItem = { chartType: chartId, name: chartName, image: "", code: "", status: "error", error: "AI returned empty code." };
                            results[i] = item;
                            await updateRSession(session.id, { results_json: JSON.stringify(results.filter(Boolean)) });
                            enqueue(sseEvent("chart_error", { index: i, chartType: chartId, error: "AI returned empty code." }));
                            enqueue(sseEvent("status", { id: `chart-${i}`, label: chartName, status: "error", log: "Empty code." }));
                            continue;
                        }

                        const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ code: wrapRCode(code) }),
                            signal: AbortSignal.timeout(45_000),
                        });

                        if (!compileRes.ok) {
                            const item: RResultItem = { chartType: chartId, name: chartName, image: "", code, status: "error", error: "R compiler error." };
                            results[i] = item;
                            await updateRSession(session.id, { results_json: JSON.stringify(results.filter(Boolean)) });
                            enqueue(sseEvent("chart_error", { index: i, chartType: chartId, error: "R compiler error.", code }));
                            enqueue(sseEvent("status", { id: `chart-${i}`, label: chartName, status: "error", log: "R compiler error." }));
                            continue;
                        }

                        const result = await compileRes.json();
                        if (!result.success) {
                            const item: RResultItem = { chartType: chartId, name: chartName, image: "", code, status: "error", error: result.log || "R execution failed." };
                            results[i] = item;
                            await updateRSession(session.id, { results_json: JSON.stringify(results.filter(Boolean)) });
                            enqueue(sseEvent("chart_error", { index: i, chartType: chartId, error: result.log || "R execution failed.", code }));
                            enqueue(sseEvent("status", { id: `chart-${i}`, label: chartName, status: "error", log: result.log || "R execution failed." }));
                            continue;
                        }

                        const tokens = aiData.usage?.total_tokens ?? 0;
                        if (tokens > 0) await checkAndDeductUsage(userId, "visuals", tokens);

                        const item: RResultItem = { chartType: chartId, name: chartName, image: result.image, code, status: "done" };
                        results[i] = item;
                        // Persist incrementally — sidebar reflects live progress
                        await updateRSession(session.id, { results_json: JSON.stringify(results.filter(Boolean)) });

                        enqueue(sseEvent("chart_done", {
                            index: i,
                            chartType: chartId,
                            image: result.image,
                            code,
                        }));
                        enqueue(sseEvent("status", { id: `chart-${i}`, label: chartName, status: "done", log: "Done." }));

                    } catch (err: any) {
                        const msg = err?.message || "Unknown error";
                        const item: RResultItem = { chartType: chartId, name: chartName, image: "", code: "", status: "error", error: msg };
                        results[i] = item;
                        await updateRSession(session.id, { results_json: JSON.stringify(results.filter(Boolean)) });
                        enqueue(sseEvent("chart_error", { index: i, chartType: chartId, error: msg }));
                        enqueue(sseEvent("status", { id: `chart-${i}`, label: chartName, status: "error", log: msg }));
                    }

                    enqueue(sseEvent("stage", { stage: 3, total: 3, label: "Visualize", status: "running",
                        progress: { done: i + 1, total: chartsToGenerate.length } }));
                }

                // Finalize session
                await updateRSession(session.id, { status: "done" });

                enqueue(sseEvent("stage", { stage: 3, total: 3, label: "Visualize", status: "done",
                    progress: { done: chartsToGenerate.length, total: chartsToGenerate.length } }));
                enqueue(sseEvent("all_done", { total: chartsToGenerate.length, sessionId: session.id }));
                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    }

    // ── GENERATE mode (single chart) ──────────────────────────────────────────
    if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

    const knowledge = getVisualKnowledge();
    const systemPrompt = `You are an expert R programmer. Output ONLY raw executable R code. No markdown fences. No commentary.`;
    const userPrompt = buildGeneratePrompt(prompt, chartType, combinedContext, knowledge);

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

    // Create session upfront so it's visible immediately
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
        body: JSON.stringify({ code: wrapRCode(code) }),
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
    const resultItem: RResultItem = {
        chartType: chartType || "chart",
        name: chartName,
        image: result.image,
        code,
        status: "done",
    };
    await updateRSession(session.id, {
        results_json: JSON.stringify([resultItem]),
        status: "done",
    });

    return NextResponse.json({ image: result.image, code, chartType, sessionId: session.id });
}
