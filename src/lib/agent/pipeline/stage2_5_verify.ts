// Stage 2.5 — Verify.
// Verification layer that ensures the model actually "sees" and understands
// the uploaded references. For each successfully extracted PDF, we ask the
// model test questions and generate a comprehensive summary. This gives us
// confidence that the content will be properly used in Stage 3 (Draft).
//
// Only runs when useReferences=true and at least one ref was extracted.

import { chatCompletion, parseJsonLoose, type ChatMessage, type ChatContentPart } from "./llm";
import type { ExtractedRef } from "./types";
import type { AgentUpload } from "@/lib/db";
import { concurrentMap, withRetry } from "../stages";

const CONCURRENCY = 3;
const TEXT_PREVIEW_CHARS = 8000; // More generous than Stage 2 for verification

export interface VerificationQuestion {
    question: string;
    answer: string;
    confidence: number; // 0-10, model's self-assessed confidence
}

export interface VerificationResult {
    uploadId: string;
    filename: string;
    verified: boolean; // true if avg confidence >= 7
    testQuestions: VerificationQuestion[];
    contentSummary: string; // 200-400 word summary
    keyTopics: string[];
    warnings: string[];
    tokensUsed?: number;
}

function buildSystemPrompt(): string {
    return `You are a research document analyzer. You will receive ONE document (text + figures) and must verify your understanding of it.

Return ONLY valid JSON:
{
  "content_summary": "A comprehensive 200-400 word summary covering: main topic, methodology, key findings, and conclusions",
  "key_topics": ["topic1", "topic2", ...],
  "test_questions": [
    {
      "question": "What is the main research question?",
      "answer": "...",
      "confidence": <0-10>
    },
    {
      "question": "What methodology was used?",
      "answer": "...",
      "confidence": <0-10>
    },
    {
      "question": "What are the key findings?",
      "answer": "...",
      "confidence": <0-10>
    },
    {
      "question": "What are the limitations mentioned?",
      "answer": "...",
      "confidence": <0-10>
    },
    {
      "question": "What future work is suggested?",
      "answer": "...",
      "confidence": <0-10>
    }
  ]
}

Rules:
- content_summary must be detailed and factual (200-400 words)
- key_topics should be 5-10 specific topics/concepts from the document
- test_questions: answer each based ONLY on document content
- confidence: 0 = cannot answer, 10 = completely certain
- If a question is not applicable (e.g., no methodology section), answer "N/A" with confidence 0
- Do NOT fabricate information. If unsure, lower confidence.

No markdown fences. No commentary. JSON only.`;
}

function buildUserContent(upload: AgentUpload, ref: ExtractedRef): ChatContentPart[] {
    const parts: ChatContentPart[] = [];
    
    // Text content (more generous preview for verification)
    const text = (upload.text_content || "").slice(0, TEXT_PREVIEW_CHARS);
    const meta = ref.metadata || {};
    
    const header = [
        `FILE: ${upload.filename}`,
        `PAGES: ${upload.page_count}${upload.ocr_used ? " (OCR)" : ""}`,
        meta.title ? `TITLE: ${meta.title}` : "",
        meta.authors?.length ? `AUTHORS: ${meta.authors.join(", ")}` : "",
        meta.year ? `YEAR: ${meta.year}` : "",
        meta.venue ? `VENUE: ${meta.venue}` : "",
        "",
        `FULL TEXT (${text.length} chars):`,
        text,
    ].filter(Boolean).join("\n");
    
    parts.push({ type: "text", text: header });
    
    // Images from PDF
    const images = Array.isArray(upload.images_json)
        ? upload.images_json
        : (typeof upload.images_json === "string" ? JSON.parse(upload.images_json) : []);
    
    for (const img of images as { dataUrl: string }[]) {
        if (!img?.dataUrl) continue;
        parts.push({
            type: "image_url",
            image_url: {
                url: img.dataUrl,
                detail: "high", // High detail for verification
            },
        });
    }
    
    return parts;
}

