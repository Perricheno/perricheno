// Stage 3 — Draft.
// Section-by-section generation. Sections are written sequentially so each
// one can see a lightweight summary of what came before (for continuity).
// Long sections use the chatCompletionLong() continuation fallback so a
// 25 000-word thesis is never bottlenecked by a per-call token cap.

import { chatCompletionLong, type ChatMessage, type ChatContentPart } from "./llm";
import type { ExtractedRef, Plan, PlanSection, SectionDraft, PipelineSettings, VerificationResult } from "./types";
import type { AgentUpload } from "@/lib/db";
import { BABEL_LANG_MAP } from "../stages";

const LANG_DISPLAY_NAMES: Record<string, string> = {
    en: "English", ru: "Russian", uk: "Ukrainian", kk: "Kazakh",
    de: "German", fr: "French", es: "Spanish", it: "Italian",
    pt: "Portuguese", nl: "Dutch", pl: "Polish", cs: "Czech",
    sk: "Slovak", hu: "Hungarian", ro: "Romanian", el: "Greek",
    tr: "Turkish", sv: "Swedish", no: "Norwegian", da: "Danish",
    fi: "Finnish", bg: "Bulgarian", sr: "Serbian",
};

const PREVIOUS_CONTEXT_CHARS = 1500;
// NO LIMIT - send full text from each reference

// Enhanced reference bundle with full context from verification
function buildEnhancedRefBundle(
    refs: ExtractedRef[],
    uploads: AgentUpload[],
    verifications: VerificationResult[],
): string {
    const ok = refs.filter(r => r.status === "ok" && (r.relevanceScore ?? 0) >= 3);
    if (ok.length === 0) return "";
    
    const bundle: string[] = [];
    
    for (const ref of ok) {
        const upload = uploads.find(u => u.id === ref.uploadId);
        const verify = verifications.find(v => v.uploadId === ref.uploadId);
        
        if (!upload) continue;
        
        const meta = ref.metadata ?? {};
        const authors = (meta.authors ?? []).join(", ");
        
        // Header with metadata
        bundle.push(`━━━ [${ref.bibKey}] ${meta.title || ref.filename} ━━━`);
        if (authors) bundle.push(`Authors: ${authors}`);
        if (meta.year) bundle.push(`Year: ${meta.year}`);
        if (meta.venue) bundle.push(`Venue: ${meta.venue}`);
        
        // Verification summary (comprehensive understanding)
        if (verify?.verified && verify.contentSummary) {
            bundle.push(`\n📋 SUMMARY:\n${verify.contentSummary}`);
        }
        
        // Key topics for context
        if (verify?.keyTopics && verify.keyTopics.length > 0) {
            bundle.push(`\n🏷️ KEY TOPICS: ${verify.keyTopics.slice(0, 8).join(", ")}`);
        }
        
        // Key claims (structured facts)
        if (ref.keyClaims && ref.keyClaims.length > 0) {
            bundle.push(`\n💡 KEY CLAIMS:`);
            ref.keyClaims.forEach(c => bundle.push(`  • ${c}`));
        }
        
        // Relevant quotes (direct citations)
        if (ref.relevantQuotes && ref.relevantQuotes.length > 0) {
            bundle.push(`\n📝 QUOTES:`);
            ref.relevantQuotes.forEach(q => bundle.push(`  "${q}"`));
        }
        
        // FULL TEXT (no truncation - send everything)
        if (upload.text_content && upload.text_content.length > 100) {
            bundle.push(`\n📄 FULL TEXT (${upload.text_content.length} chars):\n${upload.text_content}`);
        }
        
        // Images indicator
        const imgCount = Array.isArray(upload.images_json) 
            ? upload.images_json.length 
            : 0;
        if (imgCount > 0) {
            bundle.push(`\n🖼️ Contains ${imgCount} figure(s) - images are provided separately for visual analysis`);
        }
        
        bundle.push(""); // Separator
    }
    
    return bundle.join("\n");
}

// Legacy function for backward compatibility (when verifications not available)
function buildRefBundle(refs: ExtractedRef[]): string {
    const ok = refs.filter(r => r.status === "ok" && (r.relevanceScore ?? 0) >= 3);
    if (ok.length === 0) return "";
    const lines = ok.map(r => {
        const meta = r.metadata ?? {};
        const authors = (meta.authors ?? []).join(", ");
        const header = `- [${r.bibKey}] "${meta.title ?? r.filename}" (${meta.year ?? "n.d."})${authors ? ` — ${authors}` : ""}`;
        const claims = (r.keyClaims ?? []).map(c => `  • ${c}`).join("\n");
        return `${header}\n${claims}`;
    });
    return lines.join("\n\n");
}

function buildSystemPrompt(s: PipelineSettings, refsAvailable: boolean): string {
    const lang = LANG_DISPLAY_NAMES[s.language] ?? s.language;
    const styleDesc = {
        simple: "Simple and clear. Basic vocabulary, short sentences.",
        medium: "Standard academic style. Well-structured, proper terminology.",
        phd:    "Research-grade writing. Dense prose, sophisticated argumentation.",
    }[s.style];

    const refRules = refsAvailable
        ? `CITATIONS: Use \\textcite{key} and \\parencite{key} where appropriate. Only cite keys from the provided reference bundle. Do NOT invent keys.`
        : `CITATIONS: Do NOT include any \\cite / \\textcite / \\parencite commands. No bibliography references in this draft.`;

    return `You are writing ONE section of an academic ${s.docType ?? "document"} in ${lang}.

Return ONLY the LaTeX body of that section — plain text and LaTeX commands, NO \\section{...} wrapper (the orchestrator adds it), NO document preamble, NO \\begin{document}.

Rules:
- Style: ${styleDesc}
- Hit the target word count within ±20%. Do not pad, do not truncate.
- Use correct LaTeX. Escape specials properly: & → \\&, % → \\%, _ → \\_, # → \\#, $ in prose → \\$.
- Use \\subsection{...} for internal structure when it helps.
- Math: use \\( ... \\) or \\[ ... \\] for display, no bare $...$ if you can avoid it.
- Tables / code / figures are allowed only when the task demands them.
- ${refRules}
- Output LaTeX only. No markdown, no fences, no commentary.`;
}

