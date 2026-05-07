// Stage 1 - Plan.
// Single LLM call. Turns the user prompt + settings into a structured outline
// with per-section word budgets. Has a deterministic fallback so the pipeline
// can proceed even if the model misbehaves.

import { chatCompletion, parseJsonLoose, LlmError } from "./llm";
import type { Plan, PlanSection, PipelineSettings, DocType, PlannedVisual, VisualType } from "./types";
import { withRetry, BABEL_LANG_MAP } from "../stages";

const LANG_DISPLAY_NAMES: Record<string, string> = {
    en: "English", ru: "Russian", uk: "Ukrainian", kk: "Kazakh",
    de: "German", fr: "French", es: "Spanish", it: "Italian",
    pt: "Portuguese", nl: "Dutch", pl: "Polish", cs: "Czech",
    sk: "Slovak", hu: "Hungarian", ro: "Romanian", el: "Greek",
    tr: "Turkish", sv: "Swedish", no: "Norwegian", da: "Danish",
    fi: "Finnish", bg: "Bulgarian", sr: "Serbian",
};

// Max words per section before we force a split into sub-sections.
const MAX_WORDS_PER_SECTION = 4000;

// Default outlines per doc type; used as a fallback AND as a starting hint.
const DEFAULT_OUTLINES: Record<DocType, string[]> = {
    research:          ["Introduction", "Background", "Methodology", "Results", "Discussion", "Conclusion"],
    assignment:        ["Introduction", "Main Analysis", "Discussion", "Conclusion"],
    report:            ["Executive Summary", "Introduction", "Data Overview", "Analysis", "Findings", "Conclusion"],
    lab_report:        ["Abstract", "Introduction", "Materials and Methods", "Results", "Discussion", "Conclusion"],
    literature_review: ["Introduction", "Search Strategy", "Thematic Synthesis", "Gaps and Open Questions", "Conclusion"],
    diploma:           ["Introduction", "Literature Review", "Methodology", "Experiments", "Results", "Discussion", "Conclusion", "Future Work"],
    case_study:        ["Introduction", "Case Background", "Analysis", "Discussion", "Recommendations", "Conclusion"],
};

function localizedHeadings(docType: DocType, lang: string): string[] {
    const en = DEFAULT_OUTLINES[docType] ?? DEFAULT_OUTLINES.research;
    if (lang === "en") return en;
    const map: Record<string, string> = {
        "Introduction": "Введение",
        "Background": "Предпосылки",
        "Methodology": "Методология",
        "Materials and Methods": "Материалы и методы",
        "Results": "Результаты",
        "Discussion": "Обсуждение",
        "Conclusion": "Заключение",
        "Abstract": "Аннотация",
        "Main Analysis": "Основной анализ",
        "Executive Summary": "Резюме",
        "Data Overview": "Обзор данных",
        "Analysis": "Анализ",
        "Findings": "Выводы",
        "Search Strategy": "Стратегия поиска",
        "Thematic Synthesis": "Тематический синтез",
        "Gaps and Open Questions": "Пробелы и открытые вопросы",
        "Literature Review": "Обзор литературы",
        "Experiments": "Эксперименты",
        "Future Work": "Дальнейшая работа",
        "Case Background": "История вопроса",
        "Recommendations": "Рекомендации",
    };
    return en.map(h => map[h] ?? h);
}

const VISUAL_CAPABLE_DOCTYPES = new Set<DocType>(["research", "diploma", "report", "lab_report", "case_study"]);

function buildFallbackPlan(s: PipelineSettings, filenames: string[]): Plan {
    const headings = localizedHeadings(s.docType, s.language);
    const n = headings.length;
    const perSection = Math.ceil(s.wordCount / n);

    const sections: PlanSection[] = headings.map(h => ({
        heading: h,
        wordTarget: Math.min(perSection, MAX_WORDS_PER_SECTION),
        tasks: [],
        refFocus: filenames.slice(0, 3),
    }));

    return {
        title: s.prompt.slice(0, 80).trim() || "Untitled Document",
        sections: splitOversizedSections(sections, s.language),
        totalWordTarget: s.wordCount,
        docType: s.docType,
        language: s.language,
        visuals: [],
    };
}

function splitOversizedSections(sections: PlanSection[], lang: string): PlanSection[] {
    const out: PlanSection[] = [];
    for (const sec of sections) {
        if (sec.wordTarget <= MAX_WORDS_PER_SECTION) { out.push(sec); continue; }
        const parts = Math.ceil(sec.wordTarget / MAX_WORDS_PER_SECTION);
        const each = Math.ceil(sec.wordTarget / parts);
        for (let i = 0; i < parts; i++) {
            out.push({
                heading: `${sec.heading} - ${lang === "ru" ? "часть" : "Part"} ${i + 1}`,
                wordTarget: each,
                tasks: sec.tasks,
                refFocus: sec.refFocus,
            });
        }
    }
    return out;
}

