// Stage 4 - Assemble.
// Deterministic. No LLM calls. Takes the drafted section bodies and stitches
// them into a complete LaTeX document. Runs UTF-8 normalization, injects
// Russian-language packages when needed, reconciles \cite keys against the
// bibliography, and stubs any that the bib is missing so pdflatex won't die
// on the first pass.

import type { AssembledDoc, ExtractedRef, Plan, SectionDraft, PipelineSettings, DocumentDesign } from "./types";
import {
    normalizeLatexText,
    ensureRussianPreamble,
    findUnresolvedCitations,
    checkLatexStructure,
    BABEL_LANG_MAP,
} from "../stages";

const CYRILLIC_LANGS = new Set(["ru", "uk", "kk", "bg", "sr", "mk", "be"]);

function buildPreamble(s: PipelineSettings, design?: DocumentDesign): string {
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
        "\\graphicspath{{images/}}",
        "\\usepackage{hyperref}",
        "\\usepackage{geometry}",
        "\\usepackage{booktabs}",
        "\\usepackage{enumitem}",
        "\\usepackage{setspace}",
        "\\usepackage{parskip}",
    );

    // Merge LLM design if available, otherwise use defaults
    if (design?.preamble) {
        lines.push("\n% --- Custom LLM Design ---");
        lines.push(design.preamble);
        lines.push("% -------------------------\n");
    } else if (s.useTemplate) {
        lines.push(
            "\\usepackage{fancyhdr}",
            "\\usepackage{titlesec}",
            "\\geometry{a4paper,left=25mm,right=25mm,top=28mm,bottom=28mm,headheight=14pt,headsep=10pt,footskip=12pt}",
            "\\onehalfspacing",
            "\\pagestyle{fancy}",
            "\\fancyhf{}",
            "\\fancyfoot[C]{\\thepage}",
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

function buildTitleBlock(s: PipelineSettings, title: string, design?: DocumentDesign): string {
    const author = s.authorName || "Author";
    const affiliation = "Astana IT University";
    const date = s.dateStr || "\\today";

    if (design?.titleBlock) {
        // Replace placeholders if LLM used them
        let block = design.titleBlock;
        block = block.replace(/\\thetitle/g, title);
        block = block.replace(/\\theauthor/g, author);
        return `\\begin{document}\n${block}`;
    }

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

export function runStage4(
    settings: PipelineSettings,
    plan: Plan,
    refs: ExtractedRef[],
    sections: SectionDraft[],
    design?: DocumentDesign,
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
    
    const preamble = buildPreamble(settings, design);
    const titleBlock = buildTitleBlock(settings, title, design);
    const body = buildSectionBlock(sections);

    const closing = settings.useReferences
        ? "\\printbibliography\n\\end{document}"
        : "\\end{document}";

    let mainTex = `${preamble}\n\n${titleBlock}\n\n${body}\n${closing}\n`;

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
    };
}