function buildUserPrompt(
    s: PipelineSettings,
    plan: Plan,
    section: PlanSection,
    refBundle: string,
    previousSummary: string,
): string {
    const outline = plan.sections.map((sec, i) => `  ${i + 1}. ${sec.heading} (~${sec.wordTarget} words)`).join("\n");

    const focusRefs = section.refFocus && section.refFocus.length > 0
        ? `Most relevant references for this section: ${section.refFocus.join(", ")}`
        : "";

    return [
        `DOCUMENT TITLE: ${plan.title}`,
        `DOCUMENT TOPIC: ${s.prompt}`,
        "",
        `FULL OUTLINE:\n${outline}`,
        previousSummary ? `\nPREVIOUSLY WRITTEN (tail, for continuity only — do NOT repeat):\n${previousSummary}` : "",
        refBundle ? `\nREFERENCE BUNDLE (only these citation keys are valid):\n${refBundle}` : "",
        focusRefs ? `\n${focusRefs}` : "",
        "",
        `NOW WRITE THIS SECTION:`,
        `HEADING: ${section.heading}`,
        `TARGET WORDS: ${section.wordTarget}`,
        section.tasks.length ? `MUST COVER:\n${section.tasks.map(t => `- ${t}`).join("\n")}` : "",
        "",
        `Write the section body now. LaTeX only.`,
    ].filter(Boolean).join("\n");
}

// Collect images from relevant references for a section
function collectSectionImages(
    section: PlanSection,
    refs: ExtractedRef[],
    uploads: AgentUpload[],
): ChatContentPart[] {
    const images: ChatContentPart[] = [];
    
    if (!section.refFocus || section.refFocus.length === 0) return images;
    
    for (const filename of section.refFocus) {
        const ref = refs.find(r => r.filename === filename && r.status === "ok");
        if (!ref) continue;
        
        const upload = uploads.find(u => u.id === ref.uploadId);
        if (!upload) continue;
        
        const uploadImages = Array.isArray(upload.images_json)
            ? upload.images_json
            : (typeof upload.images_json === "string" ? JSON.parse(upload.images_json) : []);
        
        // Add ALL images from this reference (no limit)
        for (const img of uploadImages) {
            if (img?.dataUrl) {
                images.push({
                    type: "image_url",
                    image_url: {
                        url: img.dataUrl,
                        detail: "high", // High detail for better understanding
                    },
                });
            }
        }
    }
    
    return images;
}

export async function runStage3(
    settings: PipelineSettings,
    plan: Plan,
    refs: ExtractedRef[],
    uploads: AgentUpload[],
    verifications: VerificationResult[],
    onProgress?: (done: number, total: number, heading: string) => void,
): Promise<{ sections: SectionDraft[]; tokensUsed: number; anyTruncated: boolean }> {
    // Use enhanced bundle if verifications available, otherwise fallback to legacy
    const refBundle = verifications.length > 0
        ? buildEnhancedRefBundle(refs, uploads, verifications)
        : buildRefBundle(refs);
    
    const systemPrompt = buildSystemPrompt(settings, !!refBundle);

    const drafts: SectionDraft[] = [];
    let totalTokens = 0;
    let anyTruncated = false;
    let runningTail = "";

    console.log(`[Stage3] Starting draft with ${verifications.length > 0 ? "ENHANCED" : "legacy"} ref bundle (${refBundle.length} chars)`);

    for (let i = 0; i < plan.sections.length; i++) {
        const section = plan.sections[i];
        const userPromptText = buildUserPrompt(settings, plan, section, refBundle, runningTail);
        
        // Collect images from relevant references
        const sectionImages = collectSectionImages(section, refs, uploads);
        
        // Build multimodal message if images available
        const userContent: string | ChatContentPart[] = sectionImages.length > 0
            ? [
                { type: "text", text: userPromptText },
                ...sectionImages,
            ]
            : userPromptText;

        const messages: ChatMessage[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
        ];

        console.log(`[Stage3] Section ${i + 1}/${plan.sections.length}: "${section.heading}" (${section.wordTarget} words, ${sectionImages.length} images)`);

        const r = await chatCompletionLong(messages, {
            timeoutMs: 180_000,
        });

        totalTokens += r.totalTokens;
        if (r.truncated) anyTruncated = true;

        const body = r.text.trim();
        const words = body.split(/\s+/).filter(Boolean).length;

        drafts.push({
            heading: section.heading,
            body,
            wordCount: words,
            truncated: r.truncated,
            tokensUsed: r.totalTokens,
        });

        console.log(`[Stage3] Section complete: ${words} words, ${r.totalTokens} tokens${r.truncated ? " (TRUNCATED)" : ""}`);

        // Keep just the tail as continuity context — cheap and effective.
        runningTail = body.slice(-PREVIOUS_CONTEXT_CHARS);

        onProgress?.(i + 1, plan.sections.length, section.heading);
    }

    return { sections: drafts, tokensUsed: totalTokens, anyTruncated };
}
