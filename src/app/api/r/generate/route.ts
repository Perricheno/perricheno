// R Studio — generate + compile R visualization.
// Accepts optional contextFiles (CSV/text data) and uses real data in the prompt.

import { NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { checkAndDeductUsage } from "@/lib/db";
import { getVisualKnowledge } from "@/lib/agent/knowledge/loader";

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

function buildSuggestPrompt(prompt: string, combinedContext: string): string {
    const hasData = combinedContext.length > 50 && !isGarbage(combinedContext);
    return `You are a data visualization expert. Given the user's request and optionally their data, suggest the best R chart types.

User request: "${prompt}"
${hasData ? `\nData preview:\n${combinedContext.slice(0, 3000)}\n` : "\nNo data provided.\n"}

Respond ONLY with valid JSON (no markdown):
{"charts": ["chart_id_1", "chart_id_2", "chart_id_3"], "reasoning": "1-2 sentence explanation"}

Available chart ids: bar, histogram, boxplot, violin, lollipop, dumbbell, bubble, density2d, marginal, heatmap, parallel, radar, sankey, chord, circlepack, dendrogram, waffle, wordcloud, 3d_scatter, 3d_surface

Pick 2-4 that best fit the data shape and question. Order by relevance.`;
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
        contextFiles = [],   // [{name: string, content: string, images?: string[]}]
        previousCode,
        previousError,
    } = body;

    // Combined data context from uploaded files (cap each at 15 000 chars)
    const combinedContext = (contextFiles as { name: string; content: string; images?: string[] }[])
        .map(f => `--- ${f.name} ---\n${f.content.slice(0, 15_000)}`)
        .join("\n\n");

    // Collect PDF/Office page images (cap at 10 pages to stay within context limits)
    const contextImages: string[] = (contextFiles as { images?: string[] }[])
        .flatMap(f => f.images ?? [])
        .slice(0, 10);

    // Hard-stop if file extraction clearly failed
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

    // ── GENERATE mode ─────────────────────────────────────────────────────────
    if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

    const knowledge = getVisualKnowledge();
    const systemPrompt = `You are an expert R programmer. Output ONLY raw executable R code. No markdown fences. No commentary.`;
    const userPrompt = buildGeneratePrompt(prompt, chartType, combinedContext, knowledge);

    // If PDF pages were uploaded, send them as vision content so the model can read tables/figures
    const userContent: any = contextImages.length > 0
        ? [
            { type: "text", text: userPrompt },
            ...contextImages.map(img => ({
                type: "image_url",
                image_url: { url: img, detail: "low" },
            })),
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

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: MODEL, messages }),
        signal: AbortSignal.timeout(60_000),
    });

    if (!aiRes.ok) {
        const err = await aiRes.text();
        return NextResponse.json({ error: "AI generation failed: " + err.slice(0, 200) }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const code = cleanCode(aiData.choices?.[0]?.message?.content ?? "");
    if (!code) return NextResponse.json({ error: "AI returned empty code." }, { status: 500 });

    const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: wrapRCode(code) }),
        signal: AbortSignal.timeout(45_000),
    });

    if (!compileRes.ok) return NextResponse.json({ error: "R compiler error.", code }, { status: 500 });

    const result = await compileRes.json();
    if (!result.success) {
        return NextResponse.json({ error: result.log || "R execution failed.", code }, { status: 422 });
    }

    const tokens = aiData.usage?.total_tokens ?? 0;
    if (tokens > 0) await checkAndDeductUsage(userId, "visuals", tokens);

    return NextResponse.json({ image: result.image, code, chartType });
}