function buildSystemPrompt(s: PipelineSettings, filenames: string[]): string {
    const lang = LANG_DISPLAY_NAMES[s.language] ?? s.language;
    const styleNotes = {
        simple: "Undergraduate-level clarity. Short sentences, plain vocabulary.",
        medium: "Standard academic style. Clear structure, proper terminology.",
        phd:    "Research-grade prose. Dense argumentation, sophisticated vocabulary.",
    }[s.style];

    const hasRefs = s.useReferences && filenames.length > 0;

    // 0 = disabled; undefined = let planner decide (default 1-3); 2-10 = user choice
    const visualTarget = typeof s.visualCount === "number" ? s.visualCount : null;
    const wantsVisuals = VISUAL_CAPABLE_DOCTYPES.has(s.docType) && visualTarget !== 0;
    const visualSchema = wantsVisuals ? `
  "visuals": [
    {
      "id": "fig_slug_no_spaces",
      "sectionHeading": "exact section heading string",
      "type": "mind_map|concept_map|hierarchy|framework|process_schema|relationship|comparison|timeline|flowchart|network|venn|architecture|cycle|causal_loop|matrix_2x2|stakeholder_map|fishbone|state_machine|sequence_diagram|er_diagram|onion_model|pipeline_flow|force_field|gantt|value_chain|ecosystem_map|bracket_tree|wbs|swot|systems_map",
      "description": "exactly what concepts/entities this visual shows and how they relate (2-3 sentences for the renderer)",
      "caption": "Figure caption text in ${lang}",
      "label": "fig:slug_no_spaces"
    }
  ]` : `\n  "visuals": []`;

    return `You are a scientific writing planner. Given a topic and constraints, you produce a structured outline for a ${s.docType} in ${lang}.

Output ONLY valid JSON:
{
  "title": "string - a concise descriptive title",
  "sections": [
    {
      "heading": "string",
      "wordTarget": <integer - approximate word count for this section>,
      "tasks": ["bullet points describing what must be covered"${hasRefs ? `, 3-6 items` : ``}],
      "refFocus": [${hasRefs ? `"filenames.pdf" from the provided reference list that are most relevant to this section; pick at most 3` : `leave empty`}],
      "visualIds": ["fig_slug if a visual is planned for this section, else leave empty"]
    }
  ],${visualSchema}
}

Rules:
- Distribute the total word budget (~${s.wordCount} words) across sections. Weight by convention for a ${s.docType}.
- No section should exceed ${MAX_WORDS_PER_SECTION} words. If a section would need more, split into logical sub-sections.
- Section headings must be in ${lang}.
- Style: ${styleNotes}
${hasRefs ? `- Reference files available (filenames only, content not yet read): ${filenames.map(f => `"${f}"`).join(", ")}. Match each section to the files whose titles suggest relevance.` : `- No external references. Do not fabricate citations in tasks.`}
${wantsVisuals ? `- Plan EXACTLY ${visualTarget !== null ? visualTarget : "2–3"} visual(s). Use ONLY structural/conceptual visuals typical for academic papers. Do NOT plan statistical charts, bar graphs, or data plots (those are handled separately).
- Spread visuals across different sections - at most 1 visual per section. Assign each to the section where it is most relevant.
- Pick the type that best fits the content:
  mind_map — branching topics radiating from a central concept
  concept_map — labeled semantic links between concepts
  hierarchy — taxonomy, classification, or organizational tree
  framework — theoretical/research model with logical box arrangement
  process_schema — sequential or parallel methodology/research phases
  relationship — multi-entity connection web showing who connects to whom
  comparison — structured side-by-side comparison of approaches or theories
  timeline — chronological sequence of events or developments along an axis
  flowchart — decision flow with diamond decision nodes and Yes/No branches
  network — graph with weighted/labeled edges between source, intermediate, and sink nodes
  venn — overlapping circles showing set intersections and shared concepts
  architecture — layered system, model, or pipeline architecture (components, modules)
  cycle — circular process loop with stages connected by curved arrows (PDCA, ADDIE, feedback cycles)
  causal_loop — causal loop diagram: variables with +/− arcs showing reinforcing/balancing feedback (systems thinking)
  matrix_2x2 — 2×2 strategic quadrant map: items positioned by two axes (BCG, priority, positioning)
  stakeholder_map — concentric rings: stakeholders placed by proximity/influence to focal entity
  fishbone — Ishikawa cause-effect: spine pointing to effect, diagonal branches for cause categories
  state_machine — finite state automaton: states as circles, transitions as labeled directed arrows
  sequence_diagram — UML-style interaction: vertical lifelines, horizontal message arrows, activation boxes
  er_diagram — entity-relationship: rectangle entities, diamond relationships, ellipse attributes, cardinality
  onion_model — concentric filled layers: environmental/contextual nesting from core outward
  pipeline_flow — processing pipeline with data annotations on flow arrows and optional feedback arc
  force_field — Lewin force field: driving forces (→) vs restraining forces (←) around equilibrium line
  gantt — simplified Gantt chart: task bars on a horizontal time axis with milestones
  value_chain — Porter's value chain: 5 primary activities + 4 support activities + margin
  ecosystem_map — actor ecosystem: focal entity at center, surrounding actors grouped by sector with interaction arrows
  bracket_tree — hierarchical bracket/syntax tree: root at top, children via angled lines with category labels
  wbs — work breakdown structure: project → major deliverables → work packages with WBS codes
  swot — SWOT 2×2 grid: Strengths/Weaknesses/Opportunities/Threats with bullet items in each quadrant
  systems_map — system boundary diagram: internal components + external actors + cross-boundary flows
- Visual ids must be unique slugs (lowercase letters, digits, underscores only). Label must be "fig:" + that id.` : ``}

Do NOT output markdown fences. Do NOT add commentary. JSON only.`;
}

