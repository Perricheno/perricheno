// Pre-built LaTeX template presets.
// Each preset provides a preamble factory (everything before \begin{document})
// and display metadata for the UI picker.

import type { PipelineSettings } from "../pipeline/types";
import { BABEL_LANG_MAP } from "../stages";

const CYRILLIC_LANGS = new Set(["ru", "uk", "kk", "bg", "sr", "mk", "be"]);

export interface TemplatePreset {
    id: string;
    name: string;
    description: string;
    /** If true, Stage 4 uses the fancy fancyhdr title block. */
    useFancyTitle: boolean;
    preamble: (s: PipelineSettings) => string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function langPackages(s: PipelineSettings): string[] {
    const lines: string[] = [];
    if (s.language === "kk") {
        lines.push("\\usepackage{fontspec}", "\\setmainfont{Inter}", "\\usepackage[kazakh]{babel}");
    } else if (CYRILLIC_LANGS.has(s.language)) {
        const bl = BABEL_LANG_MAP[s.language] ?? "russian";
        lines.push("\\usepackage[T2A]{fontenc}", "\\usepackage[utf8]{inputenc}", `\\usepackage[${bl},english]{babel}`);
    } else if (s.language !== "en") {
        const bl = BABEL_LANG_MAP[s.language];
        lines.push("\\usepackage[T1]{fontenc}", "\\usepackage[utf8]{inputenc}");
        if (bl) lines.push(`\\usepackage[${bl},english]{babel}`);
    } else {
        lines.push("\\usepackage[T1]{fontenc}", "\\usepackage[utf8]{inputenc}");
    }
    return lines;
}

function biblatexLines(s: PipelineSettings): string[] {
    if (!s.useReferences) return [];
    return ["\\usepackage[style=apa, backend=biber]{biblatex}", "\\addbibresource{references.bib}"];
}

function columnClass(s: PipelineSettings): string {
    return s.columns === 2 ? "[twocolumn]" : "";
}

// ── Presets ───────────────────────────────────────────────────────────────────

const PLAIN: TemplatePreset = {
    id: "plain",
    name: "Plain",
    description: "Clean article with standard 1-inch margins. No frills.",
    useFancyTitle: false,
    preamble: (s) => [
        `\\documentclass${columnClass(s)}{article}`,
        ...langPackages(s),
        "\\usepackage{amsmath,amssymb,amsthm}",
        "\\usepackage{graphicx}",
        "\\graphicspath{{images/}}",
        "\\usepackage{hyperref}",
        "\\usepackage{geometry}",
        "\\usepackage{booktabs}",
        "\\usepackage{enumitem}",
        "\\usepackage{setspace}",
        "\\usepackage{parskip}",
        "\\geometry{lmargin=1in,rmargin=1in,tmargin=1in,bmargin=1in}",
        ...biblatexLines(s),
        "\\hypersetup{colorlinks=true,linkcolor=black,filecolor=black,urlcolor=blue,citecolor=black}",
    ].join("\n"),
};

const ACADEMIC: TemplatePreset = {
    id: "academic",
    name: "Academic",
    description: "Astana IT University style: header with author/type, ruled title block.",
    useFancyTitle: true,
    preamble: (s) => [
        `\\documentclass${columnClass(s)}{article}`,
        ...langPackages(s),
        "\\usepackage{amsmath,amssymb,amsthm}",
        "\\usepackage{graphicx}",
        "\\graphicspath{{images/}}",
        "\\usepackage{hyperref}",
        "\\usepackage{geometry}",
        "\\usepackage{booktabs}",
        "\\usepackage{enumitem}",
        "\\usepackage{setspace}",
        "\\usepackage{parskip}",
        "\\usepackage{fancyhdr}",
        "\\usepackage{titlesec}",
        "\\geometry{a4paper,left=8mm,right=8mm,top=15mm,bottom=15mm,headheight=14pt,headsep=10pt,footskip=12pt}",
        "\\setstretch{1.1}",
        "\\pagestyle{fancy}",
        "\\fancyhf{}",
        "\\renewcommand{\\headrulewidth}{0.4pt}",
        "\\renewcommand{\\footrulewidth}{0.4pt}",
        `\\fancyhead[L]{\\small ${s.authorName || "Author"}}`,
        `\\fancyhead[R]{\\small \\textsc{${s.docType.toUpperCase()}}}`,
        "\\fancyfoot[C]{\\small \\thepage}",
        "\\titleformat{\\section}{\\normalfont\\large\\bfseries}{\\thesection}{1em}{}",
        "\\titleformat{\\subsection}{\\normalfont\\normalsize\\bfseries}{\\thesubsection}{1em}{}",
        ...biblatexLines(s),
        "\\hypersetup{colorlinks=true,linkcolor=black,filecolor=black,urlcolor=blue,citecolor=black}",
    ].join("\n"),
};

const IEEE: TemplatePreset = {
    id: "ieee",
    name: "IEEE",
    description: "Two-column layout imitating IEEE conference proceedings style.",
    useFancyTitle: false,
    preamble: (s) => [
        "\\documentclass[conference,compsoc]{IEEEtran}",
        ...langPackages(s),
        "\\usepackage{amsmath,amssymb,amsthm}",
        "\\usepackage{graphicx}",
        "\\graphicspath{{images/}}",
        "\\usepackage[hidelinks]{hyperref}",
        "\\usepackage{booktabs}",
        "\\usepackage{enumitem}",
        ...biblatexLines(s),
        "\\hypersetup{colorlinks=false}",
    ].join("\n"),
};

const ELEGANT: TemplatePreset = {
    id: "elegant",
    name: "Elegant",
    description: "Palatino serif font, generous margins, pleasant reading typography.",
    useFancyTitle: false,
    preamble: (s) => {
        const isCyrillic = CYRILLIC_LANGS.has(s.language);
        // Palatino requires TeX Gyre fonts when using T2A; fall back to lmodern for Cyrillic
        const fontLines = isCyrillic
            ? ["\\usepackage{lmodern}"]
            : ["\\usepackage{palatino}", "\\usepackage[sc]{mathpazo}"];
        return [
            `\\documentclass${columnClass(s)}{article}`,
            ...langPackages(s),
            ...fontLines,
            "\\usepackage{amsmath,amssymb,amsthm}",
            "\\usepackage{graphicx}",
            "\\graphicspath{{images/}}",
            "\\usepackage{microtype}",
            "\\usepackage{hyperref}",
            "\\usepackage{geometry}",
            "\\usepackage{booktabs}",
            "\\usepackage{enumitem}",
            "\\usepackage{setspace}",
            "\\usepackage{parskip}",
            "\\geometry{a4paper,lmargin=1.3in,rmargin=1.3in,tmargin=1.2in,bmargin=1.2in}",
            "\\setstretch{1.2}",
            ...biblatexLines(s),
            "\\hypersetup{colorlinks=true,linkcolor=black,urlcolor=teal,citecolor=black}",
        ].join("\n");
    },
};

const MINIMAL: TemplatePreset = {
    id: "minimal",
    name: "Minimal",
    description: "Bare essentials only. Tight margins, no decorations, fastest compile.",
    useFancyTitle: false,
    preamble: (s) => [
        `\\documentclass${columnClass(s)}{article}`,
        ...langPackages(s),
        "\\usepackage{amsmath,amssymb}",
        "\\usepackage{graphicx}",
        "\\usepackage{hyperref}",
        "\\usepackage{geometry}",
        "\\geometry{a4paper,margin=2cm}",
        ...biblatexLines(s),
        "\\hypersetup{colorlinks=true,urlcolor=blue}",
    ].join("\n"),
};

const THESIS: TemplatePreset = {
    id: "thesis",
    name: "Thesis",
    description: "Report class: title page, table of contents, numbered chapters.",
    useFancyTitle: false,
    preamble: (s) => [
        "\\documentclass[a4paper,12pt]{report}",
        ...langPackages(s),
        "\\usepackage{amsmath,amssymb,amsthm}",
        "\\usepackage{graphicx}",
        "\\graphicspath{{images/}{figures/}}",
        "\\usepackage{hyperref}",
        "\\usepackage{geometry}",
        "\\usepackage{booktabs}",
        "\\usepackage{enumitem}",
        "\\usepackage{setspace}",
        "\\geometry{a4paper,margin=2.5cm}",
        "\\setstretch{1.5}",
        ...biblatexLines(s),
        "\\hypersetup{colorlinks=true,linkcolor=black,urlcolor=blue,citecolor=black}",
    ].join("\n"),
};

export const TEMPLATE_PRESETS: TemplatePreset[] = [PLAIN, ACADEMIC, IEEE, ELEGANT, MINIMAL, THESIS];

export function getPreset(id: string): TemplatePreset | undefined {
    return TEMPLATE_PRESETS.find(p => p.id === id);
}
