// Stage 2.3 - Visual Generation.
// LLM generates TikZ code → compiled via LaTeX compiler to VALIDATE syntax.
// Only tikzCode (not PNG) is stored; stage4 injects it inline into main.tex.
// Compilation is a validation/retry step only — PDF is discarded after check.

import JSZip from "jszip";
import { chatCompletion, type ChatMessage } from "./llm";
import type { PlannedVisual, GeneratedVisual } from "./types";

const CONCURRENCY = 2;

const LATEX_COMPILER_URL = process.env.LATEX_COMPILER_URL!;
const LATEX_COMPILER_KEY = process.env.LATEX_COMPILER_KEY!;

// ── Per-type TikZ layout blueprints ──────────────────────────────────────────
// Each blueprint gives exact TikZ style patterns, spacing, and color conventions.
// The LLM must FILL THEM WITH REAL CONTENT from the description — no placeholders.

const TYPE_BLUEPRINT: Record<string, string> = {
    mind_map: `
LIBRARY: \\usetikzlibrary{mindmap,backgrounds}
STRUCTURE:
\\begin{tikzpicture}[
  mindmap, grow cyclic,
  every node/.style={concept, align=center},
  concept color=teal!50!blue,
  level 1/.style={level distance=3.6cm, sibling angle=72, concept color=blue!50, font=\\small, text width=2.3cm},
  level 2/.style={level distance=2.3cm, sibling angle=45, concept color=blue!25, font=\\scriptsize, text width=1.8cm},
]
  \\node [root concept, text width=3cm] {<<CENTRAL TOPIC>>}
    child { node {<<BRANCH 1>>}
      child { node {<<sub 1a>>} }
      child { node {<<sub 1b>>} }
    }
    child { node {<<BRANCH 2>>}
      child { node {<<sub 2a>>} }
    }
    child { node {<<BRANCH 3>>} }
    child { node {<<BRANCH 4>>} }
    child { node {<<BRANCH 5>>} };
\\end{tikzpicture}
CRITICAL RULES:
- EXACTLY 4-5 level-1 branches. NEVER 6+ (causes overlap and text inversion at bottom).
- NEVER use \\clip — it cuts the circular concept blobs and makes them unreadable.
- NEVER add edge labels inside child declarations (e.g. edge from parent node{...}). Mindmap edges do not support inline text labels — they cause rotated ghost text.
- Add text width and align=center to every \\node to prevent text overflow.
- All node text MUST come from the description — no "Branch 1" or "Sub-topic A".`,

    concept_map: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,fit}
STYLE:
  box/.style = {draw, rounded corners=5pt, fill=blue!12, text width=2.6cm,
                align=center, font=\\small, inner sep=6pt, line width=0.7pt}
  arr/.style = {-{Stealth[length=6pt]}, thick, draw=gray!70}
  lbl/.style = {font=\\scriptsize\\itshape, fill=white, inner sep=2pt}
STRUCTURE: Use at (x,y) absolute coordinates. Spread nodes across the canvas.
  \\node[box] (A) at (0,0)    {<<concept>>};
  \\node[box] (B) at (4.5,1)  {<<concept>>};
  \\node[box] (C) at (4.5,-1) {<<concept>>};
  \\node[box] (D) at (9,0)    {<<concept>>};
  \\node[box] (E) at (2,-3)   {<<concept>>};
  \\draw[arr] (A) -- node[lbl,above] {<<verb phrase>>} (B);
  \\draw[arr, bend left=20] (B) to node[lbl,right] {<<verb phrase>>} (D);
CRITICAL RULES:
- Use at (x,y) coordinates so nodes don't pile on top of each other.
- Keep ALL nodes within x in [0,13], y in [-4,4]. If more than 8 nodes, reduce spacing.
- Every node MUST have a unique ID. NEVER create two nodes with the same content.
- Every edge MUST carry a specific relationship label — no generic "relates to" or "influences".
- 7-9 nodes, 8-13 edges. Domain vocabulary only.`,

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

    timeline: `
LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,decorations.pathmorphing}
STRUCTURE:
  % Horizontal axis line
  \\draw[line width=1.5pt, -{Stealth[length=8pt]}, gray!60] (0,0) -- (13,0);
  % Events: alternate above (y=1.6) and below (y=-1.6) the axis
  \\foreach tick at x-position, draw vertical connector and date label on axis
  event/.style = {draw, rounded corners=4pt, fill=blue!12, font=\\small,
                  align=center, text width=2.4cm, inner sep=5pt}
  date/.style  = {font=\\scriptsize\\bfseries, text=teal!60!blue}
  tick/.style  = {draw=gray!50, line width=0.8pt}
  % Above event:
  \\node[event] (E1) at (1.5, 1.8) {<<event title>>\\\\ {\\tiny <<detail>>}};
  \\draw[tick] (1.5,0.15) -- (1.5,1.2);
  \\node[date] at (1.5,-0.35) {<<year/date>>};
  % Below event (alternating):
  \\node[event] (E2) at (3.5,-1.8) {<<event title>>\\\\ {\\tiny <<detail>>}};
  \\draw[tick] (3.5,-0.15) -- (3.5,-1.2);
  \\node[date] at (3.5,0.35) {<<year/date>>};
RULES: 4-7 events alternating above/below. All event titles and dates from description.
Use \\colorbox{teal!30}{} for a highlighted "current" or "key" event.
Fit within 13cm × 5cm total height.`,

    flowchart: `
LIBRARIES: \\usetikzlibrary{shapes.geometric,arrows.meta,positioning,backgrounds}
STYLE (define with \\tikzset):
  start/.style    = {draw, rounded rectangle, fill=teal!40, text=white, font=\\small\\bfseries,
                     align=center, text width=2.6cm, inner sep=7pt, rounded rectangle arc length=90}
  process/.style  = {draw, rectangle, fill=blue!12, font=\\small, align=center,
                     text width=2.8cm, minimum height=1.0cm, inner sep=6pt}
  decision/.style = {draw, diamond, fill=orange!22, font=\\small, align=center,
                     aspect=2.2, inner sep=3pt, text width=2.2cm}
  io/.style       = {draw, trapezium, fill=gray!12, font=\\small, align=center,
                     trapezium left angle=75, trapezium right angle=105,
                     text width=2.4cm, inner sep=5pt}
  arr/.style      = {-{Stealth[length=6pt]}, line width=1.0pt, draw=gray!60}
  lbl/.style      = {font=\\scriptsize, fill=white, inner sep=1pt}
LAYOUT: Top-to-bottom primary flow. Decisions branch left (No) and right (Yes) or continue down.
  \\node[start] (S) {<<Start / Trigger>>};
  \\node[process, below=0.8cm of S] (P1) {<<Process step>>};
  \\node[decision, below=0.8cm of P1] (D1) {<<Decision condition?>>};
  \\node[process, below=0.8cm of D1] (P2) {<<Yes branch>>};
  \\node[process, right=1.5cm of D1] (P3) {<<No branch>>};
  \\draw[arr] (S) -- (P1); \\draw[arr] (P1) -- (D1);
  \\draw[arr] (D1) -- node[lbl,left]{Yes} (P2);
  \\draw[arr] (D1) -- node[lbl,above]{No} (P3);
