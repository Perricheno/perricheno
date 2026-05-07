// Stage 2.3 - Visual Generation.
// LLM generates TikZ code → wrapped in standalone LaTeX → existing LaTeX compiler → PDF
// → existing pdf-extractor /to-png → PNG base64.
// Zero new infrastructure. No Chrome. No new services.

import JSZip from "jszip";
import { chatCompletion, type ChatMessage } from "./llm";
import type { PlannedVisual, GeneratedVisual } from "./types";
import { withRetry } from "../stages";

const CONCURRENCY = 3;

const LATEX_COMPILER_URL = process.env.LATEX_COMPILER_URL!;
const LATEX_COMPILER_KEY = process.env.LATEX_COMPILER_KEY!;
const PDF_EXTRACTOR_URL  = process.env.PDF_EXTRACTOR_URL ?? "http://pdf-extractor:8080";

// ── Per-type TikZ guidance ────────────────────────────────────────────────────

const TYPE_GUIDE: Record<string, string> = {
    mind_map: `
Draw a radial mind map using TikZ mindmap library.
Central concept in the root node. 4–6 main branches as \`child\` nodes radiating outward.
Each main branch has 2–3 sub-children.
Use: \\tikzset{every node/.style={font=\\small}}
Colors: use concept color=blue!40 for root, teal!40, orange!30, purple!30 for branches.
Example skeleton:
\\begin{tikzpicture}[mindmap, grow cyclic, every node/.style=concept,
  concept color=blue!40, level 1/.append style={level distance=4cm, sibling angle=72},
  level 2/.append style={level distance=2.5cm, sibling angle=45}]
  \\node{Central Topic} child { node{Branch 1} child{node{Sub}} } ...;
\\end{tikzpicture}`,

    concept_map: `
Draw a concept map using TikZ with nodes and labeled directed edges.
Nodes: \\node[draw, rounded corners, fill=blue!15, text width=2.5cm, align=center] (id) {Label};
Arrows: \\draw[->, thick] (a) -- node[above, font=\\tiny]{relation} (b);
Use \`positioning\` library. Space nodes ~3–4cm apart. 6–10 nodes total.
Most-connected concept near center. Edge labels describe semantic relationship.`,

    hierarchy: `
Draw a top-down tree hierarchy using TikZ \`trees\` library.
\\begin{tikzpicture}[sibling distance=4cm, level distance=2cm,
  every node/.style={draw, rounded corners, fill=blue!10, align=center, font=\\small}]
  \\node{Root} child{node{Child 1} child{node{Leaf}}} child{node{Child 2}};
\\end{tikzpicture}
Root node: fill=blue!40, white text. Each level gets lighter fill.`,

    framework: `
Draw a theoretical framework as a flow diagram: left boxes → center box → right boxes.
Use \\node[draw, rounded corners=6pt, fill=blue!20, minimum width=3cm, minimum height=1.2cm, align=center]
and \\draw[->, thick, >=stealth] arrows between them.
Use \`shapes\`, \`arrows.meta\`, \`positioning\` libraries.
Label arrows with short text (\\node[midway, above, font=\\scriptsize]).
3-column layout: inputs (left), process (center, darker fill), outcomes (right).`,

    process_schema: `
Draw a left-to-right process flow. Each step: stadium/rounded rect node.
\\node[draw, stadium, fill=blue!30, font=\\small, minimum width=2.5cm] (s1) {Step 1};
\\draw[->, thick] (s1) -- (s2);
Use \`shapes.misc\` for stadium. Steps connected with thick arrows. 4–6 steps.
Add step numbers above each node with \\node[above, font=\\tiny]{1}.`,

    relationship: `
Draw a relationship network. Entities as ellipse nodes connected by labeled lines.
\\node[ellipse, draw, fill=teal!20, align=center, font=\\small] (a) {Entity A};
\\draw[<->, thick] (a) -- node[midway, fill=white, font=\\scriptsize]{relates to} (b);
Use bidirectional arrows for mutual relationships, unidirectional for one-way.
6–8 entities spread across the canvas. Node size can vary by importance.`,

    comparison: `
Draw a comparison table using TikZ \`matrix\` library.
\\matrix[matrix of nodes, nodes={draw, minimum width=3cm, minimum height=0.8cm, align=center, font=\\small},
  column sep=-\\pgflinewidth, row sep=-\\pgflinewidth] {
  |[fill=blue!40, text=white]| Criterion & |[fill=blue!40, text=white]| Option A & |[fill=blue!40, text=white]| Option B \\\\
  Row 1 label & value & value \\\\
};
2–3 comparison columns. Alternating row fills: white and blue!5.`,
};

// ── LLM prompt ────────────────────────────────────────────────────────────────

