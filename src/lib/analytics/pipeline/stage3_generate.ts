// Stage 3 — Generate Charts
// Sequential generation of charts using REAL data only.
// Strict validation that code uses actual columns/data.

import { chatCompletion, type ChatMessage } from "@/lib/agent/pipeline/llm";
import type { ChartPlan, GeneratedChart, DataVerification, Runtime } from "./types";
import type { AgentUpload } from "@/lib/db";

const R_COMPILER_URL = process.env.R_COMPILER_URL || 'http://r-compiler:8000';
const PYTHON_COMPILER_URL = process.env.PYTHON_COMPILER_URL || 'http://python-compiler:8000';

function buildSystemPrompt(runtime: Runtime): string {
    const isPython = runtime === 'Python';
    
    if (isPython) {
        return `You are an expert Python data visualization programmer.

CRITICAL RULES:
1. Load data from the provided filename using pd.read_csv() or appropriate method
2. Use ONLY the REAL data from the file - NO synthetic/mock data
3. Use ONLY the column names specified in the plan
4. Import: matplotlib.pyplot as plt, seaborn as sns, pandas as pd, numpy as np
5. Modern Pandas: NEVER use inplace=True (deprecated)
6. Use plt.tight_layout() to prevent overlap
7. NO plt.show() - compiler captures output
8. Set style: sns.set_style("whitegrid")

IMPORTANT: You will receive a filename - load the FULL file using pd.read_csv(filename) or similar.
DO NOT parse inline data - use the filename to load the complete dataset.

Output ONLY executable Python code. NO markdown fences. NO comments explaining what you're doing.`;
    }
    
    return `You are an expert R data visualization programmer.

CRITICAL RULES:
1. Load data from the provided filename using read.csv() or appropriate method
2. Use ONLY the REAL data from the file - NO synthetic/mock data
3. Use ONLY the column names specified in the plan
4. Use library() for packages (auto-installer handles installation)
5. Use theme_minimal() for clean visuals
6. Last expression MUST be the plot object
7. NO Cairo() or png() calls

IMPORTANT: You will receive a filename - load the FULL file using read.csv(filename) or similar.
DO NOT parse inline data - use the filename to load the complete dataset.

Output ONLY executable R code. NO markdown fences. NO comments explaining what you're doing.`;
}

function getSmartSample(text: string, filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    // For CSV/TSV: take header + first 10 rows
    if (ext === 'csv' || ext === 'tsv') {
        const lines = text.split('\n');
        const sample = lines.slice(0, 11).join('\n'); // header + 10 rows
        const remaining = lines.length - 11;
        return sample + (remaining > 0 ? `\n... (${remaining} more rows)` : '');
    }
    
    // For JSON: take first 10 lines
    if (ext === 'json') {
        const lines = text.split('\n');
        const sample = lines.slice(0, 10).join('\n');
        const remaining = lines.length - 10;
        return sample + (remaining > 0 ? `\n... (${remaining} more lines)` : '');
    }
    
    // For other text files: take first 10 lines
    const lines = text.split('\n');
    const sample = lines.slice(0, 10).join('\n');
    const remaining = lines.length - 10;
    return sample + (remaining > 0 ? `\n... (${remaining} more lines)` : '');
}

function buildUserPrompt(
    plan: ChartPlan,
    verifications: DataVerification[],
    uploads: AgentUpload[],
    runtime: Runtime,
    fileMap?: Map<string, string>
): string {
    const verifiedData = verifications.filter(v => v.verified);
    
    // Build data context with ONLY METADATA (no text_content!)
    const dataContext = verifiedData.map(v => {
        // Get filepath from fileMap (if available)
        const filepath = fileMap?.get(v.uploadId) || v.filename;
        
        return `━━━ ${v.filename} ━━━
Type: ${v.dataType}
${v.rowCount ? `Rows: ${v.rowCount}` : ''}
${v.columnCount ? `Columns: ${v.columnCount}` : ''}
${v.columns?.length ? `Available Columns: ${v.columns.join(", ")}` : ''}

Summary: ${v.summary}

IMPORTANT: The full file is available at: ${filepath}
You MUST load the full file in your code using:
${runtime === 'Python' ? `df = pd.read_csv('${filepath}')` : `data <- read.csv('${filepath}')`}
`;
    }).join("\n\n");
    
    const isPython = runtime === 'Python';
    
    return `TASK: Create a ${plan.chartType.replace("_", " ").toUpperCase()} chart

REASONING: ${plan.reasoning}

REQUIRED COLUMNS TO USE: ${plan.dataColumns.length > 0 ? plan.dataColumns.join(", ") : "Use appropriate columns from data"}

DATA AVAILABLE:
${dataContext}

CRITICAL INSTRUCTIONS:
1. Parse the data above (CSV/TSV/JSON format)
2. Use ONLY the columns specified: ${plan.dataColumns.join(", ")}
3. Create a ${plan.chartType} visualization
4. ${isPython ? 'Store result in plt (e.g., plt.figure() or fig, ax = plt.subplots())' : 'Return the plot object as last expression'}
5. NO synthetic data - use ONLY what's provided above

Generate the code now:`;
}

