// Stage 4 - Assemble.
// Deterministic. No LLM calls. Takes the drafted section bodies and stitches
// them into a complete LaTeX document. Runs UTF-8 normalization, injects
// Russian-language packages when needed, reconciles \cite keys against the
// bibliography, and stubs any that the bib is missing so pdflatex won't die
// on the first pass.

import type { AssembledDoc, ExtractedRef, GeneratedDataFigure, GeneratedVisual, Plan, SectionDraft, PipelineSettings } from "./types";
import {
    normalizeLatexText,
    ensureRussianPreamble,
    findUnresolvedCitations,
    checkLatexStructure,
    BABEL_LANG_MAP,
} from "../stages";
import { TEMPLATE_PRESETS } from "../templates/presets";

const CYRILLIC_LANGS = new Set(["ru", "uk", "kk", "bg", "sr", "mk", "be"]);

function buildPreamble(s: PipelineSettings): string {
    const columnClass = s.columns === 2 ? "[twocolumn]" : "";
    const lines: string[] = [
        `\\documentclass${columnClass}{article}`,
    ];

    const isKazakh = s.language === "kk";
    const isCyrillic = CYRILLIC_LANGS.has(s.language);

    if (isKazakh) {
        // Kazakh requires XeLaTeX and system fonts
        lines.push(
            "\\usepackage{fontspec}",
            "\\setmainfont{Inter}",
            "\\usepackage[kazakh]{babel}"
        );
    } else if (isCyrillic) {
        lines.push("\\usepackage[T2A]{fontenc}");
        lines.push("\\usepackage[utf8]{inputenc}");
        const babelLang = BABEL_LANG_MAP[s.language] ?? "russian";
        lines.push(`\\usepackage[${babelLang},english]{babel}`);
    } else if (s.language !== "en") {
        lines.push("\\usepackage[T1]{fontenc}");
        lines.push("\\usepackage[utf8]{inputenc}");
        const babelLang = BABEL_LANG_MAP[s.language];
        if (babelLang) lines.push(`\\usepackage[${babelLang},english]{babel}`);
    } else {
        lines.push("\\usepackage[T1]{fontenc}");
        lines.push("\\usepackage[utf8]{inputenc}");
    }

    lines.push(
        "\\usepackage{amsmath,amssymb,amsthm}",
        "\\usepackage{graphicx}",
        "\\graphicspath{{images/}{figures/}}",
        "\\usepackage{tikz}",
        "\\usepackage{adjustbox}",
        "\\usepackage{hyperref}",
        "\\usepackage{geometry}",
        "\\usepackage{booktabs}",
        "\\usepackage{enumitem}",
        "\\usepackage{setspace}",
        "\\usepackage{parskip}",
    );

    // Standard Template Settings
    if (s.useTemplate) {
        lines.push(
            "\\usepackage{fancyhdr}",
            "\\usepackage{titlesec}",
            "\\geometry{a4paper,left=8mm,right=8mm,top=15mm,bottom=15mm,headheight=14pt,headsep=10pt,footskip=12pt}",
            "\\setstretch{1.1}",
            "\\pagestyle{fancy}",
            "\\fancyhf{}",
            "\\renewcommand{\\headrulewidth}{0.4pt}",
            "\\renewcommand{\\footrulewidth}{0.4pt}",
            "\\fancyhead[L]{\\small " + (s.authorName || "Author") + "}",
            "\\fancyhead[R]{\\small \\textsc{" + (s.docType.toUpperCase()) + "}}",
            "\\fancyfoot[C]{\\small \\thepage}",
            "\\titleformat{\\section}{\\normalfont\\large\\bfseries}{\\thesection}{1em}{}",
            "\\titleformat{\\subsection}{\\normalfont\\normalsize\\bfseries}{\\thesubsection}{1em}{}",
        );
    } else {
        lines.push(
            "\\geometry{lmargin=1in,rmargin=1in,tmargin=1in,bmargin=1in}",
        );
    }

    if (s.useReferences) {
        lines.push(
            "\\usepackage[style=apa, backend=biber]{biblatex}",
            "\\addbibresource{references.bib}",
        );
    }

    lines.push(
        "\\hypersetup{colorlinks=true,linkcolor=black,filecolor=black,urlcolor=blue,citecolor=black}",
    );
    return lines.join("\n");
}

