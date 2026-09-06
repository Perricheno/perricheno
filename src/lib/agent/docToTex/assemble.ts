// Deterministic assembly - no LLM calls. Mirrors ../pipeline/stage4_assemble.ts's
// job (stitch preamble + title block + body into a compilable main.tex) but
// for Doc-to-TeX's own settings/chunk shapes, with two additions that pipeline
// doesn't need: a title-page/TOC path for report-class thesis output, and
// "% === chunk N ===" boundary comments so the windowed repair step
// (validate.ts) can map a compiler error's line number back to the specific
// chunk it came from without re-sending the whole document.

import { getPreset } from "../templates/presets";
import { normalizeLatexText, ensureRussianPreamble, checkLatexStructure } from "../stages";
import type { PipelineSettings, GeneratedDataFigure } from "../pipeline/types";
import type { AssemblyHeader, ChunkLevel, DocChunk, DocToTexSettings, EmbeddedImage, TranscribedChunk } from "./types";
import type { ChunkImageAssignment } from "./transcriber";

// ── Image distribution ──
// pdf-extractor has no positional link between an image and the text around
// it (images come from a separate `pdfimages` pass, text from PaddleOCR-VL) -
// see docToTex ingest notes. Best available heuristic: both lists are in
// original page order, so distribute images across chunks proportionally by
// index. Not exact placement, but images land near their rough original
// position rather than all bunched at the start or end.

export function assignImagesToChunks(
    images: EmbeddedImage[],
    chunks: DocChunk[],
): { byChunk: Map<number, { assignment: ChunkImageAssignment; dataUrl: string }[]>; shims: GeneratedDataFigure[] } {
    const byChunk = new Map<number, { assignment: ChunkImageAssignment; dataUrl: string }[]>();
    const shims: GeneratedDataFigure[] = [];
    if (images.length === 0 || chunks.length === 0) return { byChunk, shims };

    images.forEach((img, i) => {
        const chunkIdx = Math.min(chunks.length - 1, Math.floor((i * chunks.length) / images.length));
        const chunk = chunks[chunkIdx];
        const ext = img.contentType.includes("png") ? "png" : "jpg";
        const filename = `img_${i}.${ext}`;
        const base64 = img.dataUrl.split(",")[1] || "";

        const list = byChunk.get(chunk.index) || [];
        list.push({ assignment: { filename, contentType: img.contentType }, dataUrl: img.dataUrl });
        byChunk.set(chunk.index, list);

        shims.push({
            id: `doctotex_img_${i}`,
            sectionHeading: chunk.heading || `chunk_${chunk.index}`,
            filename,
            caption: "",
            label: `fig:doctotex_${i}`,
            pngBase64: base64,
            analysisType: "embedded_image",
            runtime: "R",
            code: "",
        });
    });

    return { byChunk, shims };
}

// ── Heading escaping ──
// Chunk headings come verbatim from the source document, not from an LLM, so
// they must be LaTeX-escaped here rather than trusted as-is.

function escapeLatexSpecials(s: string): string {
    let out = "";
    for (const ch of s) {
        switch (ch) {
            case "\\": out += "\\textbackslash{}"; break;
            case "&": case "%": case "$": case "#": case "_": case "{": case "}":
                out += "\\" + ch; break;
            case "~": out += "\\textasciitilde{}"; break;
            case "^": out += "\\textasciicircum{}"; break;
            default: out += ch;
        }
    }
    return out;
}

// ── Template resolution ──
// Doc-to-TeX always uses a named preset or a custom ZIP - never the legacy
// free-form `useTemplate` flag path pipeline's resolveTemplate() falls back
// to, so this stays a small, independent function rather than reusing that
// one via an adapter.

function toPresetSettingsShim(s: DocToTexSettings): PipelineSettings {
    return {
        prompt: "", docType: "report", style: "medium", wordCount: 0, columns: 1,
        useTemplate: false, useReferences: false,
        language: s.language,
        authorName: s.authorName, courseName: s.courseName, dateStr: s.dateStr,
        groupName: s.groupName, supervisorName: s.supervisorName,
    };
}

function resolvePreamble(s: DocToTexSettings): string {
    if (s.customTemplatePreamble) {
        return s.customTemplatePreamble.replace(/\\begin\s*\{document\}[\s\S]*$/, "").trim();
    }
    const preset = getPreset(s.templateId) || getPreset("plain")!;
    return preset.preamble(toPresetSettingsShim(s));
}

function headingCommand(level: ChunkLevel, header: AssemblyHeader): string {
    if (level === 1) return header.useChapters ? "chapter" : "section";
    if (level === 2) return header.useChapters ? "section" : "subsection";
    return "subsubsection";
}