function cleanCode(raw: string): string {
    let c = raw.trim();
    // Remove markdown fences
    if (c.startsWith("```")) {
        c = c.replace(/^```(?:r|R|python|py)?\s*\n?/, "");
    }
    if (c.endsWith("```")) {
        c = c.replace(/\n?```\s*$/, "");
    }
    return c.trim();
}

function wrapRCode(rawCode: string): string {
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

# User Code
${rawCode}
`;
}

// Validate that generated code references the required columns
function validateCodeUsesData(code: string, plan: ChartPlan): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    if (plan.dataColumns.length === 0) {
        return { valid: true, warnings };
    }
    
    // Check if code references the required columns
    const missingColumns = plan.dataColumns.filter(col => {
        // Look for column references (case-insensitive)
        const patterns = [
            new RegExp(`['"]${col}['"]`, 'i'),  // "column_name"
            new RegExp(`\\b${col}\\b`, 'i'),     // column_name as word
        ];
        return !patterns.some(p => p.test(code));
    });
    
    if (missingColumns.length > 0) {
        warnings.push(`Code may not use required columns: ${missingColumns.join(", ")}`);
    }
    
    // Check for common synthetic data patterns
    const syntheticPatterns = [
        /np\.random/i,
        /random\./i,
        /rnorm\(/i,
        /runif\(/i,
        /sample\(/i,
        /\brange\(\d+\)/,  // range(100)
        /seq\(\d+/,        // seq(1, 100)
    ];
    
    const foundSynthetic = syntheticPatterns.filter(p => p.test(code));
    if (foundSynthetic.length > 0) {
        warnings.push("WARNING: Code may be generating synthetic data instead of using provided data");
    }
    
    return { 
        valid: missingColumns.length === 0 && foundSynthetic.length === 0,
        warnings 
    };
}

export async function runStage3(
    plans: ChartPlan[],
    verifications: DataVerification[],
    uploads: AgentUpload[],
    runtime: Runtime,
    onProgress?: (done: number, total: number, chartType: string) => void,
    fileMap?: Map<string, string>, // uploadId -> filepath on disk
): Promise<{ charts: GeneratedChart[]; tokensUsed: number }> {
    const charts: GeneratedChart[] = [];
    let totalTokens = 0;
    
    const systemPrompt = buildSystemPrompt(runtime);
    const isPython = runtime === 'Python';
    const compilerUrl = isPython ? PYTHON_COMPILER_URL : R_COMPILER_URL;
    
    console.log(`[Analytics-Stage3] Generating ${plans.length} charts with ${runtime}`);
    
    for (let i = 0; i < plans.length; i++) {
        const plan = plans[i];
        
        try {
            onProgress?.(i, plans.length, plan.chartType);
            
            // Generate code with AI
            const userPrompt = buildUserPrompt(plan, verifications, uploads, runtime, fileMap);
            
            const messages: ChatMessage[] = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ];
            
            console.log(`[Analytics-Stage3] Generating code for ${plan.chartType}...`);
            
            const aiRes = await chatCompletion(messages, {
                timeoutMs: 120_000,
            });
            
            totalTokens += aiRes.totalTokens;
            
            const rawCode = aiRes.text;
            const cleanedCode = cleanCode(rawCode);
            
            if (!cleanedCode || cleanedCode.length < 20) {
                throw new Error("AI returned empty or invalid code");
            }
            
            // Validate code uses real data
            const validation = validateCodeUsesData(cleanedCode, plan);
            if (!validation.valid) {
                console.warn(`[Analytics-Stage3] ${plan.chartType} validation warnings:`, validation.warnings);
            }
            
            // Compile code
            const finalCode = isPython ? cleanedCode : wrapRCode(cleanedCode);
            
            console.log(`[Analytics-Stage3] Compiling ${plan.chartType}...`);
            
            const compileRes = await fetch(`${compilerUrl}/compile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: finalCode }),
                signal: AbortSignal.timeout(60000),
            });
            
            if (!compileRes.ok) {
                throw new Error(`Compilation failed (${compileRes.status})`);
            }
            
            const compileResult = await compileRes.json();
            
            if (!compileResult.success) {
                throw new Error(compileResult.log || 'Compilation failed');
            }
            
            charts.push({
                chart_type: plan.chartType,  // snake_case for frontend
                image: compileResult.image,
                code: cleanedCode,
                runtime,
                dataUsed: plan.dataColumns,
                tokensUsed: aiRes.totalTokens,
            });
            
            console.log(`[Analytics-Stage3] ✓ ${plan.chartType} generated successfully`);
            
        } catch (e: any) {
            console.error(`[Analytics-Stage3] ✗ ${plan.chartType} failed:`, e?.message);
            // Continue with next chart instead of failing entire pipeline
        }
        
        onProgress?.(i + 1, plans.length, plan.chartType);
    }
    
    if (charts.length === 0) {
        throw new Error("Failed to generate any charts. Please check your data and try again.");
    }
    
    console.log(`[Analytics-Stage3] Complete: ${charts.length}/${plans.length} charts generated`);
    
    return { charts, tokensUsed: totalTokens };
}