RULES: 1 start, 1-2 end nodes, 2-4 decision diamonds, 4-8 process boxes.
Every label from the description — no "Step 1" or "Process A".`,

    network: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds,shapes.geometric}
STYLE:
  source/.style  = {circle, draw, fill=teal!40, text=white, font=\\small\\bfseries,
                    minimum size=1.0cm, align=center, inner sep=2pt}
  sink/.style    = {circle, draw, fill=blue!35, text=white, font=\\small\\bfseries,
                    minimum size=1.0cm, align=center, inner sep=2pt}
  middle/.style  = {circle, draw, fill=gray!20, font=\\small,
                    minimum size=0.85cm, align=center, inner sep=2pt}
  edir/.style    = {-{Stealth[length=5pt]}, draw=gray!55, line width=0.8pt}
  ebid/.style    = {<->, draw=gray!55, line width=0.8pt}
  elbl/.style    = {font=\\scriptsize, fill=white, inner sep=1pt}
LAYOUT: Sources cluster on left (x=0), intermediates in center (x=4..6), sinks on right (x=10).
  \\node[source] (S1) at (0, 2) {<<source>>};
  \\node[source] (S2) at (0,-2) {<<source>>};
  \\node[middle] (M1) at (4, 1) {<<node>>};
  \\node[middle] (M2) at (4,-1) {<<node>>};
  \\node[sink]   (T1) at (9, 2) {<<sink>>};
  \\draw[edir] (S1) -- node[elbl,above]{<<weight/label>>} (M1);
  \\draw[edir] (M1) -- node[elbl,above]{<<weight/label>>} (T1);
RULES: 2-4 sources, 3-6 intermediate nodes, 2-3 sinks, 8-14 directed edges.
Edge labels must be actual flow quantities, relationships, or capacities from description.`,

    venn: `
LIBRARIES: \\usetikzlibrary{positioning,backgrounds}
STRUCTURE:
  % Define circles with meaningful overlap — radius 2.5cm, overlap ~1cm
  \\begin{scope}
    \\fill[blue!20, opacity=0.6] (0,0) circle (2.5cm);
    \\fill[teal!25, opacity=0.6] (2.2,0) circle (2.5cm);
    % Optional third circle:
    \\fill[orange!20, opacity=0.6] (1.1,-1.9) circle (2.5cm);
  \\end{scope}
  \\draw[line width=1.0pt, blue!50]   (0,0) circle (2.5cm);
  \\draw[line width=1.0pt, teal!60]   (2.2,0) circle (2.5cm);
  \\draw[line width=1.0pt, orange!60] (1.1,-1.9) circle (2.5cm);
  % Labels inside each exclusive region
  \\node[align=center, font=\\small] at (-1.1, 0.5) {<<unique to A>>\\\\ <<item2>>};
  \\node[align=center, font=\\small] at (3.3, 0.5)  {<<unique to B>>\\\\ <<item2>>};
  % Intersection label
  \\node[align=center, font=\\small\\bfseries] at (1.1, 0.3) {<<shared A∩B>>};
  % Circle title labels outside
  \\node[font=\\bfseries\\small, blue!70] at (-1.8, 2.8) {<<Set A name>>};
  \\node[font=\\bfseries\\small, teal!70] at (4.0, 2.8)  {<<Set B name>>};
RULES: 2-3 circles. ALL region labels must contain real concepts from description.
Exclusive regions: 2-4 items each. Intersection: 2-3 shared items. No "Category A".`,

    cycle: `
LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,backgrounds}
STRUCTURE: N equally-spaced nodes arranged on a circle, connected by curved arrows.
  % Place nodes using polar coordinates: angle = 360/N * i
  % For N=5 (adjust angle step accordingly):
  \\node[step] (S1) at (90:3.2cm)  {<<Phase 1 name>>};
  \\node[step] (S2) at (18:3.2cm)  {<<Phase 2 name>>};
  \\node[step] (S3) at (-54:3.2cm) {<<Phase 3 name>>};
  \\node[step] (S4) at (-126:3.2cm){<<Phase 4 name>>};
  \\node[step] (S5) at (-198:3.2cm){<<Phase 5 name>>};
  \\draw[arr] (S1) to[bend left=20] (S2);
  \\draw[arr] (S2) to[bend left=20] (S3);
  % ... continue around the cycle
STYLE:
  step/.style = {draw, circle, fill=teal!30, text=white, font=\\small\\bfseries,
                 minimum size=1.6cm, align=center, inner sep=3pt}
  arr/.style  = {-{Stealth[length=7pt]}, line width=1.4pt, draw=teal!60!blue}
RULES: 4-6 phases. Add a short descriptor below each phase node using
  \\node[below=2pt of S1, font=\\scriptsize]{<<action verb + object>>};
All phase names from description — no "Phase 1". Fit within 8cm diameter.`,

    causal_loop: `
LIBRARIES: \\usetikzlibrary{arrows.meta,backgrounds}
STYLE (define with \\tikzset BEFORE \\begin{tikzpicture}):
  var/.style  = {draw, rounded corners=4pt, fill=blue!10, font=\\small\\bfseries,
                 align=center, text width=2.4cm, inner sep=5pt, minimum height=0.8cm}
  pos/.style  = {-{Stealth[length=6pt]}, line width=1.0pt, draw=teal!60}
  neg/.style  = {-{Stealth[length=6pt]}, line width=1.0pt, draw=orange!70}
  plbl/.style = {font=\\bfseries\\small, fill=white, inner sep=1pt, circle, minimum size=12pt}
  loop/.style = {circle, draw=gray!40, fill=gray!8, font=\\bfseries\\small, inner sep=4pt, minimum size=18pt}
STRUCTURE: Place 5-6 variable nodes at explicit hexagonal coordinates, then draw arcs.
  EXACT COORDINATES TO USE (copy these, only change node content):
  \\node[var] (V1) at (0, 3.2)   {<<variable>>};   % top
  \\node[var] (V2) at (3.0, 1.6)  {<<variable>>};  % top-right
  \\node[var] (V3) at (3.0, -1.6) {<<variable>>};  % bottom-right
  \\node[var] (V4) at (0, -3.2)   {<<variable>>};  % bottom
  \\node[var] (V5) at (-3.0,-1.6) {<<variable>>};  % bottom-left
  \\node[var] (V6) at (-3.0, 1.6) {<<variable>>};  % top-left (omit if only 5 vars)
  % Causal arcs — use bend left=25 for clockwise, bend right=25 for counter
  \\draw[pos] (V1) to[bend left=20] node[plbl]{+} (V2);
  \\draw[neg] (V2) to[bend left=20] node[plbl]{−} (V3);
  % Loop identity label — place at geometric center of each feedback loop
  \\node[loop] at (1.5,0) {R};
  \\node[loop] at (-1.5,0) {B};
RULES:
- USE EXACTLY THE COORDINATES ABOVE. Do not invent other coordinates — they cause overlap.
- 5-6 variables only. Maximum 8 arcs total.
- Polarity node: \\node[plbl]{+} or \\node[plbl]{−} on EVERY arc, no text labels.
- R = reinforcing loop, B = balancing loop, placed at loop geometric center.
- All variable names are domain concepts from the description — no "Variable A".`,

    matrix_2x2: `
LIBRARIES: \\usetikzlibrary{positioning,backgrounds}
STRUCTURE: 2×2 grid with axis labels and quadrant names + content items.
  % Draw axes
  \\draw[axis] (-0.3,0) -- (8.0,0) node[right,font=\\small]{<<X-axis label>>};
  \\draw[axis] (0,-0.3) -- (0,6.5) node[above,font=\\small]{<<Y-axis label>>};
  % Axis poles
  \\node[axlbl] at (1.5,-0.5) {Low}; \\node[axlbl] at (6.5,-0.5) {High};
  \\node[axlbl,rotate=90] at (-0.6,1.5) {Low}; \\node[axlbl,rotate=90] at (-0.6,5) {High};
  % Draw quadrant divider
  \\draw[dashed, gray!40] (4,0) -- (4,6.5); \\draw[dashed, gray!40] (0,3) -- (8,3);
  % Quadrant background fills
  \\fill[teal!8]   (0,3) rectangle (4,6.5);
  \\fill[blue!8]   (4,3) rectangle (8,6.5);
  \\fill[orange!8] (0,0) rectangle (4,3);
  \\fill[gray!8]   (4,0) rectangle (8,3);
  % Quadrant labels
  \\node[qlbl] at (2,6.0)  {<<Quadrant name>>};
  \\node[qlbl] at (6,6.0)  {<<Quadrant name>>};
  \\node[qlbl] at (2,0.4)  {<<Quadrant name>>};
  \\node[qlbl] at (6,0.4)  {<<Quadrant name>>};
  % Content: place items as small labeled dots or boxes
  \\node[item] at (1.5,5.0) {<<item A>>}; \\node[item] at (5.5,4.5) {<<item B>>};
STYLE:
  axis/.style = {-{Stealth[length=7pt]}, line width=1.2pt, draw=gray!60}
  qlbl/.style = {font=\\small\\bfseries, align=center, text width=3.2cm}
  axlbl/.style= {font=\\scriptsize, gray}
  item/.style = {draw, circle, fill=white, draw=gray!50, font=\\scriptsize, inner sep=3pt}
RULES: Both axes labeled with real domain variables. 2-4 items per quadrant.
All quadrant names and axis labels from the description — no "High/Low X".`,

    stakeholder_map: `
LIBRARIES: \\usetikzlibrary{positioning,backgrounds}
STRUCTURE: Concentric ellipses. Center = focal organization. Rings = influence distance.
  % Draw 3 concentric ellipses (increasing radii)
  \\fill[teal!35] (0,0) ellipse (1.2cm and 0.7cm);
  \\draw[ring] (0,0) ellipse (2.8cm and 1.7cm);
  \\draw[ring] (0,0) ellipse (4.6cm and 2.8cm);
  \\draw[ring] (0,0) ellipse (6.2cm and 3.8cm);
  % Center label
  \\node[font=\\small\\bfseries, text=white] at (0,0) {<<Focal\\\\Organization>>};
  % Ring labels (place radially around each ellipse)
  \\node[stk, teal!20] at (0,1.9)   {<<close stakeholder 1>>};
  \\node[stk, teal!20] at (2.2,0.8) {<<close stakeholder 2>>};
  \\node[stk]          at (4.0,2.0) {<<mid-range stakeholder>>};
  \\node[stk, gray!20] at (-5.0,1.2){<<distant stakeholder>>};
  % Ring annotations (right side)
  \\node[font=\\scriptsize\\itshape, gray] at (7.2,1.7)  {<<ring label e.g. Partners>>};
  \\node[font=\\scriptsize\\itshape, gray] at (7.2,2.9)  {<<ring label e.g. External>>};
STYLE:
  ring/.style = {draw=gray!40, line width=0.8pt, dashed}
  stk/.style  = {draw, rounded corners=3pt, fill=white, font=\\scriptsize,
                 align=center, text width=2.0cm, inner sep=3pt}
RULES: 3 rings + center. 2-3 stakeholders per ring. Stakeholder names from description.
Ring labels indicate relationship type (Partners, Regulators, Society, etc.).`,

    fishbone: `
LIBRARIES: \\usetikzlibrary{arrows.meta,positioning}
STRUCTURE: Horizontal spine arrow pointing right to the Effect box.
  Six diagonal branches (3 above, 3 below) with sub-cause twigs.
  % Spine
  \\draw[spine] (0,0) -- (10,0) node[effect] {<<Effect / Problem>>};
  % Main branches (upper, angling right-downward to spine)
  \\draw[branch] (2.5,0) -- (1.0, 2.0) node[cat] {<<Cause Category 1>>};
  \\draw[branch] (5.0,0) -- (3.5, 2.0) node[cat] {<<Cause Category 2>>};
  \\draw[branch] (7.5,0) -- (6.0, 2.0) node[cat] {<<Cause Category 3>>};
  % Mirror below
  \\draw[branch] (2.5,0) -- (1.0,-2.0) node[cat] {<<Cause Category 4>>};
  \\draw[branch] (5.0,0) -- (3.5,-2.0) node[cat] {<<Cause Category 5>>};
  \\draw[branch] (7.5,0) -- (6.0,-2.0) node[cat] {<<Cause Category 6>>};
  % Sub-causes as short twigs on branches
  \\node[cause] at (1.0, 1.3) {<<sub-cause>>};
  \\node[cause] at (0.4, 1.7) {<<sub-cause>>};
STYLE:
  spine/.style  = {line width=2pt, draw=gray!60, -{Stealth[length=9pt]}}
  branch/.style = {line width=1.2pt, draw=gray!50}
  effect/.style = {draw, rectangle, fill=teal!40, text=white, font=\\small\\bfseries,
                   align=center, text width=2.0cm, inner sep=6pt, xshift=1.2cm}
  cat/.style    = {font=\\small\\bfseries, align=center, text width=2.0cm, fill=white}
  cause/.style  = {font=\\scriptsize, fill=white, inner sep=1pt}
RULES: 4-6 main cause categories (e.g. People, Process, Technology, Environment).
2-3 sub-causes per branch. All from description — no "Category A".`,

    state_machine: `
LIBRARIES: \\usetikzlibrary{automata,arrows.meta,positioning,backgrounds}
STRUCTURE: States as circles (use TikZ automata library), transitions as curved arrows.
\\begin{tikzpicture}[
  node distance=3.5cm,
  every state/.style={draw, circle, fill=blue!12, font=\\small, minimum size=1.4cm,
                       align=center, inner sep=3pt},
  initial state/.style={draw, circle, fill=teal!35, text=white, font=\\small\\bfseries},
  accepting/.style={draw, double, double distance=2pt},
  ->, >=Stealth, line width=0.8pt
]
  \\node[initial state] (S0) {<<Start\\\\State>>};
  \\node[every state, right=of S0] (S1) {<<State A>>};
  \\node[every state, right=of S1] (S2) {<<State B>>};
  \\node[accepting, below=of S1]   (SF) {<<End\\\\State>>};
  \\path (S0) edge node[above,font=\\scriptsize]{<<trigger>>} (S1)
        (S1) edge node[above,font=\\scriptsize]{<<trigger>>} (S2)
        (S1) edge[bend right] node[right,font=\\scriptsize]{<<trigger>>} (SF)
        (S2) edge[loop above] node[font=\\scriptsize]{<<self-loop trigger>>} (S2);
\\end{tikzpicture}
RULES: 4-7 states, 5-10 transitions. One initial (filled teal) and 1-2 accepting (double circle).
All state names and trigger labels from description — no "State 1".`,

    sequence_diagram: `
LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,backgrounds}
STRUCTURE: Vertical lifelines as dashed lines; horizontal arrows for messages.
  % Lifeline headers
  \\node[actor] (A) at (0,0)   {<<Actor/System A>>};
  \\node[actor] (B) at (4,0)   {<<Actor/System B>>};
  \\node[actor] (C) at (8,0)   {<<Actor/System C>>};
  % Lifelines (dashed vertical)
  \\draw[lifeline] (A.south) -- (0,-8);
  \\draw[lifeline] (B.south) -- (4,-8);
  \\draw[lifeline] (C.south) -- (8,-8);
  % Messages (horizontal arrows between lifelines at successive y-levels)
  \\draw[msg] (0,-1.0) -- node[above,font=\\scriptsize]{<<message 1>>} (4,-1.0);
  \\draw[msg] (4,-2.0) -- node[above,font=\\scriptsize]{<<message 2>>} (8,-2.0);
  \\draw[ret] (8,-3.0) -- node[above,font=\\scriptsize]{<<return/response>>} (4,-3.0);
  % Activation boxes (thin rectangles on lifeline)
  \\fill[teal!25] (-0.15,-0.9) rectangle (0.15,-2.5);
STYLE:
  actor/.style   = {draw, rectangle, fill=teal!30, text=white, font=\\small\\bfseries,
                    align=center, text width=2.4cm, inner sep=5pt}
  lifeline/.style= {dashed, gray!50, line width=0.7pt}
  msg/.style     = {-{Stealth[length=5pt]}, line width=0.9pt, draw=gray!60}
  ret/.style     = {-{Stealth[length=5pt]}, line width=0.9pt, draw=gray!40, dashed}
RULES: 2-4 lifelines, 5-9 messages. Synchronous calls = solid arrow, returns = dashed.
All actor names and message labels from description.`,

    er_diagram: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,shapes.geometric}
