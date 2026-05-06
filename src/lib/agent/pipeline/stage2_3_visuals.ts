// Stage 2.3 - Visual Generation.
// For each visual planned in Stage 1, the LLM generates a self-contained HTML
// file. A headless Chromium (via puppeteer) renders it to a 800×500 PNG.
// The PNGs are later embedded in the LaTeX ZIP under figures/.
//
// Puppeteer is a peer dependency — if it is not installed, all visuals are
// marked failed and the pipeline continues without them.

import { chatCompletion, type ChatMessage } from "./llm";
import type { PlannedVisual, GeneratedVisual } from "./types";
import { withRetry } from "../stages";

const CONCURRENCY = 2;
const VIEWPORT_W = 800;
const VIEWPORT_H = 500;

const TYPE_GUIDE: Record<string, string> = {
    flowchart:    "Boxes connected by arrows. Use CSS flexbox + SVG arrows or pure SVG. Show step-by-step process.",
    diagram:      "Technical diagram with labeled components. Prefer SVG elements for precision.",
    chart:        "Bar or line chart built with inline SVG — no external chart libraries allowed.",
    timeline:     "Horizontal timeline with milestones. Use CSS flexbox or grid layout.",
    architecture: "Layered system diagram. Stacked or connected boxes in SVG or CSS.",
    comparison:   "Side-by-side comparison with a clean two-column or table layout.",
    other:        "Choose the most appropriate visual representation for the description.",
};

function buildMessages(visual: PlannedVisual, language: string): ChatMessage[] {
    const system = `You are a data-visualization expert creating academic figures.
Generate ONE self-contained HTML file (inline CSS + optional inline SVG/JS only — zero external dependencies, zero CDN links).

Hard requirements:
- Viewport: ${VIEWPORT_W}×${VIEWPORT_H}px. The figure must fill this space cleanly.
- Background: white or #f8f9fa.
- Colors: neutral, academic palette (blues, grays, one accent color max).
- Font: system-ui, -apple-system, sans-serif — no @font-face, no Google Fonts.
- Text language: ${language}.
- No <script src>, no <link href>, no import statements — the file is rendered offline.

Return ONLY the raw HTML. No markdown fences, no commentary.`;

    const user = `Visual type: ${visual.type}
Style guide: ${TYPE_GUIDE[visual.type] ?? TYPE_GUIDE.other}
Section: "${visual.sectionHeading}"
Caption (for context): ${visual.caption}

What to depict:
${visual.description}

Generate the HTML now:`;

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
    // Dynamic import so missing puppeteer doesn't break the module at load time.
    let puppeteer: typeof import("puppeteer");
    try {
        puppeteer = await import("puppeteer");
    } catch {
        throw new Error("puppeteer is not installed — run: npm install puppeteer");
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
        // Small settle time for CSS transitions / JS that runs on DOMContentLoaded.
        await new Promise(r => setTimeout(r, 300));
        const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: VIEWPORT_W, height: VIEWPORT_H } });
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

    console.log(`[Stage2.3] Generating ${visuals.length} visual(s)`);
    let totalTokens = 0;
    let completed = 0;

    // Run with bounded concurrency (one browser per slot).
    const results: GeneratedVisual[] = [];

    const queue = [...visuals];
    const workers = Array.from({ length: Math.min(CONCURRENCY, visuals.length) }, async () => {
        while (queue.length > 0) {
            const visual = queue.shift()!;
            try {
                // 1. LLM → HTML
                const messages = buildMessages(visual, language);
                const r = await withRetry(() => chatCompletion(messages, { timeoutMs: 60_000 }), 2, 800);
                totalTokens += r.totalTokens;
                const html = stripFences(r.text);

                // 2. HTML → PNG
                const pngBuf = await renderToPng(html);
                const pngBase64 = pngBuf.toString("base64");

                console.log(`[Stage2.3] ✓ ${visual.id}.png (${(pngBuf.length / 1024).toFixed(0)} KB)`);

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
