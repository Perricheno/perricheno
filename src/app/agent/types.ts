export type DocType = "research" | "assignment" | "report" | "lab_report" | "literature_review" | "diploma" | "case_study";
export type Style = "simple" | "medium" | "phd";
export type Language = "en" | "ru";

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
}

export const DEFAULT_SETTINGS: AgentSettings = {
    useTemplate: false,
    style: "medium",
    wordCount: 2000,
    columns: 2,
    useReferences: true,
    language: "en",
    authorName: "",
    courseName: "",
    dateStr: "",
    groupName: "",
    supervisorName: "",
};

export interface RImage {
    image: string; // base64
    chart_type: string;
    r_code: string;
}

export interface AgentSession {
    id: string;
    user_id: number;
    title: string;
    doc_type: DocType;
    settings_json: string | null;
    main_tex: string | null;
    references_bib: string | null;
    r_images_json: string | null;
    share_id: string | null;
    created_at: string;
    updated_at: string;
}