STRUCTURE: Entities = rectangles, Relationships = diamonds, Attributes = ellipses.
  ent/.style  = {draw, rectangle, fill=teal!20, font=\\small\\bfseries,
                 align=center, minimum width=2.4cm, minimum height=0.9cm, inner sep=5pt}
  rel/.style  = {draw, diamond, fill=orange!18, font=\\scriptsize, aspect=2,
                 align=center, inner sep=2pt}
  attr/.style = {draw, ellipse, fill=blue!8, font=\\scriptsize,
                 align=center, inner sep=4pt}
  edge/.style = {draw=gray!55, line width=0.8pt}
  card/.style = {font=\\scriptsize\\bfseries, fill=white, inner sep=1pt}
  % Entities
  \\node[ent] (E1) at (0,0)    {<<Entity A>>};
  \\node[ent] (E2) at (6,0)    {<<Entity B>>};
  \\node[ent] (E3) at (3,-3.5) {<<Entity C>>};
  % Relationship diamonds
  \\node[rel] (R1) at (3,0)    {<<has>>};
  \\node[rel] (R2) at (1.5,-2) {<<belongs to>>};
  % Cardinality labels on edges
  \\draw[edge] (E1) -- node[card,above]{1} (R1);
  \\draw[edge] (R1) -- node[card,above]{N} (E2);
  % Attributes hanging off entities
  \\node[attr, above=0.7cm of E1] (A1) {<<primary key>>};
  \\draw[edge] (E1) -- (A1);
