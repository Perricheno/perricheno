export interface VisualEntry {
    id: string;
    name: string;
    category: string;
    desc: string;
}

export const VISUALS: VisualEntry[] = [
    { id: "mind_map",        name: "Mind Map",          category: "Structure",  desc: "Radial branches from central concept" },
    { id: "concept_map",     name: "Concept Map",       category: "Structure",  desc: "Labeled semantic links between concepts" },
    { id: "hierarchy",       name: "Hierarchy",         category: "Structure",  desc: "Tree: taxonomy or classification" },
    { id: "onion_model",     name: "Onion Model",       category: "Structure",  desc: "Concentric layers from core outward" },
    { id: "wbs",             name: "WBS",               category: "Structure",  desc: "Work breakdown: project → deliverables" },
    { id: "bracket_tree",    name: "Bracket Tree",      category: "Structure",  desc: "Hierarchical bracket / syntax tree" },
    { id: "process_schema",  name: "Process Schema",    category: "Process",    desc: "Sequential methodology phases" },
    { id: "flowchart",       name: "Flowchart",         category: "Process",    desc: "Decision flow with Yes/No branches" },
    { id: "cycle",           name: "Cycle",             category: "Process",    desc: "Circular loop: PDCA, ADDIE, etc." },
    { id: "pipeline_flow",   name: "Pipeline Flow",     category: "Process",    desc: "Processing pipeline with data annotations" },
    { id: "gantt",           name: "Gantt Chart",       category: "Process",    desc: "Task bars on a horizontal time axis" },
    { id: "timeline",        name: "Timeline",          category: "Process",    desc: "Chronological sequence of events" },
    { id: "framework",       name: "Framework",         category: "Conceptual", desc: "Theoretical model: inputs → process → outputs" },
    { id: "relationship",    name: "Relationship",      category: "Conceptual", desc: "Entity/factor connection web" },
    { id: "venn",            name: "Venn Diagram",      category: "Conceptual", desc: "Overlapping sets and intersections" },
    { id: "comparison",      name: "Comparison Table",  category: "Conceptual", desc: "Side-by-side structured comparison" },
    { id: "architecture",    name: "Architecture",      category: "Conceptual", desc: "Layered system or model architecture" },
    { id: "ecosystem_map",   name: "Ecosystem Map",     category: "Conceptual", desc: "Focal entity + surrounding actors" },
    { id: "matrix_2x2",      name: "2×2 Matrix",        category: "Analysis",   desc: "Strategic quadrant map (BCG, priority)" },
    { id: "force_field",     name: "Force Field",       category: "Analysis",   desc: "Lewin: driving vs restraining forces" },
    { id: "fishbone",        name: "Fishbone",          category: "Analysis",   desc: "Ishikawa cause-effect diagram" },
    { id: "causal_loop",     name: "Causal Loop",       category: "Analysis",   desc: "Variables with +/– feedback arcs" },
    { id: "swot",            name: "SWOT",              category: "Analysis",   desc: "Strengths / Weaknesses / Opportunities / Threats" },
    { id: "stakeholder_map", name: "Stakeholder Map",   category: "Analysis",   desc: "Stakeholders by proximity/influence" },
    { id: "value_chain",     name: "Value Chain",       category: "Analysis",   desc: "Porter's primary + support activities" },
    { id: "network",         name: "Network Graph",     category: "Academic",   desc: "Labeled edges between many nodes" },
    { id: "state_machine",   name: "State Machine",     category: "Academic",   desc: "Finite automaton: states + transitions" },
    { id: "sequence_diagram",name: "Sequence Diagram",  category: "Academic",   desc: "UML lifelines + message arrows" },
    { id: "er_diagram",      name: "ER Diagram",        category: "Academic",   desc: "Entity-relationship with cardinality" },
    { id: "systems_map",     name: "Systems Map",       category: "Academic",   desc: "System boundary + internal/external flows" },
];

export const CATEGORIES = ["Structure", "Process", "Conceptual", "Analysis", "Academic"] as const;

export const LANGUAGES = [
    { id: "en", name: "English" },
    { id: "ru", name: "Русский" },
    { id: "de", name: "Deutsch" },
    { id: "fr", name: "Français" },
    { id: "es", name: "Español" },
    { id: "uk", name: "Українська" },
    { id: "kk", name: "Қазақша" },
] as const;
