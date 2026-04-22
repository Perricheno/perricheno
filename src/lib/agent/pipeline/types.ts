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
}

export interface PlanSection {
    heading: string;
    wordTarget: number;
    tasks: string[];          // bullet points the drafter must cover
    refFocus?: string[];      // filenames of uploads most relevant here (advisory)
}

export interface Plan {
    title: string;
    sections: PlanSection[];
    totalWordTarget: number;
    docType: DocType;
    language: string;
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

export interface AssembledDoc {
    mainTex: string;
    referencesBib: string | null;
    warnings: string[];
    unresolvedCitations: string[];
}

export interface PipelineResult {
    plan: Plan;
    refs: ExtractedRef[];
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
