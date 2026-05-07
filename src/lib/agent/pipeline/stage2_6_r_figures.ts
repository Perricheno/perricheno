// Stage 2.6 - R/Python Data Figures.
// Runs only when dataUploadIds are present.
// Combines three sub-steps in one stage:
//   a. Schema extraction  — reads column names / row counts from each data file
//   b. Figure planning    — LLM decides which analyses fit the document topic
//   c. Code generation    — LLM writes R/Python code; runtime executes it → PNG
//
// Reuses the R/Python compiler microservices already used by the analytics pipeline.
// Files are written to /tmp/analytics-data/ via the shared fileManager.

import { chatCompletion, parseJsonLoose, type ChatMessage } from "./llm";
import type { Plan, PipelineSettings, GeneratedDataFigure } from "./types";
import type { AgentUpload } from "@/lib/db";
import { saveFilesToDisk } from "@/lib/analytics/fileManager";
import { downloadTextFromStorage } from "@/lib/storage";
import { withRetry } from "../stages";

const R_COMPILER_URL   = process.env.R_COMPILER_URL   ?? "http://r-compiler:8000";
const PY_COMPILER_URL  = process.env.PYTHON_COMPILER_URL ?? "http://python-compiler:8000";

// ── Schema extraction ────────────────────────────────────────────────────────

interface DataSchema {
    uploadId: string;
    filename: string;
    filepath: string;      // on-disk path for the compiler
    columns: string[];
    rowCount: number;
    sample: string;        // header + first 5 rows for LLM context
    ext: string;
}

function extractColumnsFromCsv(text: string, delimiter = ","): { columns: string[]; rowCount: number } {
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length === 0) return { columns: [], rowCount: 0 };
    const cols = lines[0].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    return { columns: cols, rowCount: Math.max(0, lines.length - 1) };
}

async function extractSchema(upload: AgentUpload, filepath: string): Promise<DataSchema | null> {
    const ext = upload.filename.split(".").pop()?.toLowerCase() ?? "";
    let text = upload.text_content ?? "";

    if (!text && upload.storage_path) {
        try { text = await downloadTextFromStorage(upload.storage_path); } catch { return null; }
    }
    if (!text) return null;

    let columns: string[] = [];
    let rowCount = 0;

    if (ext === "csv" || ext === "xlsx" || ext === "xls") {
        ({ columns, rowCount } = extractColumnsFromCsv(text));
    } else if (ext === "tsv") {
        ({ columns, rowCount } = extractColumnsFromCsv(text, "\t"));
    } else if (ext === "json") {
        try {
            const parsed = JSON.parse(text.slice(0, 5000));
            const arr = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
            if (arr.length > 0 && typeof arr[0] === "object") {
                columns = Object.keys(arr[0]);
                rowCount = arr.length;
            }
        } catch { /* leave empty */ }
    }

    const sampleLines = text.split("\n").slice(0, 6).join("\n");
    return { uploadId: upload.id, filename: upload.filename, filepath, columns, rowCount, ext, sample: sampleLines };
}

// ── Figure planning ──────────────────────────────────────────────────────────

interface PlannedFigure {
    id: string;
    sectionHeading: string;
    analysisType: string;
    columns: string[];
    dataFile: string;      // filename (used to look up schema)
    caption: string;
    label: string;
    description: string;
}

const ACADEMIC_ANALYSIS_TYPES = [
    "scatter",        // relationship between two continuous variables
    "regression",     // regression line with confidence interval
    "histogram",      // distribution of one variable
    "boxplot",        // distribution by category
    "heatmap",        // correlation matrix
    "bar",            // categorical comparison
    "line",           // time-series or ordered data
    "violin",         // distribution by group, richer than boxplot
    "pca",            // dimensionality reduction, exploratory
    "lollipop",       // clean alternative to bar chart
    "density",        // smooth distribution curve
    "timeseries",     // data over time
];

