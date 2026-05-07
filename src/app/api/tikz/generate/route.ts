// TikZ Studio - generate and compile a TikZ diagram.
// Synchronous: LLM generates TikZ → LaTeX compiler → return PDF + source code.
// Retries up to 3 times with error feedback if compilation fails.

import { NextResponse } from "next/server";
import JSZip from "jszip";
import { verifySession } from "@/lib/session";
import { checkAndDeductUsage } from "@/lib/db";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LATEX_COMPILER_URL = process.env.LATEX_COMPILER_URL!;
const LATEX_COMPILER_KEY = process.env.LATEX_COMPILER_KEY!;
const MODEL = "gpt-5-mini-2025-08-07";

// ── Type blueprints ────────────────────────────────────────────────────────────

const TYPE_BLUEPRINT: Record<string, string> = {
    mind_map: `LIBRARY: \\usetikzlibrary{mindmap,backgrounds}
\\begin{tikzpicture}[mindmap, grow cyclic, every node/.style=concept, concept color=teal!50!blue,
  level 1/.style={level distance=4.2cm, sibling angle=60, concept color=blue!50},
  level 2/.style={level distance=2.8cm, sibling angle=40, concept color=blue!25, font=\\small}]
  \\node [root concept] {<<CENTRAL TOPIC>>}
    child { node {<<BRANCH>>} child { node {<<sub>>} } }
    child { node {<<BRANCH>>} } ...;
\\end{tikzpicture}
RULES: 4-6 main branches, 2-3 sub-branches each. All text from user description.`,

    concept_map: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,fit}
Styles: box={draw,rounded corners=5pt,fill=blue!12,text width=2.6cm,align=center,font=\\small,inner sep=6pt}
        arr={-{Stealth[length=6pt]},thick,draw=gray!70}
        lbl={font=\\scriptsize\\itshape,fill=white,inner sep=2pt}
RULES: 7-10 nodes, 8-14 labeled edges. Every edge label = specific relationship verb. Domain terms only.`,

    hierarchy: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta}
Styles: root={draw,rounded corners=6pt,fill=teal!60!blue,text=white,font=\\bfseries\\small,align=center,minimum width=3.5cm,inner sep=8pt}
        lvl1={draw,rounded corners=5pt,fill=blue!30,font=\\small,align=center,minimum width=2.8cm,inner sep=6pt}
        lvl2={draw,rounded corners=4pt,fill=blue!12,font=\\scriptsize,align=center,minimum width=2.2cm,inner sep=5pt}
RULES: Root + 3-5 level-1 children + 2-3 level-2 per branch. All terms from description.`,

    framework: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,fit,backgrounds}
Layout: inputs left column, process center, outputs right column.
Styles: input={draw,rounded corners=6pt,fill=orange!20,align=center,text width=2.8cm,minimum height=1.3cm,font=\\small}
        process={draw,rounded corners=6pt,fill=teal!35,text=white,text width=3.2cm,minimum height=1.5cm,font=\\small\\bfseries}
        output={draw,rounded corners=6pt,fill=blue!25,align=center,text width=2.8cm,minimum height=1.3cm,font=\\small}
RULES: 2-3 inputs, 1-2 processes, 2-3 outputs. Background grouping boxes with labels.`,

    process_schema: `LIBRARIES: \\usetikzlibrary{shapes.misc,arrows.meta,positioning,backgrounds}