function validateVerification(raw: any, uploadId: string, filename: string): VerificationResult {
    const warnings: string[] = [];
    
    if (!raw || typeof raw !== "object") {
        return {
            uploadId,
            filename,
            verified: false,
            testQuestions: [],
            contentSummary: "",
            keyTopics: [],
            warnings: ["Invalid JSON response from verifier"],
        };
    }
    
    // Extract summary
    const contentSummary = typeof raw.content_summary === "string"
        ? raw.content_summary.trim()
        : "";
    
    if (!contentSummary || contentSummary.length < 100) {
        warnings.push("Summary too short or missing");
    }
    
    // Extract topics
    const keyTopics = Array.isArray(raw.key_topics)
        ? raw.key_topics.map(String).filter(Boolean).slice(0, 15)
        : [];
    
    if (keyTopics.length === 0) {
        warnings.push("No key topics extracted");
    }
    
    // Extract test questions
    const testQuestions: VerificationQuestion[] = [];
    if (Array.isArray(raw.test_questions)) {
        for (const q of raw.test_questions) {
            if (!q || typeof q !== "object") continue;
            const question = typeof q.question === "string" ? q.question.trim() : "";
            const answer = typeof q.answer === "string" ? q.answer.trim() : "";
            const confidence = Number.isFinite(Number(q.confidence))
                ? Math.max(0, Math.min(10, Math.round(Number(q.confidence))))
                : 0;
            
            if (question && answer) {
                testQuestions.push({ question, answer, confidence });
            }
        }
    }
    
    if (testQuestions.length === 0) {
        warnings.push("No test questions answered");
    }
    
    // Calculate average confidence
    const avgConfidence = testQuestions.length > 0
        ? testQuestions.reduce((sum, q) => sum + q.confidence, 0) / testQuestions.length
        : 0;
    
    // Verification passes if avg confidence >= 7 and we have summary + topics
    const verified = avgConfidence >= 7 && contentSummary.length >= 100 && keyTopics.length >= 3;
    
    if (!verified) {
        if (avgConfidence < 7) {
            warnings.push(`Low confidence (${avgConfidence.toFixed(1)}/10)`);
        }
    }
    
    return {
        uploadId,
        filename,
        verified,
        testQuestions,
        contentSummary,
        keyTopics,
        warnings,
    };
}

export async function runStage2_5(
    refs: ExtractedRef[],
    uploads: AgentUpload[],
    onProgress?: (done: number, total: number, current?: string) => void,
): Promise<{ verifications: VerificationResult[]; tokensUsed: number }> {
    // Only verify successfully extracted refs
    const okRefs = refs.filter(r => r.status === "ok");
    
    if (okRefs.length === 0) {
        return { verifications: [], tokensUsed: 0 };
    }
    
    const systemPrompt = buildSystemPrompt();
    let totalTokens = 0;
    let completed = 0;
    
    const results = await concurrentMap(okRefs, CONCURRENCY, async (ref) => {
        const upload = uploads.find(u => u.id === ref.uploadId);
        if (!upload) {
            return {
                uploadId: ref.uploadId,
                filename: ref.filename,
                verified: false,
                testQuestions: [],
                contentSummary: "",
                keyTopics: [],
                warnings: ["Upload not found"],
            } as VerificationResult;
        }
        
        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: buildUserContent(upload, ref) },
        ];
        
        try {
            const r = await withRetry(() => chatCompletion(messages, {
                jsonMode: true,
                timeoutMs: 120_000, // 2 minutes for verification
            }), 2, 1000);
            
            totalTokens += r.totalTokens;
            const parsed = parseJsonLoose(r.text);
            const result = validateVerification(parsed, ref.uploadId, ref.filename);
            result.tokensUsed = r.totalTokens;
            
            console.log(`[Stage2.5] ${ref.filename}: verified=${result.verified}, avg_confidence=${
                result.testQuestions.length > 0
                    ? (result.testQuestions.reduce((s, q) => s + q.confidence, 0) / result.testQuestions.length).toFixed(1)
                    : "N/A"
            }`);
            
            return result;
        } catch (e: any) {
            console.error(`[Stage2.5] Verification failed for ${ref.filename}:`, e?.message);
            return {
                uploadId: ref.uploadId,
                filename: ref.filename,
                verified: false,
                testQuestions: [],
                contentSummary: "",
                keyTopics: [],
                warnings: [`Verification error: ${String(e?.message || e).slice(0, 200)}`],
            } as VerificationResult;
        } finally {
            completed++;
            onProgress?.(completed, okRefs.length, ref.filename);
        }
    });
    
    const verifiedCount = results.filter(r => r.verified).length;
    console.log(`[Stage2.5] Verification complete: ${verifiedCount}/${results.length} passed`);
    
    return { verifications: results, tokensUsed: totalTokens };
}
