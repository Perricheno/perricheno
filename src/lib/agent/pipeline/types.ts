// Shared types for the staged generate pipeline.

export type DocType =
    | "research" | "assignment" | "report" | "lab_report"
    | "literature_review" | "diploma" | "case_study";

export interface PipelineSettings {
    prompt: string;
    docType: DocType;
    style: "simple" | "medium" | "phd";
    wordCount: number;
    columns: 1 | 2;
    useTemplate: boolean;
    useReferences: boolean;
    language: string;
    authorName?: string;
    courseName?: string;
    dateStr?: string;
    groupName?: string;
    supervisorName?: string;
    taskDescription?: string;
    taskFileText?: string;       // pasted assignment text (not a PDF)
    referenceLinks?: string[];   // URLs only; content isn't fetched
    uploadIds?: string[];        // ids in agent_uploads (the new PDF bundles)
    /** Preset template id ("plain" | "academic" | "ieee" | "elegant" | "minimal"). */
    templateId?: string;
    /** Full LaTeX preamble extracted from a user-uploaded Overleaf ZIP. Overrides templateId. */
    customTemplatePreamble?: string;
    /** How many structural visuals to generate. 0 = disabled, 2–10 = user choice. */
    visualCount?: number;
    /** IDs of CSV/XLSX/JSON data files for R/Python statistical figures. */
    dataUploadIds?: string[];
    /** Runtime for data figures. Default "R". */
    dataRuntime?: "R" | "Python";
}

export interface PlanSection {
    heading: string;
    wordTarget: number;
    tasks: string[];          // bullet points the drafter must cover
    refFocus?: string[];      // filenames of uploads most relevant here (advisory)
    visualIds?: string[];     // ids of visuals planned for this section
}

export type VisualType =
    | "mind_map"          // radial layout: central concept + thematic branches
    | "concept_map"       // nodes connected by labeled semantic edges
    | "hierarchy"         // tree: taxonomy, classification, organizational structure
    | "framework"         // theoretical/research framework - boxes in logical arrangement
    | "process_schema"    // sequential or parallel research/methodology phases with arrows
    | "relationship"      // entity/factor relationship web - who connects to whom and how
    | "comparison"        // structured side-by-side comparison of approaches/theories
    | "timeline"          // chronological sequence of events along a horizontal/vertical axis
    | "flowchart"         // decision flow with diamond decision nodes and branching paths
    | "network"           // graph with weighted/labeled edges between many nodes (sources, sinks)
    | "venn"              // overlapping circles showing set intersections and shared concepts
    | "architecture";     // layered system or model architecture (components, modules, pipelines)

export interface PlannedVisual {
    id: string;              // slug, e.g. "fig_pipeline_arch"
    sectionHeading: string;  // which section this belongs to
    type: VisualType;
    description: string;     // what the visual should depict (for LLM prompt)
    caption: string;         // LaTeX \caption{} text
    label: string;           // LaTeX \label{} key, e.g. "fig:pipeline_arch"
}

export interface GeneratedVisual {
    id: string;
    sectionHeading: string;
    filename: string;        // e.g. "fig_pipeline_arch.png" — used as matching key
    caption: string;
    label: string;
    tikzCode: string;        // raw TikZ snippet: \usetikzlibrary{} + \begin{tikzpicture}...\end{tikzpicture}
    type: VisualType;
    failed?: boolean;
    error?: string;
}

export interface Plan {
    title: string;
    sections: PlanSection[];
    totalWordTarget: number;
    docType: DocType;
    language: string;
    visuals: PlannedVisual[];
}

export interface ExtractedRef {
    uploadId: string;
    filename: string;
    status: "ok" | "failed" | "skipped";
    error?: string;
    bibKey?: string;
    metadata?: {
        title?: string;
        authors?: string[];
        year?: number;
        venue?: string;
        doi?: string;
    };
    keyClaims?: string[];
    relevantQuotes?: string[];
    relevanceScore?: number;    // 0-10
    bibEntry?: string;          // full BibTeX block
    /** Token cost of this extraction, used for billing. */
    tokensUsed?: number;
}

export interface SectionDraft {
    heading: string;
    body: string;               // LaTeX body, without \section wrapper
    wordCount: number;
    truncated: boolean;         // true if max_tokens was hit even after continuation
    tokensUsed?: number;
}

export interface GeneratedDataFigure {
    id: string;
    sectionHeading: string;    // which section to embed in
    filename: string;          // e.g. "fig_regression_salary.png"
    caption: string;
    label: string;
    pngBase64: string;
    analysisType: string;      // "scatter", "regression", etc.
    runtime: "R" | "Python";
    code: string;              // the generated code (for transparency)
    failed?: boolean;
    error?: string;
}

export interface AssembledDoc {
    mainTex: string;
    referencesBib: string | null;
    warnings: string[];
    unresolvedCitations: string[];
    visuals?: GeneratedVisual[];
    dataFigures?: GeneratedDataFigure[];
}



export interface VerificationResult {
    uploadId: string;
    filename: string;
    verified: boolean;
    testQuestions: { question: string; answer: string; confidence: number }[];
    contentSummary: string;
    keyTopics: string[];
    warnings: string[];
    tokensUsed?: number;
}

export interface PipelineResult {
    plan: Plan;
    refs: ExtractedRef[];
    verifications: VerificationResult[];  // NEW
    sections: SectionDraft[];
    assembled: AssembledDoc;
    validated: {
        compiled: boolean;
        repairAttempts: number;
        errorLog?: string;
        finalMainTex: string;
        finalReferencesBib: string | null;
    };
    totalTokens: number;        // for billing
}
