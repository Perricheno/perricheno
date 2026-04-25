// Thin OpenAI wrapper used across pipeline stages.
// Centralizes: model name, timeout, error surfacing, token accounting,
// image billing (800 tokens per image - matches product pricing), and the
// "continue from where you stopped" fallback when max_tokens is hit.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-5-mini-2025-08-07";
const IMAGE_TOKEN_COST = 800;
const DEFAULT_TIMEOUT_MS = 90_000;

export type ChatContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string | ChatContentPart[];
}

export interface ChatOpts {
    jsonMode?: boolean;           // force JSON object response
    timeoutMs?: number;
}

export interface ChatResult {
    text: string;
    finishReason: "stop" | "length" | "tool_calls" | "content_filter" | null;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export class LlmError extends Error {
    constructor(public status: number, public body: string) {
        super(`OpenAI ${status}: ${body.slice(0, 300)}`);
    }
}

function countImages(messages: ChatMessage[]): number {
    let n = 0;
    for (const m of messages) {
        if (typeof m.content === "string") continue;
        for (const p of m.content) if (p.type === "image_url") n++;
    }
    return n;
}

export async function chatCompletion(messages: ChatMessage[], opts: ChatOpts = {}): Promise<ChatResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new LlmError(500, "OPENAI_API_KEY not set");

    const body: any = {
        model: MODEL,
        messages,
    };
    if (opts.jsonMode) body.response_format = { type: "json_object" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let res: Response;
    try {
        res = await fetch(OPENAI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const errText = await res.text();
        throw new LlmError(res.status, errText);
    }

    const data = await res.json();
    const choice = data?.choices?.[0];
    const text = choice?.message?.content ?? "";
    const usage = data?.usage ?? {};

    // Bill images at a flat 800 tokens each, on top of whatever OpenAI reports.
    // We report this back so the orchestrator can deduct usage correctly.
    const imageCost = countImages(messages) * IMAGE_TOKEN_COST;

    return {
        text,
        finishReason: choice?.finish_reason ?? null,
        promptTokens: (usage.prompt_tokens ?? 0) + imageCost,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: (usage.total_tokens ?? 0) + imageCost,
    };
}

// Robust JSON parsing - models occasionally wrap their reply in ```json fences
// or trailing commentary even with jsonMode. This strips the most common cases.
export function parseJsonLoose<T = any>(raw: string): T {
    let s = raw.trim();
    if (s.startsWith("```json")) s = s.slice(7);
    else if (s.startsWith("```")) s = s.slice(3);
    if (s.endsWith("```")) s = s.replace(/```\s*$/, "");
    s = s.trim();

    // Fallback: find the first { ... last } and try that.
    try {
        return JSON.parse(s);
    } catch {
        const first = s.indexOf("{");
        const last = s.lastIndexOf("}");
        if (first !== -1 && last > first) {
            return JSON.parse(s.slice(first, last + 1));
        }
        throw new Error("Model returned non-JSON output: " + s.slice(0, 200));
    }
}

// Long-form generation with automatic continuation when the model hits its
// output cap. Returns concatenated text plus a flag if we still ran out of
// headroom after two continuation calls.
export async function chatCompletionLong(
    messages: ChatMessage[],
    opts: ChatOpts = {},
): Promise<ChatResult & { truncated: boolean; iterations: number }> {
    const maxIterations = 3; // initial + 2 continues
    let combined = "";
    let lastFinish: ChatResult["finishReason"] = null;
    let promptTokens = 0;
    let completionTokens = 0;
    let iteration = 0;
    const workingMessages = [...messages];

    for (iteration = 0; iteration < maxIterations; iteration++) {
        const r = await chatCompletion(workingMessages, opts);
        combined += r.text;
        lastFinish = r.finishReason;
        promptTokens += r.promptTokens;
        completionTokens += r.completionTokens;

        if (r.finishReason !== "length") break;

        // Hit the cap - ask for a clean continuation. Give the model just enough
        // trailing context to line up seams, not the whole thing (token-efficient).
        const tail = combined.slice(-1500);
        workingMessages.push({ role: "assistant", content: r.text });
        workingMessages.push({
            role: "user",
            content: `You were cut off. Continue SEAMLESSLY from where you stopped. Do NOT repeat previously written text. The tail of what you produced was:\n\n---\n${tail}\n---\n\nContinue.`,
        });
    }

    return {
        text: combined,
        finishReason: lastFinish,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        truncated: lastFinish === "length",
        iterations: iteration + 1,
    };
}