function buildPlanningMessages(
    settings: PipelineSettings,
    plan: Plan,
    schemas: DataSchema[],
): ChatMessage[] {
    const schemaBlock = schemas.map(s =>
        `FILE: ${s.filename}  (${s.rowCount} rows, ${s.columns.length} cols)\n` +
        `Columns: ${s.columns.join(", ")}\n` +
        `Sample:\n${s.sample}`,
    ).join("\n\n---\n\n");

    const sectionList = plan.sections.map((sec, i) => `  ${i + 1}. ${sec.heading}`).join("\n");

    const system = `You are a statistical figure planner for academic documents.
Given uploaded data files and a document outline, decide which statistical figures best support the research.

Output ONLY valid JSON:
{
  "figures": [
    {
      "id": "fig_slug_unique",
      "sectionHeading": "exact section heading from the outline",
      "analysisType": "scatter|regression|histogram|boxplot|heatmap|bar|line|violin|pca|lollipop|density|timeseries",
      "columns": ["col1", "col2"],
      "dataFile": "filename.csv",
      "caption": "Caption in ${plan.language === "en" ? "English" : plan.language === "ru" ? "Russian" : "Kazakh"}",
      "label": "fig:slug_unique",
      "description": "One sentence: what insight this figure provides for the research"
    }
  ]
}

Rules:
- Plan 2–4 figures maximum. Prioritize insight over variety.
- Use ONLY column names that appear in the schema above.
- Assign each figure to the section where it is most relevant (Results, Analysis, Discussion, etc.).
- At most 1 figure per section.
- analysisType must be one of: ${ACADEMIC_ANALYSIS_TYPES.join(", ")}.
- id must be a unique slug (lowercase, underscores only, no spaces).
- label must be "fig:" + id.
- Figures must directly support the document topic.

No markdown fences. JSON only.`;

    const user = `DOCUMENT TOPIC: ${settings.prompt}
DOC TYPE: ${settings.docType}

OUTLINE:
${sectionList}

UPLOADED DATA:
${schemaBlock}

Plan the figures now:`;

    return [{ role: "system", content: system }, { role: "user", content: user }];
}

function validatePlans(raw: any, schemas: DataSchema[], sections: string[]): PlannedFigure[] {
    if (!raw || !Array.isArray(raw.figures)) return [];
    const knownFiles = new Set(schemas.map(s => s.filename));
    const knownSections = new Set(sections);
    const usedSections = new Set<string>();
    const usedIds = new Set<string>();
    const out: PlannedFigure[] = [];

    for (const f of raw.figures) {
        if (!f || typeof f !== "object") continue;
        const id = String(f.id ?? "").trim().replace(/[^a-z0-9_]/g, "_").slice(0, 50);
        if (!id || usedIds.has(id)) continue;
        const sectionHeading = String(f.sectionHeading ?? "").trim();
        if (!sectionHeading || !knownSections.has(sectionHeading)) continue;
        if (usedSections.has(sectionHeading)) continue;
        const dataFile = String(f.dataFile ?? "").trim();
        if (!knownFiles.has(dataFile)) continue;
        const analysisType = ACADEMIC_ANALYSIS_TYPES.includes(f.analysisType) ? f.analysisType : "scatter";
        const columns = Array.isArray(f.columns) ? f.columns.map(String).filter(Boolean) : [];
        const caption = String(f.caption ?? "").trim();
        const label = String(f.label ?? `fig:${id}`).trim();
        const description = String(f.description ?? "").trim();
        if (!caption) continue;

        usedIds.add(id);
        usedSections.add(sectionHeading);
        out.push({ id, sectionHeading, analysisType, columns, dataFile, caption, label, description });
    }
    return out.slice(0, 4);
}

// ── Code generation ───────────────────────────────────────────────────────────

function wrapRCode(raw: string): string {
    return `options(repos = c(CRAN = "https://packagemanager.posit.co/cran/__linux__/jammy/latest"))
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

${raw}`;
}

