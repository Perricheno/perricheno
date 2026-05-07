// Stage 2.3 - Visual Generation.
// LLM generates TikZ code (usetikzlibrary + tikzpicture block).
// The TikZ snippet is stored as-is and later injected inline into main.tex by stage4.
// Zero compilation here — LaTeX compiler renders TikZ natively in the final document pass.

import { chatCompletion, type ChatMessage } from "./llm";
import type { PlannedVisual, GeneratedVisual } from "./types";

const CONCURRENCY = 4;

// ── Per-type TikZ layout blueprints ──────────────────────────────────────────
// Each blueprint gives exact TikZ style patterns, spacing, and color conventions.
// The LLM must FILL THEM WITH REAL CONTENT from the description — no placeholders.

const TYPE_BLUEPRINT: Record<string, string> = {
    mind_map: `
LIBRARY: \\usetikzlibrary{mindmap,backgrounds}
STRUCTURE:
\\begin{tikzpicture}[
  mindmap, grow cyclic,
  every node/.style=concept,
  concept color=teal!50!blue,
  level 1/.style={level distance=4.2cm, sibling angle=60, concept color=blue!50},
  level 2/.style={level distance=2.8cm, sibling angle=40, concept color=blue!25, font=\\small},
  level 3/.style={level distance=2.0cm, sibling angle=35, concept color=blue!12, font=\\scriptsize},
]
  \\node [root concept] {<<CENTRAL TOPIC>>}
    child { node {<<BRANCH 1>>}
      child { node {<<sub>>} }
      child { node {<<sub>>} }
    }
    child { node {<<BRANCH 2>>} ... }
    ...;
\\end{tikzpicture}
RULES: 4-6 level-1 branches, 2-3 level-2 children each. Use clip to keep within 14x9cm.
Every node text MUST reflect actual domain concepts from the description — no "Branch 1".`,

    concept_map: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,fit}
STYLE:
  box/.style = {draw, rounded corners=5pt, fill=blue!12, text width=2.6cm,
                align=center, font=\\small, inner sep=6pt, line width=0.7pt}
  arr/.style = {-{Stealth[length=6pt]}, thick, draw=gray!70}
  lbl/.style = {font=\\scriptsize\\itshape, fill=white, inner sep=2pt}
STRUCTURE:
  Place most-connected concept at center. Others around it at 3-4cm spacing.
  \\node[box] (A) {<<concept>>};
  \\node[box, right=3.5cm of A] (B) {<<concept>>};
  \\draw[arr] (A) -- node[lbl,above] {<<verb phrase>>} (B);
  Use curved edges for long-distance connections: \\draw[arr, bend left=20] ...
RULES: 7-10 nodes, 8-14 edges. Every edge MUST have a specific relationship label.
Domain vocabulary from the description is mandatory — no generic "relates to".`,

    hierarchy: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta}
STYLE (define once with \\tikzset):
  root/.style  = {draw, rounded corners=6pt, fill=teal!60!blue, text=white,
                  font=\\bfseries\\small, align=center, minimum width=3.5cm, inner sep=8pt}
  lvl1/.style  = {draw, rounded corners=5pt, fill=blue!30, font=\\small,
                  align=center, minimum width=2.8cm, inner sep=6pt}
  lvl2/.style  = {draw, rounded corners=4pt, fill=blue!12, font=\\scriptsize,
                  align=center, minimum width=2.2cm, inner sep=5pt}
  edge/.style  = {draw, thick, gray!60, -{Stealth[length=5pt]}}
STRUCTURE: Manual placement with \`positioning\`.
  \\node[root] (R) {<<root>>};
  \\node[lvl1, below left=1.2cm and 2cm of R] (A) {<<child>>};
  \\node[lvl1, below=1.2cm of R] (B) {<<child>>};
  \\draw[edge] (R) -- (A); \\draw[edge] (R) -- (B);
RULES: Root + 3-5 level-1 + 2-3 level-2 per branch. Fit within 14x9cm.`,

    framework: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,fit,backgrounds}
STYLE:
  input/.style   = {draw, rounded corners=6pt, fill=orange!20, align=center,
                    text width=2.8cm, minimum height=1.3cm, font=\\small, inner sep=8pt}
  process/.style = {draw, rounded corners=6pt, fill=teal!35, text=white, align=center,
                    text width=3.2cm, minimum height=1.5cm, font=\\small\\bfseries, inner sep=8pt}
  output/.style  = {draw, rounded corners=6pt, fill=blue!25, align=center,
                    text width=2.8cm, minimum height=1.3cm, font=\\small, inner sep=8pt}
  arr/.style     = {-{Stealth[length=7pt]}, line width=1.2pt, draw=gray!60}
