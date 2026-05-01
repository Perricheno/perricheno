import fs from "fs";
import path from "path";

const R_SKILL_PATH = path.join(process.cwd(), "r", "r-skill.md");

/**
 * Загружает базу знаний для визуализаций (R/Python)
 */
export function getVisualKnowledge(): string {
    try {
        const knowledgePath = path.join(process.cwd(), 'src', 'lib', 'agent', 'knowledge', 'visuals');
        const rPath = path.join(knowledgePath, 'r');
        const pyPath = path.join(knowledgePath, 'python');
        const libFile = path.join(knowledgePath, 'libraries.md');
        
        const examples: string[] = [];
        
        if (fs.existsSync(libFile)) {
            examples.push(`=== PRE-INSTALLED LIBRARIES (MANDATORY) ===\n${fs.readFileSync(libFile, 'utf-8')}`);
        }
        
        if (fs.existsSync(rPath)) {
            const rFiles = fs.readdirSync(rPath).filter(f => f.endsWith('.md'));
            for (const f of rFiles) {
                examples.push(`--- R Code Standard: ${f} ---\n${fs.readFileSync(path.join(rPath, f), 'utf-8')}`);
            }
        }
        
        if (fs.existsSync(pyPath)) {
            const pyFiles = fs.readdirSync(pyPath).filter(f => f.endsWith('.md'));
            for (const f of pyFiles) {
                examples.push(`--- Python Code Standard: ${f} ---\n${fs.readFileSync(path.join(pyPath, f), 'utf-8')}`);
            }
        }
        
        // Load R skill guide from /r/r-skill.md
        if (fs.existsSync(R_SKILL_PATH)) {
            examples.push(`--- R Agent Skill Guide ---\n${fs.readFileSync(R_SKILL_PATH, 'utf-8')}`);
        }

        if (examples.length > 0) {
            return `\n\n=== VISUALIZATION KNOWLEDGE BASE (CODING STANDARDS) ===\nUse this reference for libraries and code quality standards:\n\n${examples.join('\n\n')}\n`;
        }
    } catch (e) {
        console.error("Failed to load visual knowledge:", e);
    }
    return "";
}

/**
 * Загружает правила верстки LaTeX и языковые стандарты
 */
export function getLatexKnowledge(): string {
    try {
        const latexPath = path.join(process.cwd(), 'src', 'lib', 'agent', 'knowledge', 'latex');
        if (!fs.existsSync(latexPath)) return "";
        
        const files = fs.readdirSync(latexPath).filter(f => f.endsWith('.md'));
        const content = files.map(f => fs.readFileSync(path.join(latexPath, f), 'utf-8'));
        
        if (content.length > 0) {
            return `\n\n=== LATEX WRITING & LANGUAGE RULES ===\nMandatory rules for typesetting and languages (KAZ/RUS/ENG):\n\n${content.join('\n\n')}\n`;
        }
    } catch (e) {
        console.error("Failed to load latex knowledge:", e);
    }
    return "";
}
