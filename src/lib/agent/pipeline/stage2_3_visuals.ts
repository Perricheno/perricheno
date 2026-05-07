// Stage 2.3 - Visual Generation.
// For each structural/conceptual visual planned in Stage 1, the LLM generates
// a self-contained SVG-based HTML file (mind maps, concept maps, hierarchies,
// frameworks, relationship diagrams, methodology schemas).
// Puppeteer renders it to PNG and the result is embedded in the LaTeX ZIP.
//
// Puppeteer is a peer dependency - if absent, visuals are marked failed and
// the pipeline continues without them.

import { chatCompletion, type ChatMessage } from "./llm";
import type { PlannedVisual, GeneratedVisual } from "./types";
import { withRetry } from "../stages";

const CONCURRENCY = 2;
const VIEWPORT_W = 900;
const VIEWPORT_H = 550;

// Per-type rendering instructions - all SVG-first, academic style.
const TYPE_GUIDE: Record<string, string> = {
    mind_map: `
LAYOUT: Radial/spider layout. One central oval in the middle of the canvas.
4-7 main branches radiating outward at evenly-spaced angles, each connected to the center by a curved or straight line.
Each branch has a rounded-rect node. Sub-branches (2-3 per main branch) extend further out.
Use SVG <ellipse> / <rect rx> for nodes, <path> or <line> for connections, <text> for labels.
Color: center is dark (#1a3a5c), main branches each get a distinct muted academic color (slate blues, muted teals, warm grays), sub-branches are lighter variants. White text on dark nodes, dark text on light nodes.`,

    concept_map: `
LAYOUT: Free-placement graph. Nodes are rounded rectangles scattered across the canvas with deliberate spacing.
Directed edges (arrows) connect related nodes. Each edge has a short label (verb phrase) in a small <text> near the midpoint of the line, slightly above it.
Use SVG <marker> for arrowheads. Edges can curve slightly using <path d="M... Q... ..."/> for readability.
Color: nodes in muted blue (#2d6a9f fill, white text), edge labels in dark gray (#333), arrows in #555.
The layout should visually convey the semantic structure - most connected node near center.`,

    hierarchy: `
LAYOUT: Top-down tree. Root node at top center, children below, grandchildren below that.
Each level is horizontally centered. Nodes are rounded rectangles connected by straight vertical+horizontal lines (elbow connectors: go down, then horizontal, then down).
Use consistent row height (~90px) and spread children evenly. If more than 5 children at a level, use 2 rows.
Color: root is darkest (#1a3a5c, white text), each level gets progressively lighter. Leaf nodes are light gray (#e8edf2, dark text).`,

    framework: `
LAYOUT: Structured block diagram - the classic "theoretical framework" look from academic papers.
Typically: input/antecedent boxes on the left → mediating/process box(es) in the center → outcome boxes on the right. OR top-to-bottom layers.
Use large rounded rectangles for each component, arrows between them showing direction of influence.
Include a short label inside each box AND a brief descriptor below it in smaller text.
Color: a clean 3-tone scheme - primary (#2d6a9f), secondary (#4a9d8f), accent (#e8a838) - with white text. Background #f7f9fc.`,

    process_schema: `
LAYOUT: Left-to-right or top-to-bottom sequence of phases. Each phase is a rounded rectangle or stadium shape.
Between phases: thick arrows. Each phase box has a number/step label at the top and a short description inside.
If phases have sub-steps, show them as smaller boxes below or inside the main phase box.
Optional: parallel tracks for simultaneous processes, connected with bracket-style lines.
Color: phases use a sequential blue palette (#1a3a5c → #2d6a9f → #4a9d8f → #6bbfb5). White text inside. Arrows in #333.`,

    relationship: `
LAYOUT: Network/web layout. Entities are ovals or rounded rectangles placed around the canvas (not necessarily radial).
Connections are lines or curved paths between entities. Each connection has a label near its midpoint describing the relationship type.
Bidirectional relationships use double-headed arrows; one-directional use single arrowheads.
Node size can reflect importance (larger = more connections). Use SVG <marker> for arrows.
Color: nodes in a 3-4 color scheme by entity type/category. Edges in #777. Labels in #222 on white pill backgrounds.`,

    comparison: `
LAYOUT: Two or three columns side by side with a header row. Like a comparison table but rendered visually.
Each column represents one approach/theory/model. Rows represent criteria/dimensions.
Use SVG <rect> for cells with rounded corners on header cells. Alternating row shading (white / #f0f4f8).
Include icons or small symbols (✓ ✗ ~ drawn in SVG) in cells where appropriate.
Column headers are dark (#1a3a5c, white text), criterion labels are bold gray on the left, cell values are plain text.`,
};