function buildMessages(visual: PlannedVisual, language: string): ChatMessage[] {
    const guide = TYPE_GUIDE[visual.type] ?? TYPE_GUIDE.concept_map;

    const system = `You are an expert academic TikZ programmer. You create publication-quality structural diagrams for research papers and diploma theses.

Generate ONLY the TikZ picture code — the content that goes inside \\begin{tikzpicture}...\\end{tikzpicture} plus any needed \\usetikzlibrary{} calls before it.

RULES:
- Include \\usetikzlibrary{...} lines at the top if needed (positioning, arrows.meta, mindmap, trees, shapes, shapes.misc, matrix, etc.).
- Then \\begin{tikzpicture}[...] ... \\end{tikzpicture}.
- All text labels MUST be in ${language}.
- Use only standard TikZ libraries (no external packages beyond tikz itself).
- Fit the diagram within a ~14cm × 9cm bounding box.
- Academic style: clean, professional, muted colors (blue!20, teal!30, etc.), readable font sizes (\\small, \\scriptsize).
- No \\documentclass, no \\begin{document}, no \\usepackage — only the TikZ snippet.
- Output raw LaTeX only. No markdown fences, no explanation.`;

    const user = `Visual type: ${visual.type}
Section: "${visual.sectionHeading}"
Caption: ${visual.caption}

Content to depict:
${visual.description}

Type-specific TikZ instructions:
${guide}

Generate the TikZ snippet now:`;

    return [
        { role: "system", content: system },
        { role: "user", content: user },
    ];
}

function stripFences(raw: string): string {
    return raw
        .replace(/^```(?:latex|tikz)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
}

// ── Standalone LaTeX wrapper ───────────────────────────────────────────────────

function wrapInStandalone(tikzSnippet: string, language: string): string {
    const babel = language === "ru" || language === "kk" || language === "uk"
        ? "\\usepackage[T2A]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage[russian]{babel}"
        : "\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}";

    return `\\documentclass[tikz, border=8pt]{standalone}
${babel}
\\usepackage{tikz}
\\usepackage{amsmath}
\\begin{document}
${tikzSnippet}
\\end{document}
`;
}

// ── Compile LaTeX → PDF ───────────────────────────────────────────────────────

async function compileTex(mainTex: string): Promise<Buffer> {
    if (!LATEX_COMPILER_URL || !LATEX_COMPILER_KEY) {
        throw new Error("LATEX_COMPILER_URL / LATEX_COMPILER_KEY not configured");
    }

    const zip = new JSZip();
    zip.file("main.tex", mainTex);
    const zipBlob = await zip.generateAsync({ type: "blob" });

    const form = new FormData();
    form.append("file", zipBlob, "project.zip");

    const res = await fetch(LATEX_COMPILER_URL, {
        method: "POST",
        headers: { "x-api-key": LATEX_COMPILER_KEY },
        body: form,
        signal: AbortSignal.timeout(60_000),
    });

    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && !ct.includes("json") && !ct.includes("text")) {
        return Buffer.from(await res.arrayBuffer());
    }

    const errText = await res.text();
    let log = errText;
    try { log = JSON.parse(errText).error ?? JSON.parse(errText).log ?? errText; } catch {}
    throw new Error(`LaTeX compile failed: ${log.slice(0, 300)}`);
}

// ── PDF → PNG via pdf-extractor ───────────────────────────────────────────────

async function pdfToPng(pdfBuf: Buffer): Promise<Buffer> {
    const res = await fetch(`${PDF_EXTRACTOR_URL}/to-png`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: new Uint8Array(pdfBuf),
        signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(`pdf-extractor /to-png: ${err.error}`);
    }

    const { image } = await res.json();
    if (!image) throw new Error("pdf-extractor returned no image");
    return Buffer.from(image, "base64");
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runStage2_3(
    visuals: PlannedVisual[],
    language: string,
    onProgress?: (done: number, total: number, id?: string) => void,
): Promise<{ generatedVisuals: GeneratedVisual[]; tokensUsed: number }> {
    if (visuals.length === 0) return { generatedVisuals: [], tokensUsed: 0 };

    console.log(`[Stage2.3] Generating ${visuals.length} TikZ visual(s)`);
    let totalTokens = 0;
    let completed = 0;
    const results: GeneratedVisual[] = [];

    const queue = [...visuals];
    const workers = Array.from({ length: Math.min(CONCURRENCY, visuals.length) }, async () => {
        while (queue.length > 0) {
            const visual = queue.shift()!;
            try {
                const messages = buildMessages(visual, language);
                const r = await withRetry(() => chatCompletion(messages, { timeoutMs: 60_000 }), 2, 800);
                totalTokens += r.totalTokens;

                const tikz = stripFences(r.text);
                const tex  = wrapInStandalone(tikz, language);
                const pdf  = await compileTex(tex);
                const png  = await pdfToPng(pdf);
                const pngBase64 = png.toString("base64");

                console.log(`[Stage2.3] ✓ ${visual.id}.png  type=${visual.type}  size=${(png.length / 1024).toFixed(0)}KB`);

                results.push({
                    id: visual.id,
                    sectionHeading: visual.sectionHeading,
                    filename: `${visual.id}.png`,
                    caption: visual.caption,
                    label: visual.label,
                    pngBase64,
                    type: visual.type,
                });
            } catch (e: any) {
                console.error(`[Stage2.3] ✗ ${visual.id}:`, e?.message);
                results.push({
                    id: visual.id,
                    sectionHeading: visual.sectionHeading,
                    filename: `${visual.id}.png`,
                    caption: visual.caption,
                    label: visual.label,
                    pngBase64: "",
                    type: visual.type,
                    failed: true,
                    error: String(e?.message || e).slice(0, 200),
                });
            } finally {
                completed++;
                onProgress?.(completed, visuals.length, visual.id);
            }
        }
    });

    await Promise.all(workers);

    const ok = results.filter(v => !v.failed).length;
    console.log(`[Stage2.3] Done: ${ok}/${results.length} visuals generated`);
    return { generatedVisuals: results, tokensUsed: totalTokens };
}