// Whether to synthesize any title block at all. Faithful preservation means
// not fabricating academic front matter on top of a source that likely
// already has its own title/parties/signature block in its own body text
// (a contract, a letter, a plain report) - confirmed as a real problem live:
// a synthesized "\author{Author}" placeholder and an untranslated "\today"
// rendered on top of a Russian legal document that never asked for either.
// Only synthesize one when the source structure actually calls for it
// (thesis's forced title page) or the user explicitly supplied an author
// name (meaning they picked a template like academic and want attribution).
function wantsTitleBlock(s: DocToTexSettings, header: AssemblyHeader): boolean {
    return header.needsTitlePage || !!s.authorName;
}

function buildTitleBlock(s: DocToTexSettings, header: AssemblyHeader): string {
    const date = s.dateStr || "\\today";

    if (header.needsTitlePage) {
        const metaParts: string[] = [];
        if (s.courseName)     metaParts.push(`${s.language === "ru" ? "Курс" : "Course"}: ${s.courseName}`);
        if (s.groupName)      metaParts.push(`${s.language === "ru" ? "Группа" : "Group"}: ${s.groupName}`);
        if (s.supervisorName) metaParts.push(`${s.language === "ru" ? "Руководитель" : "Supervisor"}: ${s.supervisorName}`);

        return [
            "\\begin{titlepage}",
            "\\centering",
            "\\vspace*{2cm}",
            `{\\LARGE\\bfseries ${escapeLatexSpecials(header.title)}\\par}`,
            "\\vspace{1.5cm}",
            s.authorName ? `{\\large ${escapeLatexSpecials(s.authorName)}\\par}` : "",
            metaParts.length ? `\\vspace{0.5cm}\n{\\normalsize ${metaParts.map(escapeLatexSpecials).join(" \\\\ ")}\\par}` : "",
            "\\vfill",
            `{\\large ${date}\\par}`,
            "\\end{titlepage}",
        ].filter(Boolean).join("\n");
    }

    // Reaches here only when wantsTitleBlock() is true without needsTitlePage,
    // i.e. the user did supply an author name - safe to assume they want it shown.
    return [
        `\\title{${escapeLatexSpecials(header.title)}}`,
        `\\author{${escapeLatexSpecials(s.authorName!)}}`,
        `\\date{${date}}`,
        "\\maketitle",
    ].join("\n");
}

function buildBody(chunks: TranscribedChunk[], header: AssemblyHeader, titleAlreadyShown: boolean): string {
    const sorted = chunks.sort((a, b) => a.index - b.index);
    return sorted
        .map((c, i) => {
            // When a title block was synthesized from this exact chunk's own
            // heading, don't repeat it as a section heading immediately below.
            const suppressHeading = titleAlreadyShown && i === 0 && c.heading === header.title;
            const cmd = headingCommand(c.level, header);
            const headingLine = c.heading && !suppressHeading ? `\\${cmd}{${escapeLatexSpecials(c.heading)}}\n\n` : "";
            return `% === chunk ${c.index} ===\n${headingLine}${c.latex.trim()}\n`;
        })
        .join("\n");
}

export interface DocToTexAssembled {
    mainTex: string;
    warnings: string[];
    dataFigures: GeneratedDataFigure[];
}

export function assembleDocToTex(
    settings: DocToTexSettings,
    header: AssemblyHeader,
    chunks: TranscribedChunk[],
    imageShims: GeneratedDataFigure[],
): DocToTexAssembled {
    const warnings: string[] = [];
    const failedChunks = chunks.filter(c => c.failed);
    if (failedChunks.length > 0) {
        warnings.push(`${failedChunks.length} section(s) failed transcription and were kept as a verbatim fallback.`);
    }

    const showTitle = wantsTitleBlock(settings, header);
    const preamble = resolvePreamble(settings);
    const titleBlock = showTitle ? buildTitleBlock(settings, header) : "";
    const toc = header.needsToc ? "\\tableofcontents\n\\newpage" : "";
    const body = buildBody(chunks, header, showTitle);

    let mainTex = [
        preamble,
        "\\begin{document}",
        titleBlock,
        toc,
        body,
        "\\end{document}",
        "",
    ].join("\n\n");

    mainTex = normalizeLatexText(mainTex);
    mainTex = ensureRussianPreamble(mainTex, settings.language);

    const struct = checkLatexStructure(mainTex);
    if (struct.unbalancedBraces !== 0) warnings.push(`Brace imbalance: ${struct.unbalancedBraces}`);
    if (struct.mismatchedEnvs.length > 0) warnings.push(`Mismatched environments: ${struct.mismatchedEnvs.join(", ")}`);

    return { mainTex, warnings, dataFigures: imageShims };
}
