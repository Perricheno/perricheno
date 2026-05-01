// R Studio page — generate + compile R visualization in one shot.
// Uses the R knowledge base and enforces B&W aesthetics.

import { NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { checkAndDeductUsage } from "@/lib/db";
import { getVisualKnowledge } from "@/lib/agent/knowledge/loader";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const R_COMPILER_URL = process.env.R_COMPILER_URL || "http://r-compiler:8000";
const MODEL = "gpt-5-mini-2025-08-07";

const CHART_DESCRIPTIONS: Record<string, string> = {
    bar:          "a bar/column chart showing categorical comparisons",
    histogram:    "a histogram showing the distribution of a continuous variable",
    boxplot:      "a boxplot showing statistical distribution and outliers across groups",
    violin:       "a violin plot showing probability density and distribution shape",
    heatmap:      "a heatmap or correlation matrix",
    lollipop:     "a lollipop / dot-stem chart for ranked comparisons",
    dumbbell:     "a dumbbell plot showing change between two points in time",
    density2d:    "a 2D kernel density / contour plot",
    bubble:       "a bubble chart with a third dimension encoded as circle size",
    scatter:      "a scatter plot showing the relationship between two variables",
    line:         "a line chart showing trends over time",
    radar:        "a radar / spider chart for multivariate comparison",
    sankey:       "a Sankey / alluvial flow diagram",
    chord:        "a chord diagram showing relationships between groups",
    wordcloud:    "a word cloud showing term frequencies",
    waffle:       "a waffle chart showing part-to-whole relationships",
    dendrogram:   "a hierarchical clustering dendrogram",
    parallel:     "a parallel coordinates plot for multivariate data",
    marginal:     "a scatter plot with marginal histograms on each axis",
    circlepack:   "a circle packing chart for hierarchical proportions",
    "3d_scatter": "a 3D scatter plot",
    "3d_surface": "a 3D surface / mesh plot",
};

function wrapRCode(raw: string): string {
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

# Generated code
${raw}`;
}

function cleanCode(raw: string): string {
    let c = raw.trim();
    c = c.replace(/^```(?:r|R)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    return c.trim();
}

function buildSystemPrompt(knowledge: string): string {
    return `You are an expert R visualization programmer specializing in ggplot2 and the R statistical ecosystem.

OUTPUT: Only pure, executable R code. No markdown fences. No comments starting with #. No commentary outside code.

CRITICAL RULES:
- Always end the script with the plot object \`p\` (for ggplot2) or let the final expression be the rendering call (for base-R plots like radarchart, wordcloud, chordDiagram).
- NEVER call \`png()\`, \`pdf()\`, \`dev.off()\`, \`ggsave()\`. The compiler captures output automatically.
- Always set \`set.seed(42)\` before any random data generation.
- Generate all data inline — no external file dependencies.
- Default to a clean black-and-white / grayscale aesthetic: \`theme_minimal()\`, \`scale_fill_grey()\`, \`scale_color_grey()\`.
- Use \`ggrepel::geom_text_repel\` when labels might overlap.
- Keep the script concise (under 80 lines).
${knowledge}`;
}

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const precheck = await checkAndDeductUsage(userId, "visuals", 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ error: "LIMIT_REACHED", details: "Visual limit reached." }, { status: 402 });
    }

    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
    }

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { prompt, chartType = "", previousCode, previousError } = body;
    if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

    const chartDesc = CHART_DESCRIPTIONS[chartType] || (chartType ? `a ${chartType} visualization` : "the most appropriate chart type");
    const knowledge = getVisualKnowledge();
    const systemPrompt = buildSystemPrompt(knowledge);

    const userPrompt = [
        chartType ? `Create ${chartDesc}.` : "Choose the best chart type for the task.",
        `Topic / request: "${prompt.trim()}"`,
        "Generate realistic synthetic data unless the prompt includes actual data.",
        "Use the B&W / grayscale aesthetic.",
    ].join("\n");

    const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ];

    if (previousError && previousCode) {
        messages.push(
            { role: "assistant", content: previousCode },
            { role: "user", content: `That code produced this error:\n\n${previousError}\n\nFix it. Output ONLY pure R code.` },
        );
    }

    // ── 1. Generate R code ──
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: MODEL, messages, stream: false }),
        signal: AbortSignal.timeout(60_000),
    });

    if (!aiRes.ok) {
        const err = await aiRes.text();
        return NextResponse.json({ error: "AI generation failed: " + err.slice(0, 200) }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const rawCode = aiData.choices?.[0]?.message?.content ?? "";
    const code = cleanCode(rawCode);
    if (!code) return NextResponse.json({ error: "AI returned empty code." }, { status: 500 });

    // ── 2. Compile ──
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

    // ── 3. Bill ──
    const inputTokens = aiData.usage?.total_tokens ?? 0;
    if (inputTokens > 0) await checkAndDeductUsage(userId, "visuals", inputTokens);

    return NextResponse.json({ image: result.image, code, chartType });
}