function buildCodeMessages(
    planned: PlannedFigure,
    schema: DataSchema,
    runtime: "R" | "Python",
): ChatMessage[] {
    const isR = runtime === "R";
    const loadExample = isR
        ? `data <- read.csv("${schema.filepath}")`
        : `df = pd.read_csv("${schema.filepath}")`;

    const system = `You are an expert ${isR ? "R" : "Python"} data visualization programmer writing code for an academic publication figure.

CRITICAL RULES:
1. Load data from the EXACT filepath provided: ${schema.filepath}
2. Use ONLY the specified columns: ${planned.columns.join(", ") || "choose appropriate columns"}
3. Academic style: clean, minimal, publication-quality
${isR ? `4. Use ggplot2. theme_minimal() or theme_classic(). Last expression MUST be the ggplot object.
5. NO cairo(), png(), pdf(), dev.off() calls. NO ggsave(). The compiler captures output automatically.
6. Use library() for all packages.` :
`4. Use matplotlib + seaborn. sns.set_style("whitegrid"). plt.tight_layout().
5. NO plt.show(), NO plt.savefig(). The compiler captures output automatically.
6. Import: import pandas as pd, import matplotlib.pyplot as plt, import seaborn as sns, import numpy as np`}
7. NO synthetic data. Load the full file using: ${loadExample}

Return ONLY executable ${isR ? "R" : "Python"} code. No markdown fences. No comments. No explanations.`;

    const user = `Create a ${planned.analysisType.toUpperCase()} figure for an academic ${planned.description ? `paper. The figure should show: ${planned.description}` : "document"}.

Data file: ${schema.filepath}
Columns available: ${schema.columns.join(", ")}
Columns to use: ${planned.columns.join(", ") || "choose best columns"}
Figure caption context: ${planned.caption}

Generate the code now:`;

    return [{ role: "system", content: system }, { role: "user", content: user }];
}

function cleanCode(raw: string): string {
    return raw
        .replace(/^```(?:r|R|python|py)?\s*\n?/i, "")
        .replace(/\n?```\s*$/, "")
        .trim();
}

