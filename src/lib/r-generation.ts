// Shared helpers for R Studio chart generation, used by both
// src/app/api/r/generate/route.ts (suggest + single-chart synchronous modes)
// and src/lib/jobs/rMultiGenerate.ts (queued multi-chart job, Phase 6a).
// Extracted from r/generate/route.ts so both call sites stay in sync instead
// of duplicating prompt/compile logic.

export const MODEL = "gpt-5.6-terra";
export const R_COMPILER_URL = process.env.R_COMPILER_URL || "http://r-compiler:8000";

export function wrapRCode(raw: string): string {
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

export function cleanCode(raw: string): string {
    let c = raw.trim();
    c = c.replace(/^```(?:r|R)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    return c.trim();
}

export function isGarbage(text: string): boolean {
    return /[\x00-\x08\x0E-\x1F]{5,}|(%[0-9A-Fa-f]{2}){10,}/.test(text.slice(0, 500));
}

export function makeTitle(prompt: string): string {
    return prompt.slice(0, 80).trim();
}

export function buildGeneratePrompt(
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

export function buildSuggestPrompt(prompt: string, combinedContext: string, maxCharts = 4): string {
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

export async function callOpenAI(
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

export function rLog(sessionId: string, chartId: string, msg: string, extra?: Record<string, unknown>) {
    const ts = new Date().toISOString();
    const prefix = `[R][${sessionId.slice(0, 8)}][${chartId}]`;
    if (extra) {
        console.log(`${ts} ${prefix} ${msg}`, JSON.stringify(extra));
    } else {
        console.log(`${ts} ${prefix} ${msg}`);
    }
}