LAYOUT: 3 columns. Input nodes left (stacked), process node center, output nodes right.
  \\node[process] (P) {<<core process / mediating mechanism>>};
  \\node[input, left=3cm of P, yshift=1cm]  (I1) {<<input/antecedent 1>>};
  \\node[input, left=3cm of P, yshift=-1cm] (I2) {<<input/antecedent 2>>};
  \\node[output, right=3cm of P, yshift=1cm]  (O1) {<<outcome 1>>};
  \\draw[arr] (I1) -- node[above,font=\\scriptsize]{<<label>>} (P);
  \\draw[arr] (P)  -- node[above,font=\\scriptsize]{<<label>>} (O1);
  \\begin{scope}[on background layer]
    \\node[fill=gray!5, rounded corners=10pt, fit=(I1)(I2), label=above:{\\scriptsize Inputs}] {};
  \\end{scope}
RULES: 2-3 inputs, 1-2 processes, 2-3 outputs. All box text from real theory in description.`,

    process_schema: `
LIBRARIES: \\usetikzlibrary{shapes.misc,arrows.meta,positioning,backgrounds}
STYLE:
  step/.style = {draw, rounded rectangle, fill=teal!30!blue!20, align=center,
                 text width=2.4cm, minimum height=1.1cm, font=\\small, inner sep=7pt,
                 rounded rectangle arc length=90}
  arr/.style  = {-{Stealth[length=7pt]}, line width=1.5pt, draw=teal!60!blue}
  num/.style  = {circle, fill=teal!60!blue, text=white, font=\\bfseries\\scriptsize,
                 inner sep=2pt, minimum size=16pt}
LAYOUT: Left-to-right, steps at same y. If >5 steps wrap to 2 rows.
  \\node[step] (S1) {<<Phase/Step name>>};
  \\node[step, right=1.4cm of S1] (S2) {<<Phase/Step name>>};
  \\draw[arr] (S1) -- (S2);
  \\node[num, above left=0pt and 0pt of S1] {1};
  \\node[num, above left=0pt and 0pt of S2] {2};
RULES: 4-7 steps. Names must be specific methodology phases from the description — no "Step 1".
Add a brief 1-line descriptor inside each step box below the name (\\\\{\\tiny descriptor}).`,

    relationship: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds}
STYLE (pick 3-4 colors by entity category):
  catA/.style = {ellipse, draw, fill=blue!20,   align=center, font=\\small, inner sep=5pt}
  catB/.style = {ellipse, draw, fill=teal!25,   align=center, font=\\small, inner sep=5pt}
  catC/.style = {ellipse, draw, fill=orange!20, align=center, font=\\small, inner sep=5pt}
  rel/.style  = {draw=gray!60, font=\\scriptsize, fill=white, inner sep=2pt}
LAYOUT: Place entities at varied (x,y) coordinates — NOT in a circle, spread naturally.
  \\node[catA] (A) at (0,0) {<<entity>>};
  \\node[catB] (B) at (4,2) {<<entity>>};
  \\draw[<->, thick, gray!50] (A) -- node[rel,sloped]{<<relationship>>} (B);
  \\draw[->, thick, gray!50]  (B) -- node[rel,sloped]{<<relationship>>} (C);
RULES: 6-9 entities, 8-12 relationships. Entity size proportional to number of connections.
Relationship labels must be specific domain verbs from description — no "influences".`,

    comparison: `
LIBRARIES: \\usetikzlibrary{matrix,positioning}
STYLE:
  header/.style = {draw, fill=teal!55!blue, text=white, font=\\bfseries\\small,
                   minimum width=3.2cm, minimum height=0.9cm, align=center}
  crit/.style   = {draw, fill=gray!10, font=\\small\\bfseries, minimum width=3.0cm,
                   minimum height=0.8cm, align=center, text width=2.8cm}
  cellE/.style  = {draw, fill=white,     font=\\small, minimum width=3.2cm,
                   minimum height=0.8cm, align=center, text width=3.0cm}
  cellO/.style  = {draw, fill=blue!5,    font=\\small, minimum width=3.2cm,
                   minimum height=0.8cm, align=center, text width=3.0cm}
STRUCTURE (manual rows for full control):
  \\node[header] (H0) at (0,0) {Criterion};
  \\node[header, right=0pt of H0] (H1) {<<Option A>>};
  \\node[header, right=0pt of H1] (H2) {<<Option B>>};
  \\node[crit,  below=0pt of H0] (C1) {<<criterion>>};
  \\node[cellE, below=0pt of H1] (V1A) {<<value>>};
  \\node[cellE, below=0pt of H2] (V1B) {<<value>>};
RULES: 2-3 comparison subjects, 5-8 criteria. Use ✓ ✗ ≈ + or quantitative values.
All criteria and values MUST come from the description — no "Criterion 1".`,
};

