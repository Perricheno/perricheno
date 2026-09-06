// Layer 2a - "document formatting", exactly one agent for the whole document
// (owner's explicit requirement). Deliberately given only a structural
// summary - headings, levels, word counts, hint flags - never the source
// prose itself, so its output can't be affected by document length at all.
// It exists to make the judgment calls a regex can't: whether an
// inconsistently-styled source's headings should collapse to chapters vs
// sections, and whether a title page/TOC should be synthesized.

import { chatCompletion, parseJsonLoose } from "../pipeline/llm";
import type { AssemblyHeader, DocPlan } from "./types";

function buildSummary(plan: DocPlan): string {
    return plan.chunks
        .filter(c => c.heading)
        .map(c => `${"  ".repeat(c.level - 1)}[L${c.level}] ${c.heading} (~${c.sourceText.split(/\s+/).length} words${c.hints.hasTable ? ", table" : ""}${c.hints.hasFormula ? ", formula" : ""})`)
        .join("\n");
}

export async function runFormatter(
    plan: DocPlan,
    templateId: string,
    totalWords: number,
): Promise<{ header: AssemblyHeader; tokensUsed: number }> {
    // The thesis template always implies chapters + title page + TOC - no
    // judgment call needed, and no reason to spend a call on it.
    if (templateId === "thesis") {
        return {
            header: { useChapters: true, needsTitlePage: true, needsToc: true, title: plan.title },
            tokensUsed: 0,
        };
    }

    // A custom uploaded template is an arbitrary LaTeX class we know nothing
    // about - we can't tell whether it even supports \chapter (most don't;
    // Overleaf templates are overwhelmingly article-based), and synthesizing
    // our own \begin{titlepage} into someone else's carefully designed
    // template would look wrong at best and fail to compile at worst. Stay
    // fully conservative: plain sections, no synthesized title page/TOC. The
    // custom preamble's own \title/\author/\maketitle conventions (if any)
    // are respected by the plain title-block path in assemble.ts.
    if (templateId === "custom") {
        return {
            header: { useChapters: false, needsTitlePage: false, needsToc: false, title: plan.title },
            tokensUsed: 0,
        };
    }

    // A short document with a flat heading structure has nothing ambiguous
    // either - skip the call.
    if (!plan.hasClearHeadings || (plan.maxLevel <= 1 && totalWords < 3000)) {
        return {
            header: { useChapters: false, needsTitlePage: false, needsToc: false, title: plan.title },
            tokensUsed: 0,
        };
    }

    const summary = buildSummary(plan);
    const system = `You are deciding the document-level LaTeX shape for a converted document. You see ONLY its heading outline and word counts, never its prose - decide structure, not content.

Output ONLY valid JSON:
{"use_chapters": boolean, "needs_title_page": boolean, "needs_toc": boolean}

Guidelines:
- use_chapters: true only if this reads as a long, multi-part work (thesis/book-like) where top-level headings are genuinely chapter-scale, not just section-scale.
- needs_title_page / needs_toc: true only for long, formal, multi-chapter documents. A short report or article should be false/false.`;

    const user = `Document heading outline (~${totalWords} words total):\n\n${summary || "(no headings detected)"}`;

    const r = await chatCompletion(
        [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
        { jsonMode: true, timeoutMs: 30_000 },
    );

    const parsed = parseJsonLoose(r.text);
    return {
        header: {
            useChapters: !!parsed.use_chapters,
            needsTitlePage: !!parsed.needs_title_page,
            needsToc: !!parsed.needs_toc,
            title: plan.title,
        },
        tokensUsed: r.totalTokens,
    };
}