RULES: 3-5 entities, 2-4 relationship diamonds, 2-3 attributes per entity (at least PK).
Cardinality labels (1, N, M) on all edges. All names from description.`,

    onion_model: `
LIBRARIES: \\usetikzlibrary{positioning,backgrounds}
STRUCTURE: Concentric filled circles/ellipses, outermost = broadest context.
  % Draw from outside inward so inner layers render on top
  \\fill[gray!15]  (0,0) ellipse (6.0cm and 3.6cm);
  \\fill[blue!12]  (0,0) ellipse (4.5cm and 2.7cm);
  \\fill[teal!18]  (0,0) ellipse (3.0cm and 1.8cm);
  \\fill[teal!35]  (0,0) ellipse (1.5cm and 0.9cm);
  % Layer boundary lines
  \\draw[lring] (0,0) ellipse (6.0cm and 3.6cm);
  \\draw[lring] (0,0) ellipse (4.5cm and 2.7cm);
  \\draw[lring] (0,0) ellipse (3.0cm and 1.8cm);
  \\draw[lring] (0,0) ellipse (1.5cm and 0.9cm);
  % Layer labels (place at right edge of each ring)
  \\node[llbl] at (5.2, 0)  {<<Outermost context>>};
  \\node[llbl] at (3.8, 0)  {<<Second layer>>};
  \\node[llbl] at (2.3, 0)  {<<Third layer>>};
  \\node[font=\\small\\bfseries, text=white] at (0,0) {<<Core>>};
  % Items inside each ring (place at top/bottom of ring)
  \\node[font=\\scriptsize, align=center] at (0, 3.1) {<<outer item 1>> · <<outer item 2>>};
STYLE:
  lring/.style = {draw=white, line width=1.2pt}
  llbl/.style  = {font=\\scriptsize\\bfseries, fill=white, rounded corners=2pt, inner sep=2pt}
RULES: 4 layers including core. Each layer labeled with context level from description.
Place 2-3 concrete items inside each ring. All text from description.`,

    pipeline_flow: `
LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,backgrounds,fit,shapes.geometric}
STRUCTURE: Left-to-right processing stages. Data annotations on flow arrows.
  Optional feedback arc curved below the main pipeline.
  % Main pipeline nodes
  \\node[input]   (I)  {<<Input\\\\Source>>};
  \\node[stage, right=1.4cm of I]  (S1) {<<Stage 1>>};
  \\node[stage, right=1.4cm of S1] (S2) {<<Stage 2>>};
  \\node[stage, right=1.4cm of S2] (S3) {<<Stage 3>>};
  \\node[output,  right=1.4cm of S3] (O) {<<Output>>};
  % Flow arrows with data labels
  \\draw[arr] (I)  -- node[dlbl,above]{<<data type>>} (S1);
  \\draw[arr] (S1) -- node[dlbl,above]{<<transformed>>} (S2);
  \\draw[arr] (S2) -- node[dlbl,above]{<<processed>>} (S3);
  \\draw[arr] (S3) -- node[dlbl,above]{<<result>>} (O);
  % Feedback arc (curved below)
  \\draw[feedback] (O) to[bend right=40] node[dlbl,below]{<<feedback signal>>} (S2);
  % Optional side branch (e.g. error/exception path)
  \\draw[exception] (S2) -- ++(0,-1.5) node[excnode]{<<exception handler>>};
STYLE:
  input/.style  = {draw, trapezium, fill=orange!20, trapezium left angle=70,
                   trapezium right angle=110, font=\\small, align=center, inner sep=5pt}
  stage/.style  = {draw, rectangle, rounded corners=5pt, fill=teal!20, font=\\small,
                   align=center, text width=2.0cm, minimum height=1.0cm, inner sep=5pt}
  output/.style = {draw, trapezium, fill=blue!20, trapezium left angle=110,
                   trapezium right angle=70, font=\\small, align=center, inner sep=5pt}
  arr/.style      = {-{Stealth[length=6pt]}, line width=1.1pt, draw=gray!60}
  feedback/.style = {-{Stealth[length=6pt]}, dashed, draw=orange!60, line width=0.9pt}
  exception/.style= {-{Stealth[length=5pt]}, draw=red!40, line width=0.8pt}
  excnode/.style  = {draw, fill=red!10, font=\\scriptsize, rounded corners=3pt, inner sep=3pt}
  dlbl/.style     = {font=\\scriptsize, fill=white, inner sep=1pt}
RULES: 3-6 stages, at least one feedback arc. Stage names from description methodology.`,

    force_field: `
LIBRARIES: \\usetikzlibrary{arrows.meta,positioning,backgrounds}
STRUCTURE: Central vertical equilibrium line. Driving forces arrow LEFT→RIGHT (from left).
  Restraining forces arrow RIGHT→LEFT (from right). Arrow length = relative strength.
  % Central line
  \\draw[cline] (5,-0.5) -- (5,8.5) node[above, font=\\small\\bfseries]{Equilibrium};
  % Title / change goal at top
  \\node[goal] at (5,9.2) {<<Change Goal / Status to achieve>>};
  % Driving forces (LEFT side, arrows pointing right, varying lengths)
  \\draw[drive] (1.0,7.0) -- (4.8,7.0) node[dlbl,left,xshift=-0.8cm]{<<Driving Force 1>>};
  \\draw[drive] (2.0,5.5) -- (4.8,5.5) node[dlbl,left,xshift=-1.8cm]{<<Driving Force 2>>};
  \\draw[drive] (1.5,4.0) -- (4.8,4.0) node[dlbl,left,xshift=-1.3cm]{<<Driving Force 3>>};
  \\draw[drive] (2.5,2.5) -- (4.8,2.5) node[dlbl,left,xshift=-2.3cm]{<<Driving Force 4>>};
  % Restraining forces (RIGHT side, arrows pointing left)
  \\draw[resist] (9.0,6.5) -- (5.2,6.5) node[rlbl,right,xshift=0.7cm]{<<Restraining Force 1>>};
  \\draw[resist] (8.0,5.0) -- (5.2,5.0) node[rlbl,right,xshift=-0.7cm]{<<Restraining Force 2>>};
  \\draw[resist] (8.5,3.5) -- (5.2,3.5) node[rlbl,right,xshift=0.4cm]{<<Restraining Force 3>>};
  % Section headers
  \\node[hdr, teal!70] at (2.5,8.5) {DRIVING FORCES};
  \\node[hdr, orange!70] at (7.5,8.5){RESTRAINING FORCES};
STYLE:
  cline/.style  = {line width=1.5pt, draw=gray!60, dashed}
  drive/.style  = {-{Stealth[length=7pt]}, line width=2.5pt, draw=teal!60}
  resist/.style = {-{Stealth[length=7pt]}, line width=2.5pt, draw=orange!60}
  dlbl/.style   = {font=\\scriptsize, fill=white, align=right, text width=2.5cm, inner sep=1pt}
  rlbl/.style   = {font=\\scriptsize, fill=white, align=left,  text width=2.5cm, inner sep=1pt}
  goal/.style   = {draw, fill=teal!20, font=\\small\\bfseries, rounded corners=4pt, inner sep=6pt}
  hdr/.style    = {font=\\small\\bfseries}
RULES: 3-5 driving, 3-5 restraining forces. Arrow lengths reflect relative strength (longer = stronger).
All force names from description — no "Driving Force 1".`,

    gantt: `
LIBRARIES: \\usetikzlibrary{positioning,backgrounds}
STRUCTURE: Tasks listed on Y-axis (top to bottom). Time periods on X-axis.
  Colored bars span from start to end period. Milestones as diamonds.
  % Time axis (assume N time units, e.g. months/weeks)
  \\foreach \\i/\\lbl in {1/<<T1>>,2/<<T2>>,3/<<T3>>,4/<<T4>>,5/<<T5>>,6/<<T6>>}
    \\node[tlbl] at (\\i*1.6+0.8, 0.3) {\\lbl};
  % Grid lines
  \\foreach \\i in {1,...,7} \\draw[grid] (\\i*1.6, 0) -- (\\i*1.6, -6.5);
  % Task rows (use \\fill[bar] (start,ytop) rectangle (end,ybot))
  \\node[task] at (0.8, -0.9) {<<Task 1 name>>};
  \\fill[bar1] (1*1.6, -0.6) rectangle (3*1.6, -1.2);
  \\node[task] at (0.8, -1.7) {<<Task 2 name>>};
  \\fill[bar2] (2*1.6, -1.4) rectangle (5*1.6, -2.0);
  \\node[task] at (0.8, -2.5) {<<Task 3 name>>};
  \\fill[bar1] (3*1.6, -2.2) rectangle (6*1.6, -2.8);
  % Milestone diamond
  \\node[milestone] at (4*1.6, -3.6) {};
  \\node[task] at (0.8, -3.6) {<<Milestone>>};
  % Dependency arrow between bars
  \\draw[dep] (3*1.6, -0.9) -- (3*1.6, -1.7);
STYLE:
  tlbl/.style     = {font=\\scriptsize\\bfseries, teal!60!blue}
  grid/.style     = {draw=gray!25, line width=0.5pt}
  task/.style     = {font=\\scriptsize, align=right, text width=2.4cm, anchor=east}
  bar1/.style     = {fill=teal!40, rounded corners=1pt}
  bar2/.style     = {fill=blue!25, rounded corners=1pt}
  milestone/.style= {diamond, draw, fill=orange!50, minimum size=0.4cm}
  dep/.style      = {-{Stealth[length=4pt]}, gray!50, line width=0.7pt}