function buildMessages(visual: PlannedVisual, language: string): ChatMessage[] {
    const guide = TYPE_GUIDE[visual.type] ?? TYPE_GUIDE.concept_map;

    const system = `You are an academic visualization specialist. You create structural and conceptual diagrams for research papers and diploma theses - mind maps, concept maps, hierarchies, theoretical frameworks, methodology schemas, and relationship diagrams.

Generate ONE self-contained HTML file. The entire visual must be rendered as inline SVG inside the HTML body.

STRICT REQUIREMENTS:
- Viewport: ${VIEWPORT_W}×${VIEWPORT_H}px. The SVG viewBox must be "0 0 ${VIEWPORT_W} ${VIEWPORT_H}".
- ALL rendering must be SVG elements inside <svg viewBox="0 0 ${VIEWPORT_W} ${VIEWPORT_H}" width="${VIEWPORT_W}" height="${VIEWPORT_H}">.
- Background: white or #f7f9fc - set as SVG <rect> fill, not CSS body background.
- Font: use font-family="system-ui, -apple-system, Arial, sans-serif" on SVG text elements.
- Text language: ${language}. All labels, node text, and edge labels must be in ${language}.
- ZERO external dependencies. No <script src>, no <link href>, no CDN, no @import.
- No JavaScript - pure SVG only. The diagram must render statically.
- Academic style: clean, professional, no gradients on shapes (flat colors), no drop shadows, no decorative elements.

Return ONLY the raw HTML. No markdown fences, no explanations.`;

    const user = `Visual type: ${visual.type}
Section this figure belongs to: "${visual.sectionHeading}"
Figure caption: ${visual.caption}

What to depict - extract the concepts and their relationships from this description:
${visual.description}

Rendering instructions for this type:
${guide}

Now generate the complete self-contained HTML with inline SVG:`;

    return [
        { role: "system", content: system },
        { role: "user", content: user },
    ];
}

function stripFences(raw: string): string {
    return raw
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();
}

async function renderToPng(html: string): Promise<Buffer> {
    let puppeteer: typeof import("puppeteer");
    try {
        puppeteer = await import("puppeteer");
    } catch {
        throw new Error("puppeteer is not installed - run: npm install puppeteer");
    }

    const browser = await (puppeteer as any).default.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: "networkidle0", timeout: 15_000 });
        await new Promise(r => setTimeout(r, 200));
        const buf = await page.screenshot({
            type: "png",
            clip: { x: 0, y: 0, width: VIEWPORT_W, height: VIEWPORT_H },
        });
        return buf as Buffer;
    } finally {
        await browser.close();
    }
}

export async function runStage2_3(
    visuals: PlannedVisual[],
    language: string,
    onProgress?: (done: number, total: number, id?: string) => void,
): Promise<{ generatedVisuals: GeneratedVisual[]; tokensUsed: number }> {
    if (visuals.length === 0) {
        return { generatedVisuals: [], tokensUsed: 0 };
    }

    console.log(`[Stage2.3] Generating ${visuals.length} academic visual(s)`);
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
                const html = stripFences(r.text);

                const pngBuf = await renderToPng(html);
                const pngBase64 = pngBuf.toString("base64");

                console.log(`[Stage2.3] ✓ ${visual.id}.png  type=${visual.type}  size=${(pngBuf.length / 1024).toFixed(0)}KB`);

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