step={draw,rounded rectangle,fill=teal!30!blue!20,align=center,text width=2.4cm,minimum height=1.1cm,font=\\small,inner sep=7pt}
arr={-{Stealth[length=7pt]},line width=1.5pt,draw=teal!60!blue}
num={circle,fill=teal!60!blue,text=white,font=\\bfseries\\scriptsize,inner sep=2pt,minimum size=16pt}
Layout: left-to-right. Number each step (\\node[num] above-left of each step box).
RULES: 4-7 steps. Each step has a name + \\tiny descriptor. No "Step 1".`,

    relationship: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds}
Use 3-4 color styles for entity categories (ellipse nodes).
rel={draw=gray!60,font=\\scriptsize,fill=white,inner sep=2pt}
Place entities at varied coordinates (not circle). Draw labeled bidirectional/directed edges.
RULES: 6-9 entities, 8-12 labeled relationships. Specific domain verbs, no "influences".`,

    comparison: `LIBRARIES: \\usetikzlibrary{matrix,positioning}
Manual row/column layout: header row + criterion rows. Alternating white/blue!5 cell fill.
header={draw,fill=teal!55!blue,text=white,font=\\bfseries\\small,minimum width=3.2cm,minimum height=0.9cm}
crit={draw,fill=gray!10,font=\\small\\bfseries,minimum width=3.0cm,minimum height=0.8cm}
RULES: 2-3 comparison subjects, 5-8 criteria rows. Use ✓ ✗ ≈ or quantitative values.`,

    timeline: `LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,decorations.pathmorphing}
Draw horizontal axis (line width=1.5pt), alternate events above/below axis.
event={draw,rounded corners=4pt,fill=blue!12,font=\\small,align=center,text width=2.4cm,inner sep=5pt}
date={font=\\scriptsize\\bfseries,text=teal!60!blue}
RULES: 4-7 events alternating above/below. All titles and dates from description.`,

    flowchart: `LIBRARIES: \\usetikzlibrary{shapes.geometric,arrows.meta,positioning,backgrounds}
start={draw,rounded rectangle,fill=teal!40,text=white,font=\\small\\bfseries,align=center,text width=2.6cm}
process={draw,rectangle,fill=blue!12,font=\\small,align=center,text width=2.8cm,minimum height=1.0cm}
decision={draw,diamond,fill=orange!22,font=\\small,align=center,aspect=2.2,inner sep=3pt,text width=2.2cm}
io={draw,trapezium,fill=gray!12,font=\\small,align=center,trapezium left angle=75,trapezium right angle=105,text width=2.4cm}
RULES: 1 start, 1 end, 2-4 decision diamonds, 4-8 processes. Yes/No branch labels.`,

    network: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds,shapes.geometric}
source={circle,draw,fill=teal!40,text=white,font=\\small\\bfseries,minimum size=1.0cm}
sink={circle,draw,fill=blue!35,text=white,font=\\small\\bfseries,minimum size=1.0cm}
middle={circle,draw,fill=gray!20,font=\\small,minimum size=0.85cm}
edir={-{Stealth[length=5pt]},draw=gray!55}
Layout: sources left (x=0), intermediates center, sinks right. Weighted/labeled edges.
RULES: 3-5 sources, 4-8 intermediates, 2-4 sinks. Domain labels on edges.`,

    venn: `LIBRARIES: \\usetikzlibrary{shapes.geometric}