RULES: 4-8 tasks, 1-2 milestones, 5-8 time columns. Tasks from description methodology.
Use two bar colors to distinguish parallel work streams. Fit within 13cm × 7cm.`,

    value_chain: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,fit,backgrounds,shapes.geometric}
STRUCTURE: Porter's value chain — horizontal primary activities + vertical support activities.
  % Support activities (top, stacked horizontal bars)
  \\node[support, minimum width=11cm] (SA1) at (5.5, 5.5) {<<Support Activity: Firm Infrastructure>>};
  \\node[support, minimum width=11cm] (SA2) at (5.5, 4.6) {<<Support Activity: HR Management>>};
  \\node[support, minimum width=11cm] (SA3) at (5.5, 3.7) {<<Support Activity: Technology>>};
  \\node[support, minimum width=11cm] (SA4) at (5.5, 2.8) {<<Support Activity: Procurement>>};
  % Primary activities (bottom, left-to-right arrows)
  \\node[primary] (P1) at (1.0, 1.1) {<<Inbound\\\\Logistics>>};
  \\node[primary] (P2) at (3.0, 1.1) {<<Operations>>};
  \\node[primary] (P3) at (5.0, 1.1) {<<Outbound\\\\Logistics>>};
  \\node[primary] (P4) at (7.0, 1.1) {<<Marketing\\\\\\& Sales>>};
  \\node[primary] (P5) at (9.0, 1.1) {<<Service>>};
  % Margin wedge on right
  \\node[margin] at (11.0, 3.0) {Margin};
  \\draw[arr] (P1)--(P2); \\draw[arr] (P2)--(P3); \\draw[arr] (P3)--(P4); \\draw[arr] (P4)--(P5);
  % Vertical divider between support and primary
  \\draw[dashed, gray!40] (0, 2.2) -- (10.8, 2.2);
STYLE:
  primary/.style = {draw, fill=teal!25, font=\\scriptsize\\bfseries, align=center,
                    text width=1.7cm, minimum height=1.8cm, inner sep=4pt}
  support/.style = {draw, fill=blue!10, font=\\scriptsize, align=center, minimum height=0.7cm, inner sep=4pt}
  margin/.style  = {draw, fill=orange!30, font=\\scriptsize\\bfseries, align=center,
                    text width=1.0cm, minimum height=4.5cm, inner sep=4pt}
  arr/.style     = {-{Stealth[length=5pt]}, line width=0.9pt, draw=gray!50}
RULES: 5 primary activities, 4 support activities from Porter's model.
Fill with domain-specific activities from the description (e.g. for a tech firm: dev, testing, deployment).`,

    ecosystem_map: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds,fit}
STRUCTURE: Focal entity at center. Ecosystem actors placed around it in clusters by role.
  % Central focal entity
  \\node[focal] (F) at (0,0) {<<Focal\\\\Organization>>};
  % Inner ring actors (close partners, direct relationships)
  \\node[inner_actor] (I1) at (3.5, 2.0)  {<<Partner A>>};
  \\node[inner_actor] (I2) at (3.5,-2.0)  {<<Partner B>>};
  \\node[inner_actor] (I3) at (-3.5, 1.5) {<<Supplier>>};
  % Outer ring actors (indirect, external)
  \\node[outer_actor] (O1) at (6.0, 3.5)  {<<Regulator>>};
  \\node[outer_actor] (O2) at (6.0,-3.5)  {<<Competitor>>};
  \\node[outer_actor] (O3) at (-6.0, 0)   {<<Research\\\\Institute>>};
  % Interactions (labeled arrows)
  \\draw[iflow] (F)  -- node[ilbl,above]{<<value exchange>>} (I1);
  \\draw[iflow] (F)  -- node[ilbl,below]{<<service>>} (I2);
  \\draw[iflow] (I1) -- node[ilbl,above]{<<data>>} (O1);
  % Cluster groupings (fit nodes)
  \\begin{pgfonlayer}{background}
    \\node[cluster, fit=(I1)(O1), label=above right:{\\scriptsize <<Sector A>>}] {};
    \\node[cluster, fit=(I2)(O2), label=below right:{\\scriptsize <<Sector B>>}] {};
  \\end{pgfonlayer}
STYLE:
  focal/.style      = {circle, draw, fill=teal!50, text=white, font=\\small\\bfseries,
                       minimum size=1.8cm, align=center}
  inner_actor/.style= {draw, rounded corners=5pt, fill=blue!18, font=\\scriptsize,
                       align=center, text width=1.8cm, inner sep=4pt}
  outer_actor/.style= {draw, rounded corners=5pt, fill=gray!14, font=\\scriptsize,
                       align=center, text width=1.8cm, inner sep=4pt}
  cluster/.style    = {draw=gray!25, rounded corners=8pt, fill=gray!4, dashed, inner sep=6pt}
  iflow/.style      = {<->, draw=teal!50, line width=0.9pt}
  ilbl/.style       = {font=\\scriptsize, fill=white, inner sep=1pt}
RULES: 1 focal entity, 3-5 inner actors, 3-5 outer actors, 6-10 interaction arrows.
All names and interaction labels from description.`,

    bracket_tree: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta}
STRUCTURE: Root at top, children below via angled bracket lines.
  Leaf nodes contain the actual content. Internal nodes show category labels.
  % Root
  \\node[root] (R) at (5, 8) {<<Root category>>};
  % Level 1 branches
  \\node[inode] (L1) at (2, 6)  {<<Branch A>>};
  \\node[inode] (L2) at (5, 6)  {<<Branch B>>};
  \\node[inode] (L3) at (8, 6)  {<<Branch C>>};
  \\draw[edge] (R) -- (L1); \\draw[edge] (R) -- (L2); \\draw[edge] (R) -- (L3);
  % Level 2 leaves
  \\node[leaf] (A1) at (1, 4) {<<leaf>>}; \\node[leaf] (A2) at (3, 4) {<<leaf>>};
  \\node[leaf] (B1) at (5, 4) {<<leaf>>};
  \\node[leaf] (C1) at (7, 4) {<<leaf>>}; \\node[leaf] (C2) at (9, 4) {<<leaf>>};
  \\draw[edge] (L1)--(A1); \\draw[edge] (L1)--(A2);
  \\draw[edge] (L2)--(B1);
  \\draw[edge] (L3)--(C1); \\draw[edge] (L3)--(C2);
  % Optional level 3
  \\node[leaf] (A1a) at (0.5,2) {<<sub>>}; \\node[leaf] (A1b) at (1.5,2) {<<sub>>};
  \\draw[edge] (A1)--(A1a); \\draw[edge] (A1)--(A1b);
STYLE:
  root/.style  = {draw, rectangle, fill=teal!40, text=white, font=\\small\\bfseries,
                  align=center, text width=2.8cm, inner sep=6pt, rounded corners=4pt}
  inode/.style = {draw, rectangle, fill=blue!15, font=\\small, align=center,
                  text width=2.2cm, inner sep=5pt, rounded corners=4pt}
  leaf/.style  = {draw, rectangle, fill=gray!10, font=\\scriptsize, align=center,
                  text width=1.8cm, inner sep=4pt, rounded corners=3pt}
  edge/.style  = {draw=gray!50, line width=0.9pt}
RULES: 3-4 levels, 3 main branches, 2-3 leaves per branch. All labels from description taxonomy.`,

    wbs: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds}