function buildTitleBlock(s: PipelineSettings, title: string): string {
    const author = s.authorName || "Author";
    const affiliation = "Astana IT University";
    const date = s.dateStr || "\\today";

    const metaParts: string[] = [];
    if (s.courseName)     metaParts.push(`\\textbf{${s.language === "ru" ? "Курс" : "Course"}:} ${s.courseName}`);
    if (s.groupName)      metaParts.push(`\\textbf{${s.language === "ru" ? "Группа" : "Group"}:} ${s.groupName}`);
    if (s.supervisorName) metaParts.push(`\\textbf{${s.language === "ru" ? "Преподаватель" : "Supervisor"}:} ${s.supervisorName}`);
    
    let titleContent = "";
    if (s.useTemplate) {
        const metaLine = metaParts.length ? `\n\\begin{center}\n${metaParts.join(" \\\\ ")}\n\\end{center}\n` : "";
        titleContent = [
            `\\begin{center}`,
            `  {\\LARGE\\bfseries ${title} \\par}`,
            `  \\vspace{1.5ex}`,
            `  {\\large ${author} \\\\ ${affiliation} \\par}`,
            `  \\vspace{1ex}`,
            `  {\\small ${date} \\par}`,
            metaLine,
            `\\end{center}`,
            `\\vspace{2em}`,
            `\\hrule`,
            `\\vspace{1.5em}`,
        ].join("\n");
    } else {
        const metaLine = metaParts.length ? `\n\\begin{center}\n${metaParts.join(" \\qquad ")}\n\\end{center}\n` : "";
        titleContent = [
            `\\title{${title}}`,
            `\\author{${author} \\\\ ${affiliation}}`,
            `\\date{${date}}`,
            `\\maketitle`,
            metaLine,
        ].join("\n");
    }

    return [
        `\\begin{document}`,
        titleContent,
    ].join("\n");
}

function buildSectionBlock(sections: SectionDraft[]): string {
    return sections.map(sec => `\\section{${sec.heading}}\n\n${sec.body.trim()}\n`).join("\n");
}

function stubMissingBibEntries(missingKeys: string[], lang: string): string {
    if (missingKeys.length === 0) return "";
    const note = lang === "ru" ? "Автоматически сгенерированная заглушка" : "Auto-generated placeholder";
    return missingKeys.map(k => `@misc{${k},
  title  = {[${note}: ${k}]},
  author = {Unknown},
  year   = {n.d.},
  note   = {Reference metadata was unavailable at generation time}
}`).join("\n\n");
}

// ── TikZ visual injection ────────────────────────────────────────────────────
// Collects all \usetikzlibrary{} declarations from generated visuals and appends
// them to the preamble (deduped). Then replaces each \includegraphics{figures/X.png}
// inside a figure block with the inline tikzpicture code.

function addTikzLibrariesToPreamble(preamble: string, visuals: GeneratedVisual[]): string {
    const active = visuals.filter(v => !v.failed && v.tikzCode);
    if (active.length === 0) return preamble;

    const allLibs = new Set<string>();
    for (const v of active) {
        for (const m of v.tikzCode.matchAll(/\\usetikzlibrary\{([^}]+)\}/g)) {
            m[1].split(",").map(s => s.trim()).filter(Boolean).forEach(l => allLibs.add(l));
        }
    }

    if (allLibs.size === 0) return preamble;
    return preamble + `\n\\usetikzlibrary{${[...allLibs].join(",")}}`;
}

function injectTikzFigures(mainTex: string, visuals: GeneratedVisual[]): string {
    const byFilename = new Map(
        visuals.filter(v => !v.failed && v.tikzCode).map(v => [v.filename, v]),
    );
    if (byFilename.size === 0) return mainTex;

    return mainTex.replace(
        /\\includegraphics(?:\[[^\]]*\])?\{figures\/([^}]+)\}/g,
        (match, filename) => {
            const visual = byFilename.get(filename);
            if (!visual) return match;
            // Strip \usetikzlibrary lines — already in preamble
            const tikzPicture = visual.tikzCode
                .replace(/\\usetikzlibrary\{[^}]+\}\s*/g, "")
                .trim();
            // Scale down to fit column/text width only if wider; never upscale small diagrams
            return `\\begin{adjustbox}{max width=\\linewidth,center}\n${tikzPicture}\n\\end{adjustbox}`;
        },
    );
}

// ── Template resolution ─────────────────────────────────────────────────────
// Returns the full preamble string (everything before \begin{document}).
// Priority: custom ZIP upload → named preset → legacy buildPreamble().