Three overlapping circles with fill opacity 0.3 and different base colors (blue!40, teal!50, orange!40).
Place concept labels in each region (unique, intersections, center overlap).
RULES: 2-3 circles, labels in each region. All region labels from user description.`,

    architecture: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,fit,backgrounds}
Layered boxes: each layer = rounded-rectangle container with component boxes inside.
layer={draw,rounded corners=8pt,fill=gray!6,inner sep=10pt}
component={draw,rounded corners=5pt,fill=blue!15,font=\\small,align=center,minimum height=0.9cm,text width=2.8cm}
flow={-{Stealth[length=6pt]},line width=1.2pt,draw=teal!60}
RULES: 3-5 layers (e.g. Presentation, Business Logic, Data), 2-4 components per layer.`,

    cycle: `LIBRARIES: \\usetikzlibrary{arrows.meta,positioning}
Arrange 4-6 stage nodes in a circle (compute with \\foreach and polar coords).
stage={draw,rounded corners=6pt,fill=teal!30!blue!20,align=center,text width=2.6cm,minimum height=1.1cm,font=\\small}
Curved arrows between consecutive stages: \\draw[-{Stealth},bend left=20].
Add short descriptor below each stage name.
RULES: 4-6 stages in closed loop. Arrows go clockwise. All stage names from description.`,

    causal_loop: `LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,backgrounds}
Place 5-8 variable nodes at varied coordinates.
var={draw,rounded corners=5pt,fill=blue!10,font=\\small,align=center,text width=2.2cm,inner sep=6pt}
Arcs: ->{+} reinforcing or ->{-} balancing. Label polarity (+/-) near arrowhead.
Draw circular feedback loops. Add R or B label for reinforcing/balancing loops.
RULES: Variables from description, explicit polarity on every arc.`,

    matrix_2x2: `LIBRARIES: \\usetikzlibrary{positioning,backgrounds}
Draw 2×2 grid (two axis lines through center). Label quadrants.
axis labels on X (low→high) and Y (low→high) outside the grid.
quadrant fill: TL=blue!12, TR=teal!20, BL=gray!10, BR=orange!15
Place items from description as small rounded-rect nodes in appropriate quadrant.
RULES: Both axes labeled from description. At least 1 item per quadrant.`,

    stakeholder_map: `LIBRARIES: \\usetikzlibrary{positioning,backgrounds}
Concentric circles: inner (High influence/High interest), middle, outer rings.
focal={circle,fill=teal!50,text=white,font=\\bfseries\\small,minimum size=1.4cm}
stake={draw,rounded corners=4pt,fill=blue!15,font=\\scriptsize,align=center,text width=1.8cm}
Place stakeholder nodes on rings with lines to center.
RULES: 1 focal entity, 8-12 stakeholders placed by proximity/influence.`,

    fishbone: `LIBRARIES: \\usetikzlibrary{arrows.meta,positioning}
Draw horizontal spine arrow pointing right to "Effect" box.
4-6 diagonal branch arrows (alternating above/below at 45°) from spine.
Each branch = cause category with 2-3 sub-causes as shorter twigs.
branch={font=\\small\\bfseries,teal!60!blue}  sub={font=\\scriptsize}
RULES: Effect on right, 4-6 cause categories, 2-3 sub-causes each. All from description.`,

    state_machine: `LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,automata}
state={circle,draw,fill=blue!15,font=\\small,minimum size=1.2cm,align=center}
init={circle,draw,fill=teal!40,text=white,font=\\small\\bfseries,minimum size=1.2cm}
accept={circle,draw,double,fill=orange!20,font=\\small,minimum size=1.2cm}
trans={-{Stealth[length=5pt]},draw=gray!60,font=\\scriptsize,fill=white,inner sep=1pt}
Use \\draw[trans,bend left=20] for bidirectional transitions.
RULES: 3-7 states (1 init, 1+ accepting). Every transition labeled with event/condition.`,

    sequence_diagram: `LIBRARIES: \\usetikzlibrary{arrows.meta,positioning}
Vertical lifelines as dashed lines; horizontal message arrows between them.
lifeline={font=\\small\\bfseries,align=center,text width=2cm,draw,fill=blue!12,minimum height=0.8cm}
msg={-{Stealth[length=5pt]},draw=gray!60,font=\\scriptsize,fill=white,inner sep=1pt}
reply={dashed,-{Stealth[length=5pt]},draw=gray!60,font=\\scriptsize}
Activation boxes as thin rectangles on lifelines.
RULES: 3-5 actors, 6-10 messages with labels. Return arrows dashed.`,

    er_diagram: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,er}
entity={draw,rectangle,fill=teal!20,font=\\small\\bfseries,minimum width=2.5cm,minimum height=0.8cm}
attr={draw,ellipse,fill=blue!10,font=\\scriptsize,align=center,text width=1.8cm}
rel={draw,diamond,fill=orange!20,font=\\small,aspect=2,inner sep=3pt}
Cardinality labels (1, N, M) near relationship connectors.
RULES: 3-5 entities, 1-3 attributes each, 2-4 relationships with cardinality.`,

    onion_model: `LIBRARIES: \\usetikzlibrary{backgrounds,positioning}