STRUCTURE: Work Breakdown Structure tree. Top = project, middle = deliverables, bottom = work packages.
  WBS codes (1.0, 1.1, 1.2…) shown above each node.
  % Level 0 (project)
  \\node[project] (P) at (6, 8) {<<Project Name>>};
  % Level 1 (major deliverables)
  \\node[deliv] (D1) at (1.5, 5.8) {<<Deliverable 1>>}; \\node[wcode] at (1.5,6.9) {1.1};
  \\node[deliv] (D2) at (5.0, 5.8) {<<Deliverable 2>>}; \\node[wcode] at (5.0,6.9) {1.2};
  \\node[deliv] (D3) at (8.5, 5.8) {<<Deliverable 3>>}; \\node[wcode] at (8.5,6.9) {1.3};
  \\draw[edge] (P)--(D1); \\draw[edge] (P)--(D2); \\draw[edge] (P)--(D3);
  % Level 2 (work packages)
  \\node[wp] (W11) at (0.5,3.5) {<<Work Pkg 1.1.1>>}; \\node[wcode] at (0.5,4.4) {1.1.1};
  \\node[wp] (W12) at (2.5,3.5) {<<Work Pkg 1.1.2>>}; \\node[wcode] at (2.5,4.4) {1.1.2};
  \\node[wp] (W21) at (4.2,3.5) {<<Work Pkg>>};        \\node[wcode] at (4.2,4.4) {1.2.1};
  \\node[wp] (W22) at (5.8,3.5) {<<Work Pkg>>};        \\node[wcode] at (5.8,4.4) {1.2.2};
  \\node[wp] (W31) at (7.7,3.5) {<<Work Pkg>>};        \\node[wcode] at (7.7,4.4) {1.3.1};
  \\node[wp] (W32) at (9.3,3.5) {<<Work Pkg>>};        \\node[wcode] at (9.3,4.4) {1.3.2};
  \\draw[edge](D1)--(W11); \\draw[edge](D1)--(W12);
  \\draw[edge](D2)--(W21); \\draw[edge](D2)--(W22);
  \\draw[edge](D3)--(W31); \\draw[edge](D3)--(W32);
STYLE:
  project/.style = {draw, fill=teal!50, text=white, font=\\small\\bfseries,
                    rounded corners=5pt, align=center, text width=3.0cm, inner sep=7pt}
  deliv/.style   = {draw, fill=blue!20, font=\\small, rounded corners=4pt,
                    align=center, text width=2.2cm, inner sep=5pt}
  wp/.style      = {draw, fill=gray!12, font=\\scriptsize, rounded corners=3pt,
                    align=center, text width=1.9cm, inner sep=4pt}
  wcode/.style   = {font=\\tiny\\bfseries, teal!60}
  edge/.style    = {draw=gray!50, line width=0.8pt}
RULES: 1 project, 3-4 deliverables, 2-3 work packages each. Codes on every node.
All names from description methodology/objectives — no generic placeholders.`,

    swot: `
LIBRARIES: \\usetikzlibrary{positioning,backgrounds}
STRUCTURE: Classic 2×2 SWOT grid with quadrant headers and bullet items.
  % Grid lines
  \\draw[line width=1.5pt, gray!50] (0,5) -- (12,5); % horizontal
  \\draw[line width=1.5pt, gray!50] (6,0) -- (6,10); % vertical
  % Quadrant fills
  \\fill[teal!10]   (0,5) rectangle (6,10);  % Strengths (top-left)
  \\fill[blue!8]    (6,5) rectangle (12,10); % Weaknesses (top-right)
  \\fill[orange!8]  (0,0) rectangle (6,5);   % Opportunities (bottom-left)
  \\fill[gray!8]    (6,0) rectangle (12,5);  % Threats (bottom-right)
  % Quadrant headers
  \\node[qhdr, teal!70]   at (3,9.5)  {STRENGTHS};
  \\node[qhdr, blue!60]   at (9,9.5)  {WEAKNESSES};
  \\node[qhdr, orange!70] at (3,4.5)  {OPPORTUNITIES};
  \\node[qhdr, gray!60]   at (9,4.5)  {THREATS};
  % Axis labels (center)
  \\node[axlbl] at (6,10.3) {INTERNAL};
  \\node[axlbl, rotate=90] at (-0.5,7.5) {HELPFUL};
  \\node[axlbl, rotate=90] at (-0.5,2.5) {HARMFUL};
  \\node[axlbl] at (6,-0.4) {EXTERNAL};
  % Items in each quadrant (use itemize-style \\node with aligned text)
  \\node[items] at (3,7.5) {• <<Strength 1>>\\\\• <<Strength 2>>\\\\• <<Strength 3>>};
  \\node[items] at (9,7.5) {• <<Weakness 1>>\\\\• <<Weakness 2>>\\\\• <<Weakness 3>>};
  \\node[items] at (3,2.5) {• <<Opportunity 1>>\\\\• <<Opportunity 2>>\\\\• <<Opportunity 3>>};
  \\node[items] at (9,2.5) {• <<Threat 1>>\\\\• <<Threat 2>>\\\\• <<Threat 3>>};
STYLE:
  qhdr/.style  = {font=\\small\\bfseries}
  axlbl/.style = {font=\\scriptsize\\bfseries, gray!60}
  items/.style = {font=\\scriptsize, align=left, text width=4.5cm}
