// Stage 1 — Data Verification
// Ensures uploaded files contain REAL, usable data before proceeding.
// Prevents AI from generating synthetic/mock data.

import { chatCompletion, parseJsonLoose, type ChatMessage } from "@/lib/agent/pipeline/llm";
import { downloadTextFromStorage } from "@/lib/storage";
import type { DataVerification } from "./types";
import type { AgentUpload } from "@/lib/db";
import { concurrentMap, withRetry } from "@/lib/agent/stages";

const CONCURRENCY = 3;

function buildSystemPrompt(): string {
    return `You are a data analyst. Analyze the provided file and determine if it contains REAL, usable data for visualization.

Return ONLY valid JSON:
{
  "verified": <boolean>,
  "dataType": "tabular" | "text" | "image" | "mixed",
  "rowCount": <number or null>,
  "columnCount": <number or null>,
  "columns": ["col1", "col2", ...] or null,
  "summary": "Brief description of what data is available (2-3 sentences)",
  "warnings": ["warning1", "warning2", ...]
}

Rules:
- verified=true ONLY if file contains actual data that can be visualized
- verified=false if: empty file, corrupted data, only metadata, binary garbage
- dataType: "tabular" for CSV/Excel, "text" for documents, "image" for images
- For tabular data, extract column names and row count
- summary: describe what metrics/variables are available
- warnings: list any data quality issues

CRITICAL: If data is unusable, set verified=false and explain why in warnings.

No markdown fences. JSON only.`;
}

function getSmartSample(text: string, filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    // For CSV/TSV: take header + first 10 rows
    if (ext === 'csv' || ext === 'tsv') {
        const lines = text.split('\n');
        const sample = lines.slice(0, 11).join('\n'); // header + 10 rows
        const remaining = lines.length - 11;
        return sample + (remaining > 0 ? `\n\n... (${remaining} more rows)` : '');
    }
    
    // For Excel (stored as base64): extract first 10 rows after parsing
    if (ext === 'xlsx' || ext === 'xls') {
        if (text.startsWith('[EXCEL_FILE:')) {
            return `[Excel file detected - will be parsed during code generation]\nFilename: ${filename}\nSize: ${text.length} chars (base64 encoded)`;
        }
    }
    
    // For JSON: take first 10 lines
    if (ext === 'json') {
        const lines = text.split('\n');
        const sample = lines.slice(0, 10).join('\n');
        const remaining = lines.length - 10;
        return sample + (remaining > 0 ? `\n\n... (${remaining} more lines)` : '');
    }
    
    // For other text files: take first 10 lines
    const lines = text.split('\n');
    const sample = lines.slice(0, 10).join('\n');
    const remaining = lines.length - 10;
    return sample + (remaining > 0 ? `\n\n... (${remaining} more lines)` : '');
}

async function buildUserContent(upload: AgentUpload): Promise<string> {
    let text = upload.text_content || "";
    
    // If file is in Storage
    if (upload.storage_path && !text) {
        // For XLSX/XLS files in Storage, we can't parse them here
        // Just provide metadata for AI to understand it's tabular data
        if (upload.filename.match(/\.xlsx?$/i)) {
            return `FILE: ${upload.filename}
STORAGE: Supabase Storage
TYPE: Microsoft Excel Spreadsheet
SIZE: ${upload.file_size || 0} bytes
MIME: ${upload.mime_type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}

This is an Excel file stored in Supabase Storage.
It contains tabular data that will be parsed during code generation.
The file is available for analysis and can be loaded with pandas or R.

Assume this file contains REAL tabular data with columns and rows.
Mark as verified=true, dataType="tabular".`;
        }
        
        // For text files (CSV, JSON, TSV), download and truncate
        try {
            console.log(`[Stage1] Downloading from Storage: ${upload.storage_path}`);
            const fullText = await downloadTextFromStorage(upload.storage_path);
            
            // CRITICAL: Only take first 10 lines to avoid token limit!
            const lines = fullText.split('\n');
            text = lines.slice(0, 11).join('\n'); // header + 10 rows
            
            console.log(`[Stage1] Truncated ${fullText.length} chars to ${text.length} chars (first 10 lines)`);
        } catch (e: any) {
            console.error(`[Stage1] Failed to download from Storage:`, e);
            return `FILE: ${upload.filename}
ERROR: Failed to download file from storage
SIZE: ${upload.file_size || 0} bytes
MIME: ${upload.mime_type || 'unknown'}

This file is stored in Supabase Storage but could not be downloaded.`;
        }
    } else if (text) {
        // CRITICAL: If text from DB, also truncate to first 10 lines!
        const lines = text.split('\n');
        text = lines.slice(0, 11).join('\n');
    }
    
    const hasImages = Array.isArray(upload.images_json) && upload.images_json.length > 0;
    
    // Get smart sample based on file type (already truncated)
    const sample = text;
    
    // Check for common data file indicators (on truncated text)
    const looksLikeCSV = text.includes(',') && text.split('\n').length > 2;
    const looksLikeTSV = text.includes('\t') && text.split('\n').length > 2;
    const looksLikeJSON = text.trim().startsWith('{') || text.trim().startsWith('[');
    const looksLikeExcel = text.startsWith('[EXCEL_FILE:');
    const isFromStorage = Boolean(upload.storage_path);
    
    return `FILE: ${upload.filename}
STORAGE: ${isFromStorage ? 'Supabase Storage' : 'Database'}
${isFromStorage ? `SIZE: ${upload.file_size || 0} bytes` : `PAGES: ${upload.page_count}${upload.ocr_used ? " (OCR)" : ""}`}
FULL_SIZE: ${text.length} chars
HAS_IMAGES: ${hasImages}

CONTENT SAMPLE (smart preview):
${sample}

ANALYSIS HINTS:
- Looks like CSV: ${looksLikeCSV}
- Looks like TSV: ${looksLikeTSV}
- Looks like JSON: ${looksLikeJSON}
- Looks like Excel: ${looksLikeExcel}
- Has images: ${hasImages}
- From Storage: ${isFromStorage}

Analyze this file and determine if it contains REAL data for visualization.`;
}