Concentric filled circles from outside in, each fill slightly darker.
Colors: outer=gray!12, middle=blue!15, inner=teal!25, core=teal!50
Labels: center label on each ring (\\node at center with font sized to ring width).
RULES: 4-5 layers from core outward. Layer names from description (e.g. Core→Context→Environment).`,

    pipeline_flow: `LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,shapes.misc,backgrounds}
stage={draw,rounded rectangle,fill=blue!15,align=center,text width=2.4cm,minimum height=1.1cm,font=\\small,rounded rectangle arc length=90}
data={draw=gray!50,dashed,-{Stealth[length=5pt]},font=\\scriptsize}
arrow={-{Stealth[length=7pt]},line width=1.5pt,draw=teal!60}
Annotate flow arrows with data type/format labels. Optional feedback arc at top.
RULES: 4-8 pipeline stages, annotated data flows between each. Feedback arc if described.`,

    force_field: `LIBRARIES: \\usetikzlibrary{arrows.meta,positioning}
Vertical equilibrium line in center. Driving forces on left (→), restraining on right (←).
driving={draw,fill=teal!20,font=\\small,align=right,text width=3cm,inner sep=5pt}
restraining={draw,fill=orange!20,font=\\small,align=left,text width=3cm,inner sep=5pt}
Arrow length proportional to force strength (1.5-3cm).
RULES: 4-6 driving forces, 4-6 restraining forces. All named from description.`,

    gantt: `LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,backgrounds}
Manual Gantt: horizontal time axis at bottom, tasks stacked vertically.
task={draw,fill=blue!25,minimum height=0.7cm,font=\\small}
milestone={circle,fill=teal!50,minimum size=0.4cm}
Draw time axis with period labels. Each task = \\fill[blue!25] (x1,y) rectangle (x2,y+0.6);
RULES: 5-9 tasks, time periods from description. Milestones as diamonds on axis.`,

    value_chain: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds,fit}
5 primary activities in a row (arrow-shaped boxes), 4 support activities stacked above.
primary={draw,fill=blue!20,font=\\small,align=center,minimum width=2.3cm,minimum height=1.5cm}
support={draw,fill=gray!12,font=\\small,align=center,text width=9cm,minimum height=0.7cm}
margin={draw,fill=teal!30,font=\\small\\bfseries,rotate=90,minimum width=4.8cm,minimum height=1.0cm}
RULES: All 5 Porter primary + 4 support activity names from description.`,

    ecosystem_map: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds,fit}
focal={draw,circle,fill=teal!45,text=white,font=\\bfseries,minimum size=1.6cm}
actor={draw,rounded corners=5pt,fill=blue!15,font=\\small,align=center,text width=2cm,minimum height=0.8cm}
sector={draw=gray!30,rounded corners=8pt,fill=gray!5,inner sep=8pt}
Group actors by sector (background fit-node). Interaction arrows from focal entity.
RULES: 1 focal + 8-14 actors in 3-5 sector groups. Arrow labels = interaction type.`,

    bracket_tree: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta}
root={draw,fill=teal!40,text=white,font=\\bfseries\\small,align=center,minimum width=2.5cm}
node1={draw,fill=blue!20,font=\\small,align=center,minimum width=2.2cm}
node2={draw,fill=blue!10,font=\\scriptsize,align=center,minimum width=2.0cm}
Hierarchical tree with angled bracket-style connectors (\\draw commands with right-angle bends).
RULES: Root + 3-4 children + 2-3 grandchildren each. Domain category labels at each node.`,

    wbs: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds}
project={draw,fill=teal!50,text=white,font=\\bfseries\\small,align=center,minimum width=4cm,minimum height=0.9cm}
deliverable={draw,fill=blue!25,font=\\small,align=center,minimum width=3cm,minimum height=0.8cm}
workpkg={draw,fill=blue!10,font=\\scriptsize,align=center,minimum width=2.4cm,minimum height=0.7cm}
WBS codes as tiny labels above each box (e.g. 1.1, 1.2, 1.1.1).
RULES: 1 project → 3-4 deliverables → 2-3 work packages each. Codes from description.`,

    swot: `LIBRARIES: \\usetikzlibrary{positioning,backgrounds}
