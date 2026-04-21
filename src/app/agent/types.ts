export type DocType = "research" | "assignment" | "report" | "lab_report" | "literature_review" | "diploma" | "case_study" | "data_analytics" | "data-analytics" | "chat" | "literature_search";
export type Style = "simple" | "medium" | "phd";
export type Language = "en" | "ru";

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string | any[];
    files?: { name: string; type: string; content?: string }[];
    tokens?: number;
    created_at: string;
}

export interface AgentSettings {
    useTemplate: boolean;
    style: Style;
    wordCount: number;
    columns: 1 | 2;
    useReferences: boolean;
    language: Language;
    authorName: string;
    courseName: string;
    dateStr: string;
    groupName: string;
    supervisorName: string;
    // New fields for Context-Aware Generation
    taskDescription: string;
    taskFileText: string;
    referenceLinks: string[];
    /** @deprecated Kept for legacy (pre-pipeline) calls. */
    referenceFilesText: string[];
    /** @deprecated Kept for legacy (pre-pipeline) calls. */
    referenceFileNames: string[];
    /** ids of parsed PDFs in agent_uploads (new staged pipeline). */
    uploadIds: string[];
    /** Per-upload display metadata kept in sync with uploadIds. */
    uploadMeta: {
        id: string;
        filename: string;
        charCount: number;
        imageCount: number;
        pageCount: number;
        ocrUsed: boolean;
    }[];
    runtime: 'R' | 'Python';
    
    // Literature Search specific settings
    scholarMaxArticles: number;
    scholarYearFrom: string;
    scholarAuthors: string;
    scholarSource: 'arxiv' | 'openalex';
}

export const DEFAULT_SETTINGS: AgentSettings = {
    useTemplate: false,
    style: "medium",
    wordCount: 2000,
    columns: 2,
    useReferences: false, // Default to OFF as requested
    language: "en",
    authorName: "",
    courseName: "",
    dateStr: "",
    groupName: "",
    supervisorName: "",
    taskDescription: "",
    taskFileText: "",
    referenceLinks: [],
    referenceFilesText: [],
    referenceFileNames: [],
    uploadIds: [],
    uploadMeta: [],
    runtime: 'R',
    scholarMaxArticles: 10,
    scholarYearFrom: 'Any',
    scholarAuthors: '',
    scholarSource: 'openalex',
};

export interface CodeImage {
    image: string; // base64
    chart_type: string;
    code: string;
    language: 'R' | 'Python';
}

export interface ScholarArticle {
    title: string;
    summary: string;
    authors: string[];
    year: number;
    url: string;
    doi?: string;
}

export interface AgentSession {
    id: string;
    user_id: number;
    title: string;
    doc_type: DocType;
    status: "generating" | "done" | "completed" | "error";
    error_msg: string | null;
    stream_text: string | null;
    settings_json: string | null;
    main_tex: string | null;
    references_bib: string | null;
    visuals_json: string | null; // Renamed from r_images_json
    share_id: string | null;
    created_at: string;
    updated_at: string;
}