// ── LLM prompt ────────────────────────────────────────────────────────────────

function buildMessages(visual: PlannedVisual, language: string): ChatMessage[] {
    const blueprint = TYPE_BLUEPRINT[visual.type] ?? TYPE_BLUEPRINT.concept_map;

    const system = `You are a senior academic TikZ specialist. Your diagrams appear in IEEE, Springer, and Elsevier publications. You produce publication-ready figures that reviewers and readers immediately understand.

OUTPUT FORMAT: Return ONLY the TikZ snippet:
  1. \\usetikzlibrary{...} line(s) — if needed
  2. \\begin{tikzpicture}[...] ... \\end{tikzpicture}
Nothing else. No \\documentclass, no \\usepackage, no markdown fences, no comments, no explanation.

CONTENT RULES (most important):
- Every node label, edge label, and box text MUST be extracted from the provided description.
- ZERO generic placeholders: no "Node 1", "Category A", "Branch 1", "Step 1", "Entity", "Concept".
- Use the actual domain terminology, theory names, methodology steps, and relationships from the description.
- The diagram must be self-explanatory to a domain expert reading it cold.

TECHNICAL RULES:
- Language of all text: ${language}. Translate every label if needed.
- Bounding box: fit within 14 cm × 9 cm. Use \\clip or manual coordinates to enforce this.
- Use only standard TikZ libraries listed in the blueprint.
- Font sizes: \\small for main labels, \\scriptsize for secondary labels. Never smaller.
- Colors: muted academic palette — teal!30..50, blue!15..40, orange!15..25, gray!10..20. No bright/saturated colors.
- Line widths: 0.7–1.5pt for edges, 1.5pt for primary flow arrows.
- Every \\node must have a unique ID. Coordinate all \\draw commands to existing node IDs.
- Test mentally that every referenced node ID is actually defined before using it in \\draw.
- Do NOT use \\usepackage{fontspec} or \\usepackage{polyglossia} — the document uses T2A/babel encoding.
- CYRILLIC / RUSSIAN: The document preamble already has \\usepackage[T2A]{fontenc} and \\usepackage[utf8]{inputenc}. You can write Cyrillic text directly in UTF-8 inside node labels — no extra packages or commands needed. Example: \\node {Теоретическая база};`;

    const user = `VISUAL TYPE: ${visual.type}
SECTION IN DOCUMENT: "${visual.sectionHeading}"
FIGURE CAPTION: ${visual.caption}

CONTENT TO VISUALIZE — extract ALL concepts, relationships, steps, entities from this:
${visual.description}

LAYOUT BLUEPRINT FOR THIS TYPE:
${blueprint}

PROFESSIONAL QUALITY CHECKLIST (verify before outputting):
[ ] Every node contains real domain content from the description above
[ ] No placeholder text anywhere ("Node 1", "Branch A", "Step X", etc.)
[ ] All edge/arrow labels are specific relationship verbs or qualifiers
[ ] Colors follow the muted academic palette from the blueprint
[ ] Fits within 14cm × 9cm
[ ] All node IDs used in \\draw are defined as \\node
[ ] Language of all text is ${language}

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
                const r = await chatCompletion(messages, { timeoutMs: 120_000 });
                totalTokens += r.totalTokens;

                const tikzCode = stripFences(r.text);
                console.log(`[Stage2.3] ✓ ${visual.id}  type=${visual.type}  tokens=${r.totalTokens}`);

                results.push({
                    id: visual.id,
                    sectionHeading: visual.sectionHeading,
                    filename: `${visual.id}.png`,
                    caption: visual.caption,
                    label: visual.label,
                    tikzCode,
                    type: visual.type,
                });
            } catch (e: any) {
                const err = String(e?.message ?? e).slice(0, 300);
                console.error(`[Stage2.3] ✗ ${visual.id} failed: ${err}`);
                results.push({
                    id: visual.id,
                    sectionHeading: visual.sectionHeading,
                    filename: `${visual.id}.png`,
                    caption: visual.caption,
                    label: visual.label,
                    tikzCode: "",
                    type: visual.type,
                    failed: true,
                    error: err,
                });
            }

            completed++;
            onProgress?.(completed, visuals.length, visual.id);
        }
    });

    await Promise.all(workers);

    const ok = results.filter(v => !v.failed).length;
    console.log(`[Stage2.3] Done: ${ok}/${results.length} visuals generated`);
    return { generatedVisuals: results, tokensUsed: totalTokens };
}