Draw 2×2 grid with \\draw commands. Header boxes: S=teal!50, W=orange!35, O=blue!35, T=red!30.
Items in each quadrant as \\node[font=\\scriptsize,align=left] with bullet points.
Center label: subject/entity name.
RULES: Quadrant headers: Strengths/Weaknesses/Opportunities/Threats. 3-5 items each from description.`,

    systems_map: `LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds,fit}
boundary={draw,dashed,line width=1.2pt,rounded corners=12pt,fill=blue!5}
internal={draw,rounded corners=5pt,fill=blue!15,font=\\small,align=center,minimum width=2.4cm}
external={draw,rounded corners=5pt,fill=gray!15,font=\\small,align=center,minimum width=2.2cm}
flow={-{Stealth[length=6pt]},line width=1.0pt}
RULES: System boundary box containing 4-6 internal components. 3-5 external actors outside.
Cross-boundary flows labeled with data/resource type.`,
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior academic TikZ specialist. Your diagrams appear in IEEE and Springer publications. You produce publication-ready standalone TikZ figures.

OUTPUT FORMAT — return ONLY the TikZ snippet:
  1. \\usetikzlibrary{...} line(s) — if libraries needed
  2. \\begin{tikzpicture}[...] ... \\end{tikzpicture}
Nothing else. No \\documentclass, no \\usepackage, no markdown fences, no comments outside TikZ.

TECHNICAL RULES:
- Bounding box: fit within 14 cm × 9 cm. Use clip or manual coordinates.
- Only standard TikZ libraries (positioning, arrows.meta, shapes.*, matrix, fit, backgrounds, mindmap, decorations.*, automata, er, etc.)
- Font sizes: \\small for main labels, \\scriptsize for secondary. Never smaller.
- Colors: muted academic palette — teal!30..50, blue!15..40, orange!15..25, gray!10..20.
- Every \\node must have a unique ID used consistently in \\draw commands.
- ZERO generic placeholders: no "Node 1", "Category A", "Step 1", "Entity X".
- All text comes from the user description.
- Do NOT use \\usepackage{fontspec} or \\usepackage{polyglossia}.
- CYRILLIC: document preamble has T2A + utf8 already — write Cyrillic UTF-8 directly in node labels.`;

// ── LLM call helper ────────────────────────────────────────────────────────────