function injectBiblatexIfNeeded(preamble: string, useReferences: boolean): string {
    if (!useReferences) return preamble;
    if (/\\usepackage.*\{biblatex\}/.test(preamble)) return preamble;
    const bibLines = "\\usepackage[style=apa, backend=biber]{biblatex}\n\\addbibresource{references.bib}";
    // Insert just before \begin{document} if present; otherwise append.
    const idx = preamble.lastIndexOf("\\begin{document}");
    if (idx !== -1) return preamble.slice(0, idx) + bibLines + "\n" + preamble.slice(idx);
    return preamble + "\n" + bibLines;
}

function resolveTemplate(settings: PipelineSettings): { preamble: string; useFancyTitle: boolean } {
    // 1. Custom Overleaf ZIP preamble
    if (settings.customTemplatePreamble) {
        // Strip \begin{document} and anything after it - Stage 4 adds that.
        const raw = settings.customTemplatePreamble.replace(/\\begin\s*\{document\}[\s\S]*$/, "").trim();
        const preamble = injectBiblatexIfNeeded(raw, !!settings.useReferences);
        return { preamble, useFancyTitle: false };
    }

    // 2. Named preset
    if (settings.templateId && settings.templateId !== "plain") {
        const preset = TEMPLATE_PRESETS.find(p => p.id === settings.templateId);
        if (preset) {
            const preamble = injectBiblatexIfNeeded(preset.preamble(settings), !!settings.useReferences);
            return { preamble, useFancyTitle: preset.useFancyTitle };
        }
    }

    // 3. Legacy useTemplate flag / default
    return { preamble: buildPreamble(settings), useFancyTitle: settings.useTemplate };
}

export function runStage4(
    settings: PipelineSettings,
    plan: Plan,
    refs: ExtractedRef[],
    sections: SectionDraft[],
    generatedVisuals: GeneratedVisual[] = [],
    dataFigures: GeneratedDataFigure[] = [],
): AssembledDoc {
    const warnings: string[] = [];

    // ── Bibliography ──
    const okRefs = refs.filter(r => r.status === "ok" && r.bibEntry);
    let referencesBib: string | null = null;
    if (settings.useReferences && okRefs.length > 0) {
        referencesBib = okRefs.map(r => r.bibEntry!.trim()).join("\n\n");
    }

    const failed = refs.filter(r => r.status === "failed");
    if (failed.length > 0) warnings.push(`${failed.length} reference file(s) failed extraction.`);

    // ── Title + body ──
    const title = plan.title;

    const { preamble: rawPreamble, useFancyTitle } = resolveTemplate(settings);
    const preamble = addTikzLibrariesToPreamble(rawPreamble, generatedVisuals);
    const titleBlock = buildTitleBlock({ ...settings, useTemplate: useFancyTitle }, title);
    const body = buildSectionBlock(sections);

    const closing = settings.useReferences
        ? "\\printbibliography\n\\end{document}"
        : "\\end{document}";

    let mainTex = `${preamble}\n\n${titleBlock}\n\n${body}\n${closing}\n`;

    // Replace \includegraphics{figures/X.png} with inline TikZ for generated visuals
    mainTex = injectTikzFigures(mainTex, generatedVisuals);

    // ── Normalize and sanity-check ──
    mainTex = normalizeLatexText(mainTex);
    mainTex = ensureRussianPreamble(mainTex, settings.language);

    if (referencesBib) referencesBib = normalizeLatexText(referencesBib);

    // ── Unresolved \cite{...} ──
    const missing = findUnresolvedCitations(mainTex, referencesBib);
    if (missing.length > 0) {
        warnings.push(`Unresolved citations: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}`);
        const stubs = stubMissingBibEntries(missing, settings.language);
        if (stubs) {
            referencesBib = referencesBib ? `${referencesBib}\n\n${stubs}` : stubs;
        }
    }

    // ── Structural sanity ──
    const struct = checkLatexStructure(mainTex);
    if (struct.unbalancedBraces !== 0) warnings.push(`Brace imbalance: ${struct.unbalancedBraces}`);
    if (struct.mismatchedEnvs.length > 0) warnings.push(`Mismatched environments: ${struct.mismatchedEnvs.join(", ")}`);

    return {
        mainTex,
        referencesBib,
        warnings,
        unresolvedCitations: missing,
        visuals: generatedVisuals.filter(v => !v.failed && v.tikzCode),
        dataFigures: dataFigures.filter(v => !v.failed && v.pngBase64),
    };
}
