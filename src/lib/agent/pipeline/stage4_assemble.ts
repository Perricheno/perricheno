// Stage 4 - Assemble.
// Deterministic. No LLM calls. Takes the drafted section bodies and stitches
// them into a complete LaTeX document. Runs UTF-8 normalization, injects
// Russian-language packages when needed, reconciles \cite keys against the
// bibliography, and stubs any that the bib is missing so pdflatex won't die
// on the first pass.

import type { AssembledDoc, ExtractedRef, Plan, SectionDraft, PipelineSettings } from "./types";
import {
    normalizeLatexText,
    ensureRussianPreamble,
    findUnresolvedCitations,
    checkLatexStructure,
    BABEL_LANG_MAP,
} from "../stages";

const CYRILLIC_LANGS = new Set(["ru", "uk", "kk", "bg", "sr", "mk", "be"]);

function buildPreamble(s: PipelineSettings): string {
    const columnClass = s.columns === 2 ? "[twocolumn]" : "";
    const lines: string[] = [
        `\\documentclass${columnClass}{article}`,
    ];

    const isKazakh = s.language === "kk";
    const isCyrillic = CYRILLIC_LANGS.has(s.language);

    if (!isKazakh) {
        lines.push("\\usepackage[utf8]{inputenc}");
    }

    if (isKazakh) {
        // Казахский требует XeLaTeX и системных шрифтов
        lines.push(
            "\\usepackage{fontspec}",
            "\\setmainfont{Inter}",
            "\\usepackage[kazakh]{babel}"
        );
    } else if (isCyrillic) {
        lines.push("\\usepackage[T2A]{fontenc}");
        const babelLang = BABEL_LANG_MAP[s.language] ?? "russian";
        lines.push(`\\usepackage[${babelLang},english]{babel}`);
    } else if (s.language !== "en") {
        lines.push("\\usepackage[T1]{fontenc}");
        const babelLang = BABEL_LANG_MAP[s.language];
        if (babelLang) lines.push(`\\usepackage[${babelLang},english]{babel}`);
    } else {
        lines.push("\\usepackage[T1]{fontenc}");
    }

    lines.push(
        "\\usepackage{amsmath,amssymb,amsthm}",
        "\\usepackage{graphicx}",
        "\\graphicspath{{images/}}",
        "\\usepackage{hyperref}",
        "\\usepackage{geometry}",
        "\\usepackage{booktabs}",
        "\\usepackage{enumitem}",
    );

    if (s.useTemplate) {
        lines.push(
            "\\usepackage{fancyhdr}",
            "\\usepackage{titlesec}",
            "\\geometry{lmargin=0.8in,rmargin=0.8in,tmargin=1in,bmargin=1in}",
            "\\pagestyle{fancy}",
            "\\fancyhf{}",
            "\\fancyfoot[C]{\\thepage}",
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
    const metaLine = metaParts.length ? `\n\\begin{center}\n${metaParts.join(" \\qquad ")}\n\\end{center}\n` : "";

    return [
        `\\title{${title}}`,
        `\\author{${author} \\\\ ${affiliation}}`,
        `\\date{${date}}`,
        `\\begin{document}`,
        `\\maketitle`,
        metaLine,
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
    const preamble = buildPreamble(settings);
    const titleBlock = buildTitleBlock(settings, title);
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