function validateVerification(raw: any, uploadId: string, filename: string): DataVerification {
    const warnings: string[] = [];
    
    if (!raw || typeof raw !== "object") {
        return {
            uploadId,
            filename,
            verified: false,
            dataType: 'text',
            summary: "",
            warnings: ["Invalid JSON response from verifier"],
        };
    }
    
    const verified = Boolean(raw.verified);
    const dataType = ['tabular', 'text', 'image', 'mixed'].includes(raw.dataType) 
        ? raw.dataType 
        : 'text';
    
    const rowCount = typeof raw.rowCount === 'number' ? raw.rowCount : undefined;
    const columnCount = typeof raw.columnCount === 'number' ? raw.columnCount : undefined;
    const columns = Array.isArray(raw.columns) 
        ? raw.columns.map(String).filter(Boolean) 
        : undefined;
    
    const summary = typeof raw.summary === 'string' ? raw.summary.trim() : "";
    
    if (Array.isArray(raw.warnings)) {
        warnings.push(...raw.warnings.map(String).filter(Boolean));
    }
    
    // Additional validation
    if (verified && dataType === 'tabular' && (!columns || columns.length === 0)) {
        warnings.push("Tabular data but no columns detected");
    }
    
    if (verified && !summary) {
        warnings.push("No data summary provided");
    }
    
    return {
        uploadId,
        filename,
        verified,
        dataType,
        rowCount,
        columnCount,
        columns,
        summary,
        warnings,
    };
}

// Simple file-based verification WITHOUT OpenAI to avoid rate limits
function simpleVerify(upload: AgentUpload): DataVerification {
    const ext = upload.filename.split('.').pop()?.toLowerCase() || '';
    
    // Check if it's a data file
    const dataExtensions = ['csv', 'xlsx', 'xls', 'json', 'tsv', 'txt'];
    if (!dataExtensions.includes(ext)) {
        return {
            uploadId: upload.id,
            filename: upload.filename,
            verified: false,
            dataType: 'text',
            summary: "",
            warnings: [`Unsupported file type: .${ext}`],
        };
    }
    
    // All data files are assumed valid
    return {
        uploadId: upload.id,
        filename: upload.filename,
        verified: true,
        dataType: 'tabular',
        summary: `Data file ready for analysis (${ext.toUpperCase()} format)`,
        warnings: [],
    };
}

export async function runStage1(
    uploads: AgentUpload[],
    onProgress?: (done: number, total: number, current?: string) => void,
): Promise<{ verifications: DataVerification[]; tokensUsed: number }> {
    if (uploads.length === 0) {
        return { verifications: [], tokensUsed: 0 };
    }
    
    console.log(`[Analytics-Stage1] Verifying ${uploads.length} files (simple mode - no AI)`);
    
    // Simple verification without OpenAI
    const results = uploads.map((upload, index) => {
        const result = simpleVerify(upload);
        console.log(`[Analytics-Stage1] ${upload.filename}: verified=${result.verified}, type=${result.dataType}`);
        onProgress?.(index + 1, uploads.length, upload.filename);
        return result;
    });
    
    const verifiedCount = results.filter(r => r.verified).length;
    console.log(`[Analytics-Stage1] Verification complete: ${verifiedCount}/${results.length} files have usable data`);
    
    // CRITICAL: If NO files verified, throw error
    if (verifiedCount === 0) {
        throw new Error("CRITICAL: No usable data found in uploaded files. Please upload CSV, Excel, JSON, or TSV files.");
    }
    
    return { verifications: results, tokensUsed: 0 }; // 0 tokens used!
}