RULES: 3-5 items per quadrant. All items specific domain facts from description — no "Strength 1".`,

    systems_map: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,backgrounds,fit}
STRUCTURE: System boundary (rectangle) containing internal components.
  External entities (actors) outside the boundary. Input/output flows cross the boundary.
  % System boundary
  \\node[boundary, minimum width=9cm, minimum height=6cm] (SYS) at (5,3.5) {};
  \\node[font=\\small\\bfseries, teal!60] at (5,6.7) {<<System Name>>};
  % Internal components
  \\node[component] (C1) at (2.5, 4.5) {<<Component A>>};
  \\node[component] (C2) at (5.0, 4.5) {<<Component B>>};
  \\node[component] (C3) at (7.5, 4.5) {<<Component C>>};
  \\node[component] (C4) at (5.0, 2.5) {<<Component D>>};
  % Internal flows
  \\draw[intflow] (C1) -- node[ilbl,above]{<<data>>} (C2);
  \\draw[intflow] (C2) -- node[ilbl,above]{<<signal>>} (C3);
  \\draw[intflow] (C2) -- node[ilbl,right]{<<control>>} (C4);
  % External entities
  \\node[external] (E1) at (-1.5, 4.5) {<<External Actor A>>};
  \\node[external] (E2) at (11.5, 4.5) {<<External Actor B>>};
  \\node[external] (E3) at (5, -1.2)   {<<External Actor C>>};
  % Cross-boundary flows
  \\draw[extflow] (E1) -- node[ilbl,above]{<<input>>} (C1);
  \\draw[extflow] (C3) -- node[ilbl,above]{<<output>>} (E2);
  \\draw[extflow] (C4) -- node[ilbl,right]{<<feedback>>} (E3);
STYLE:
  boundary/.style  = {draw=teal!50, line width=1.8pt, rounded corners=10pt, fill=teal!3}
  component/.style = {draw, rounded corners=5pt, fill=blue!15, font=\\small,
                      align=center, text width=2.0cm, minimum height=0.9cm, inner sep=5pt}
  external/.style  = {draw, rectangle, fill=gray!15, font=\\small, align=center,
                      text width=2.0cm, inner sep=5pt}
  intflow/.style   = {-{Stealth[length=5pt]}, draw=teal!60, line width=0.9pt}
  extflow/.style   = {<->, draw=orange!60, line width=1.0pt}
  ilbl/.style      = {font=\\scriptsize, fill=white, inner sep=1pt}
RULES: 3-5 internal components, 3 external actors, all cross-boundary flows labeled.
System name and all component/actor names from description.`,

    architecture: `
LIBRARIES: \\usetikzlibrary{positioning,arrows.meta,fit,backgrounds,shapes.geometric}
STYLE:
  layer/.style   = {draw=gray!40, rounded corners=8pt, fill=gray!6, inner sep=8pt,
                    line width=0.8pt, dashed}
  component/.style = {draw, rounded corners=5pt, fill=blue!18, font=\\small,
                      align=center, text width=2.5cm, minimum height=0.9cm, inner sep=6pt}
  highlight/.style = {draw, rounded corners=5pt, fill=teal!35, text=white,
                      font=\\small\\bfseries, align=center, text width=2.5cm,
                      minimum height=0.9cm, inner sep=6pt}
  connector/.style = {draw=gray!30, fill=gray!12, font=\\scriptsize, align=center,
                      minimum width=1.0cm, minimum height=0.7cm}
  arr/.style     = {-{Stealth[length=6pt]}, line width=1.0pt, draw=teal!60}
  data/.style    = {-{Stealth[length=6pt]}, line width=0.7pt, draw=gray!50, dashed}
LAYOUT: Left-to-right pipeline OR top-to-bottom layers. Use \\begin{pgfonlayer}{background}
  fit nodes to create visual layer containers with labels.
  % Example left-to-right:
  \\node[component] (I) {<<Input\\\\layer>>};
  \\node[component, right=1.5cm of I] (H1) {<<Hidden\\\\layer 1>>};
  \\node[highlight, right=1.5cm of H1] (H2) {<<Core\\\\module>>};
  \\node[component, right=1.5cm of H2] (O) {<<Output\\\\layer>>};
  \\draw[arr] (I)--(H1); \\draw[arr] (H1)--(H2); \\draw[arr] (H2)--(O);
  \\begin{pgfonlayer}{background}
    \\node[layer, fit=(H1)(H2), label=above:{\\scriptsize <<Layer group name>>}] {};
  \\end{pgfonlayer}
RULES: 3-6 layers or stages, 2-4 components per layer. Use fit-node containers to group layers.
All component names from description — no "Layer 1" or "Module A".`,
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

// ── Standalone wrapper for validation ────────────────────────────────────────

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

// ── Compile to validate TikZ syntax (PDF discarded after check) ───────────────

async function validateTikz(tikzSnippet: string, language: string): Promise<{ ok: true } | { ok: false; log: string }> {
    if (!LATEX_COMPILER_URL || !LATEX_COMPILER_KEY) return { ok: true }; // skip if not configured

    const zip = new JSZip();
    zip.file("main.tex", wrapInStandalone(tikzSnippet, language));
    const zipBlob = await zip.generateAsync({ type: "blob" });

    const form = new FormData();
    form.append("file", zipBlob, "project.zip");

    const res = await fetch(LATEX_COMPILER_URL, {
        method: "POST",
        headers: { "x-api-key": LATEX_COMPILER_KEY },
        body: form,
        signal: AbortSignal.timeout(120_000),
    });

    const ct = res.headers.get("content-type") ?? "";
    if (res.ok && !ct.includes("json") && !ct.includes("text")) {
        await res.arrayBuffer(); // drain — PDF discarded
        return { ok: true };
    }

    const text = await res.text();
    let log = text;
    try { const j = JSON.parse(text); log = j.error ?? j.log ?? text; } catch {}
    return { ok: false, log: String(log).slice(0, 400) };
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
            let lastError = "";
            let lastTikz = "";
            let succeeded = false;

            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const messages = buildMessages(visual, language);
                    if (attempt > 0 && lastError && lastTikz) {
                        messages.push({ role: "assistant", content: lastTikz });
                        messages.push({
                            role: "user",
                            content: `The TikZ above failed to compile:\n${lastError}\n\nFix it and return the corrected snippet only.`,
                        });
                    }

                    const r = await chatCompletion(messages, { timeoutMs: 120_000 });
                    totalTokens += r.totalTokens;

                    const tikzCode = stripFences(r.text);
                    lastTikz = tikzCode;

                    const validation = await validateTikz(tikzCode, language);
                    if (!validation.ok) {
                        lastError = validation.log;
                        console.warn(`[Stage2.3] attempt ${attempt + 1}/3 compile error for ${visual.id}: ${lastError.slice(0, 80)}`);
                        continue;
                    }

                    console.log(`[Stage2.3] ✓ ${visual.id}  type=${visual.type}  attempt=${attempt + 1}  tokens=${r.totalTokens}`);
                    results.push({
                        id: visual.id,
                        sectionHeading: visual.sectionHeading,
                        filename: `${visual.id}.png`,
                        caption: visual.caption,
                        label: visual.label,
                        tikzCode,
                        type: visual.type,
                    });
                    succeeded = true;
                    break;
                } catch (e: any) {
                    lastError = String(e?.message ?? e).slice(0, 300);
                    console.warn(`[Stage2.3] attempt ${attempt + 1}/3 failed for ${visual.id}: ${lastError.slice(0, 80)}`);
                }
            }

            if (!succeeded) {
                console.error(`[Stage2.3] ✗ ${visual.id} failed after 3 attempts`);
                results.push({
                    id: visual.id,
                    sectionHeading: visual.sectionHeading,
                    filename: `${visual.id}.png`,
                    caption: visual.caption,
                    label: visual.label,
                    tikzCode: lastTikz, // store last attempt even if invalid — stage5 repair may fix it
                    type: visual.type,
                    failed: true,
                    error: lastError.slice(0, 200),
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