async function compileCode(code: string, runtime: "R" | "Python"): Promise<string> {
    const url = runtime === "R" ? R_COMPILER_URL : PY_COMPILER_URL;
    const res = await fetch(`${url}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) throw new Error(`Compiler HTTP ${res.status}`);
    const result = await res.json();
    if (!result.success) throw new Error(result.log?.slice(0, 400) ?? "Compilation failed");
    if (!result.image) throw new Error("Compiler returned no image");
    return result.image as string;  // base64 PNG
}

// ── Retry with error log ──────────────────────────────────────────────────────

async function generateFigure(
    planned: PlannedFigure,
    schema: DataSchema,
    runtime: "R" | "Python",
): Promise<{ pngBase64: string; code: string; tokensUsed: number }> {
    let lastError = "";
    let lastCode = "";
    let tokensUsed = 0;

    for (let attempt = 0; attempt < 2; attempt++) {
        const messages = buildCodeMessages(planned, schema, runtime);

        // On retry, append the compiler error to help the LLM fix it
        if (attempt > 0 && lastError) {
            messages.push({
                role: "assistant",
                content: lastCode,
            });
            messages.push({
                role: "user",
                content: `The code above failed with this error:\n${lastError}\n\nFix the error and return corrected code only.`,
            });
        }

        const r = await chatCompletion(messages, { timeoutMs: 90_000 });
        tokensUsed += r.totalTokens;
        const code = cleanCode(r.text);
        lastCode = code;

        const finalCode = runtime === "R" ? wrapRCode(code) : code;

        try {
            const pngBase64 = await compileCode(finalCode, runtime);
            return { pngBase64, code, tokensUsed };
        } catch (e: any) {
            lastError = String(e?.message ?? e).slice(0, 500);
            console.warn(`[Stage2.6] Attempt ${attempt + 1} failed for ${planned.id}:`, lastError.slice(0, 120));
        }
    }

    throw new Error(lastError || "Code generation failed after 2 attempts");
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function runStage2_6(
    settings: PipelineSettings,
    plan: Plan,
    dataUploads: AgentUpload[],
    onProgress?: (done: number, total: number, id?: string) => void,
): Promise<{ dataFigures: GeneratedDataFigure[]; tokensUsed: number }> {
    if (dataUploads.length === 0) return { dataFigures: [], tokensUsed: 0 };

    const runtime = settings.dataRuntime ?? "R";
    console.log(`[Stage2.6] Starting with ${dataUploads.length} data file(s), runtime=${runtime}`);

    // a. Save files to shared volume (reuse fileManager from analytics)
    const fileMap = await saveFilesToDisk(dataUploads);

    // b. Extract schemas
    const schemas: DataSchema[] = [];
    for (const upload of dataUploads) {
        const filepath = fileMap.get(upload.id);
        if (!filepath) continue;
        const schema = await extractSchema(upload, filepath);
        if (schema) schemas.push(schema);
    }

    if (schemas.length === 0) {
        console.warn("[Stage2.6] No usable schemas extracted, skipping");
        return { dataFigures: [], tokensUsed: 0 };
    }

    console.log(`[Stage2.6] Schemas: ${schemas.map(s => `${s.filename}(${s.columns.length} cols)`).join(", ")}`);

    // c. Plan figures
    const planMessages = buildPlanningMessages(settings, plan, schemas);
    let totalTokens = 0;

    const planRes = await withRetry(() => chatCompletion(planMessages, { jsonMode: true, timeoutMs: 60_000 }), 2, 800);
    totalTokens += planRes.totalTokens;
    const parsed = parseJsonLoose(planRes.text);
    const sectionNames = plan.sections.map(s => s.heading);
    const plannedFigures = validatePlans(parsed, schemas, sectionNames);

    if (plannedFigures.length === 0) {
        console.warn("[Stage2.6] No valid figures planned");
        return { dataFigures: [], tokensUsed: totalTokens };
    }

    console.log(`[Stage2.6] Planned ${plannedFigures.length} figure(s): ${plannedFigures.map(f => f.id).join(", ")}`);

    // d. Generate code + compile
    const results: GeneratedDataFigure[] = [];
    let completed = 0;

    for (const planned of plannedFigures) {
        const schema = schemas.find(s => s.filename === planned.dataFile);
        if (!schema) {
            results.push({ id: planned.id, sectionHeading: planned.sectionHeading, filename: `${planned.id}.png`, caption: planned.caption, label: planned.label, pngBase64: "", analysisType: planned.analysisType, runtime, code: "", failed: true, error: "Schema not found" });
            continue;
        }

        try {
            const { pngBase64, code, tokensUsed: tv } = await generateFigure(planned, schema, runtime);
            totalTokens += tv;
            console.log(`[Stage2.6] ✓ ${planned.id}.png  type=${planned.analysisType}  runtime=${runtime}`);
            results.push({ id: planned.id, sectionHeading: planned.sectionHeading, filename: `${planned.id}.png`, caption: planned.caption, label: planned.label, pngBase64, analysisType: planned.analysisType, runtime, code });
        } catch (e: any) {
            console.error(`[Stage2.6] ✗ ${planned.id}:`, e?.message);
            results.push({ id: planned.id, sectionHeading: planned.sectionHeading, filename: `${planned.id}.png`, caption: planned.caption, label: planned.label, pngBase64: "", analysisType: planned.analysisType, runtime, code: "", failed: true, error: String(e?.message ?? e).slice(0, 200) });
        } finally {
            completed++;
            onProgress?.(completed, plannedFigures.length, planned.id);
        }
    }

    const ok = results.filter(r => !r.failed).length;
    console.log(`[Stage2.6] Done: ${ok}/${results.length} data figures generated`);
    return { dataFigures: results, tokensUsed: totalTokens };
}