const VALID_VISUAL_TYPES = new Set<VisualType>(["mind_map", "concept_map", "hierarchy", "framework", "process_schema", "relationship", "comparison", "timeline", "flowchart", "network", "venn", "architecture", "cycle", "causal_loop", "matrix_2x2", "stakeholder_map", "fishbone", "state_machine", "sequence_diagram", "er_diagram", "onion_model", "pipeline_flow", "force_field", "gantt", "value_chain", "ecosystem_map", "bracket_tree", "wbs", "swot", "systems_map"]);

function validatePlan(p: any): Plan | null {
    if (!p || typeof p !== "object") return null;
    if (typeof p.title !== "string" || !Array.isArray(p.sections) || p.sections.length === 0) return null;
    const sections: PlanSection[] = [];
    for (const s of p.sections) {
        if (typeof s?.heading !== "string" || !s.heading.trim()) continue;
        const wt = Number(s.wordTarget);
        if (!Number.isFinite(wt) || wt <= 0) continue;
        sections.push({
            heading: s.heading.trim(),
            wordTarget: Math.max(100, Math.min(MAX_WORDS_PER_SECTION * 2, Math.round(wt))),
            tasks: Array.isArray(s.tasks) ? s.tasks.map(String).slice(0, 10) : [],
            refFocus: Array.isArray(s.refFocus) ? s.refFocus.map(String).slice(0, 5) : [],
            visualIds: Array.isArray(s.visualIds) ? s.visualIds.map(String).filter(Boolean) : [],
        });
    }
    if (sections.length === 0) return null;

    // Validate visuals array
    const visuals: PlannedVisual[] = [];
    if (Array.isArray(p.visuals)) {
        for (const v of p.visuals) {
            if (!v || typeof v !== "object") continue;
            const id = typeof v.id === "string" ? v.id.trim().replace(/[^a-z0-9_]/g, "_").slice(0, 50) : "";
            const sectionHeading = typeof v.sectionHeading === "string" ? v.sectionHeading.trim() : "";
            const type = VALID_VISUAL_TYPES.has(v.type) ? (v.type as VisualType) : "concept_map";
            const description = typeof v.description === "string" ? v.description.trim() : "";
            const caption = typeof v.caption === "string" ? v.caption.trim() : "";
            const label = typeof v.label === "string" ? v.label.trim() : `fig:${id}`;
            if (!id || !sectionHeading || !description || !caption) continue;
            visuals.push({ id, sectionHeading, type, description, caption, label });
        }
    }

    return {
        title: p.title.trim().slice(0, 200),
        sections,
        totalWordTarget: sections.reduce((a, s) => a + s.wordTarget, 0),
        docType: "research", // filled in by caller
        language: "en",
        visuals,
    };
}

export async function runStage1(
    settings: PipelineSettings,
    filenames: string[],
): Promise<{ plan: Plan; tokensUsed: number }> {
    const systemPrompt = buildSystemPrompt(settings, filenames);
    const userPrompt = [
        `Topic: ${settings.prompt}`,
        settings.taskDescription ? `Task description:\n${settings.taskDescription}` : "",
        settings.taskFileText ? `Attached task file:\n${settings.taskFileText.slice(0, 4000)}` : "",
    ].filter(Boolean).join("\n\n");

    try {
        const r = await withRetry(() => chatCompletion(
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            { jsonMode: true, timeoutMs: 60_000 },
        ), 2, 800);

        const parsed = parseJsonLoose(r.text);
        const plan = validatePlan(parsed);
        if (!plan) throw new Error("Plan validation failed");

        plan.docType = settings.docType;
        plan.language = settings.language;
        plan.sections = splitOversizedSections(plan.sections, settings.language);
        plan.totalWordTarget = plan.sections.reduce((a, s) => a + s.wordTarget, 0);

        return { plan, tokensUsed: r.totalTokens };
    } catch (e) {
        console.warn("[Stage1] Falling back to default outline:", (e as Error).message);
        return { plan: buildFallbackPlan(settings, filenames), tokensUsed: 0 };
    }
}