async function callOpenAI(body: object, timeoutMs = 90_000): Promise<{ ok: true; text: string; tokens: number } | { ok: false; error: string }> {
    if (!OPENAI_API_KEY) return { ok: false, error: "OpenAI API key not configured." };

    let res: Response;
    try {
        res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (err: any) {
        return { ok: false, error: `Network error: ${err?.message ?? "timeout"}` };
    }

    const rawText = await res.text();
    if (rawText.trimStart().startsWith("<")) return { ok: false, error: "OpenAI returned HTML" };

    let data: any;
    try { data = JSON.parse(rawText); } catch { return { ok: false, error: "Non-JSON response" }; }

    if (!res.ok) return { ok: false, error: `OpenAI HTTP ${res.status}: ${data?.error?.message ?? ""}` };

    const text = data.choices?.[0]?.message?.content ?? "";
    const tokens = data.usage?.total_tokens ?? 0;
    return { ok: true, text: text.trim(), tokens };
}

// ── LaTeX compile helpers ─────────────────────────────────────────────────────

function wrapInStandalone(tikzSnippet: string, language: string): string {
    const babel = ["ru", "kk", "uk"].includes(language)
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

function stripFences(raw: string): string {
    return raw.replace(/^```(?:latex|tikz)?\s*/i, "").replace(/\s*```$/, "").trim();
}

async function compileTikz(tikzSnippet: string, language: string): Promise<
    { ok: true; pdfBase64: string } | { ok: false; log: string }
> {
    if (!LATEX_COMPILER_URL || !LATEX_COMPILER_KEY) return { ok: false, log: "Compiler not configured." };

    const zip = new JSZip();
    zip.file("main.tex", wrapInStandalone(tikzSnippet, language));
    const zipBlob = await zip.generateAsync({ type: "blob" });

    const form = new FormData();
    form.append("file", zipBlob, "project.zip");

    let res: Response;
    try {
        res = await fetch(LATEX_COMPILER_URL, {
            method: "POST",
            headers: { "x-api-key": LATEX_COMPILER_KEY },
            body: form,
            signal: AbortSignal.timeout(120_000),
        });
    } catch (err: any) {
        return { ok: false, log: `Compiler network error: ${err?.message}` };
    }

    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && !ct.includes("json") && !ct.includes("text")) {
        const pdfBuf = await res.arrayBuffer();
        const pdfBase64 = Buffer.from(pdfBuf).toString("base64");
        return { ok: true, pdfBase64 };
    }

    const text = await res.text();
    let log = text;
    try { const j = JSON.parse(text); log = j.error ?? j.log ?? text; } catch {}
    return { ok: false, log: String(log).slice(0, 500) };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const precheck = await checkAndDeductUsage(userId, "visuals", 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ error: "LIMIT_REACHED", details: "Visual limit reached." }, { status: 402 });
    }

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { prompt, visualType = "concept_map", language = "en" } = body;
    if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

    const blueprint = TYPE_BLUEPRINT[visualType] ?? TYPE_BLUEPRINT.concept_map;
    const langName = ({ en: "English", ru: "Russian", uk: "Ukrainian", kk: "Kazakh", de: "German", fr: "French", es: "Spanish", it: "Italian" } as Record<string, string>)[language] ?? language;

    const buildUserPrompt = (extra?: string) => [
        `VISUAL TYPE: ${visualType}`,
        `LANGUAGE OF ALL TEXT IN DIAGRAM: ${langName}`,
        ``,
        `CONTENT TO VISUALIZE:`,
        prompt,
        ``,
        `LAYOUT BLUEPRINT FOR THIS TYPE:`,
        blueprint,
        extra ? `\nPREVIOUS ATTEMPT ERROR — fix all issues:\n${extra}` : "",
    ].filter(s => s !== undefined).join("\n");

    let lastCode = "";
    let lastLog = "";
    let totalTokens = 0;

    for (let attempt = 0; attempt < 3; attempt++) {
        // Build message list (feed error back on retry)
        const messages: any[] = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(attempt > 0 ? lastLog : undefined) },
        ];
        if (attempt > 0 && lastCode) {
            messages.splice(2, 0, { role: "assistant", content: lastCode });
            messages.push({ role: "user", content: `That TikZ produced this LaTeX error:\n\n${lastLog}\n\nFix all issues. Output ONLY the corrected TikZ snippet.` });
        }

        console.log(`[TikZ][attempt ${attempt + 1}] Calling LLM for type=${visualType}`);
        const llmResult = await callOpenAI({ model: MODEL, messages });

        if (!llmResult.ok) {
            lastLog = llmResult.error;
            console.error(`[TikZ] LLM failed: ${lastLog}`);
            continue;
        }

        totalTokens += llmResult.tokens;
        const tikzCode = stripFences(llmResult.text);
        if (!tikzCode) {
            lastLog = "LLM returned empty response.";
            continue;
        }
        lastCode = tikzCode;

        console.log(`[TikZ][attempt ${attempt + 1}] Compiling (${tikzCode.split("\n").length} lines)`);
        const compileResult = await compileTikz(tikzCode, language);

        if (compileResult.ok) {
            if (totalTokens > 0) await checkAndDeductUsage(userId, "visuals", totalTokens);
            console.log(`[TikZ] Success on attempt ${attempt + 1}`);
            return NextResponse.json({ tikzCode, pdfBase64: compileResult.pdfBase64, type: visualType });
        }

        lastLog = compileResult.log;
        console.warn(`[TikZ][attempt ${attempt + 1}] Compile failed: ${lastLog.slice(0, 200)}`);
    }

    // All attempts failed — return code with error for display
    return NextResponse.json(
        { error: "TikZ compilation failed after 3 attempts.", log: lastLog, tikzCode: lastCode },
        { status: 422 },
    );
}
