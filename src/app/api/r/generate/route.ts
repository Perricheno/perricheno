// R Studio - generate + compile R visualization.
// Multi mode: queued background job (src/lib/jobs/rMultiGenerate.ts, Phase 6a),
// client polls session via GET /api/r/sessions/[id]. Survives a web-container
// restart, not just a client disconnect.
// Single mode: synchronous, returns result directly.

import { NextResponse } from "next/server";
import { verifySession } from "@/lib/session";
import { checkAndDeductUsage, getUserById } from "@/lib/db";
import { getVisualKnowledge } from "@/lib/agent/knowledge/loader";
import { createRSession, updateRSession } from "@/lib/r-db";
import type { RResultItem } from "@/lib/r-db";
import { getQueue } from "@/lib/queue";
import {
    MODEL, R_COMPILER_URL, wrapRCode, cleanCode,
    buildGeneratePrompt, buildSuggestPrompt, callOpenAI, makeTitle,
} from "@/lib/r-generation";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    const userId = await verifySession();
    if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const precheck = await checkAndDeductUsage(userId, "visuals", 0);
    if (precheck.remaining <= 0) {
        return NextResponse.json({ error: "LIMIT_REACHED", details: "Visual limit reached." }, { status: 402 });
    }

    if (!OPENAI_API_KEY) return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const {
        action = "generate",
        prompt,
        chartType = "",
        chartTypes,
        contextFiles = [],
        previousCode,
        previousError,
    } = body;

    type ContextFile = { name: string; content: string; rFileName?: string; fileData?: string; images?: string[] };
    const files = contextFiles as ContextFile[];

    // Schema snippets for prompt context (column names + 3-row sample)
    const combinedContext = files
        .map(f => f.content.slice(0, 2_000))
        .join("\n\n");

    // Files to pass directly into R working directory
    const rFiles = files
        .filter(f => f.fileData)
        .map(f => ({ name: f.rFileName || f.name, content_b64: f.fileData as string }));

    const rFileNames = rFiles.map(f => f.name);

    const contextImages: string[] = files
        .flatMap(f => f.images ?? [])
        .slice(0, 10);

    // ── SUGGEST mode ──────────────────────────────────────────────────────────
    if (action === "suggest") {
        if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

        const aiResult = await callOpenAI(OPENAI_API_KEY, {
            model: MODEL,
            messages: [
                { role: "system", content: "You are a data visualization expert. Output only valid JSON." },
                { role: "user", content: buildSuggestPrompt(prompt, combinedContext) },
            ],
        }, 30_000);

        if (!aiResult.ok) return NextResponse.json({ error: "Suggestion failed." }, { status: 500 });

        const data = aiResult.data;
        let raw = data.choices?.[0]?.message?.content ?? "{}";
        raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

        try {
            const parsed = JSON.parse(raw);
            return NextResponse.json({
                charts: parsed.charts ?? ["bar", "histogram", "scatter"],
                reasoning: parsed.reasoning ?? "",
            });
        } catch {
            return NextResponse.json({ charts: ["bar", "histogram", "heatmap"], reasoning: "" });
        }
    }

    // ── MULTI mode - queued background job ────────────────────────────────────
    if (action === "multi") {
        if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

        const user = await getUserById(userId);
        const planTier = (user?.plan_tier ?? "free") as string;
        const planLimits: Record<string, number> = { free: 1, plus: 3, pro: 10, ultra: 15 };
        const maxCharts = planLimits[planTier] ?? 1;

        // Determine chart list
        let chartsToGenerate: string[];
        if (Array.isArray(chartTypes) && chartTypes.length > 0) {
            chartsToGenerate = chartTypes.slice(0, maxCharts);
        } else {
            const suggestResult = await callOpenAI(OPENAI_API_KEY, {
                model: MODEL,
                messages: [
                    { role: "system", content: "You are a data visualization expert. Output only valid JSON." },
                    { role: "user", content: buildSuggestPrompt(prompt, combinedContext, maxCharts) },
                ],
            }, 30_000);

            let suggestedCharts: string[] = ["bar", "histogram", "scatter"];
            if (suggestResult.ok) {
                let raw = suggestResult.data.choices?.[0]?.message?.content ?? "{}";
                raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
                try { suggestedCharts = JSON.parse(raw).charts ?? suggestedCharts; } catch { /* use defaults */ }
            }
            chartsToGenerate = suggestedCharts.slice(0, maxCharts);
        }

        // Create session - visible in sidebar immediately
        const session = await createRSession({ userId, title: makeTitle(prompt), prompt });

        // Enqueue background job - does NOT block the response
        await getQueue().add('r-multi-generate', {
            sessionId: session.id,
            userId,
            prompt,
            chartsToGenerate,
            combinedContext,
            rFileNames,
            rFiles,
            contextImages,
            knowledge: getVisualKnowledge(),
            apiKey: OPENAI_API_KEY,
        });

        // Return immediately - client will poll
        return NextResponse.json({
            sessionId: session.id,
            chartsPlanned: chartsToGenerate,
        });
    }

    // ── GENERATE mode (single chart) - synchronous ────────────────────────────
    if (!prompt?.trim()) return NextResponse.json({ error: "Prompt is required." }, { status: 400 });

    const knowledge = getVisualKnowledge();
    const systemPrompt = `You are an expert R programmer. Output ONLY raw executable R code. No markdown fences. No commentary.`;
    const userPrompt = buildGeneratePrompt(prompt, chartType, combinedContext, knowledge, rFileNames);

    const userContent: any = contextImages.length > 0
        ? [
            { type: "text", text: userPrompt },
            ...contextImages.map(img => ({ type: "image_url", image_url: { url: img, detail: "low" } })),
          ]
        : userPrompt;

    const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
    ];

    if (previousError && previousCode) {
        messages.push(
            { role: "assistant", content: previousCode },
            { role: "user", content: `That code produced this R error:\n\n${previousError}\n\nFix ALL errors. Output ONLY pure R code.` },
        );
    }

    const session = await createRSession({ userId, title: makeTitle(prompt), prompt });
    const sid = session.id.slice(0, 8);
    console.log(`${new Date().toISOString()} [R][${sid}] Single chart: ${chartType || "auto"}`);

    const aiStart = Date.now();
    const aiResult = await callOpenAI(OPENAI_API_KEY, { model: MODEL, messages });

    if (!aiResult.ok) {
        console.error(`${new Date().toISOString()} [R][${sid}] AI failed: ${aiResult.error}`);
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: aiResult.error }, { status: 500 });
    }

    const aiData = aiResult.data;
    const tokens = aiData.usage?.total_tokens ?? 0;
    console.log(`${new Date().toISOString()} [R][${sid}] AI ok - ${Date.now() - aiStart}ms, tokens=${tokens}`);

    const code = cleanCode(aiData.choices?.[0]?.message?.content ?? "");
    if (!code) {
        console.error(`${new Date().toISOString()} [R][${sid}] Empty code from AI`);
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: "AI returned empty code." }, { status: 500 });
    }

    console.log(`${new Date().toISOString()} [R][${sid}] Code: ${code.split("\n").length} lines - compiling`);
    const compileStart = Date.now();

    const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: wrapRCode(code), files: rFiles }),
        signal: AbortSignal.timeout(45_000),
    });

    if (!compileRes.ok) {
        console.error(`${new Date().toISOString()} [R][${sid}] Compiler HTTP ${compileRes.status}`);
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: "R compiler error.", code }, { status: 500 });
    }

    const result = await compileRes.json();
    if (!result.success) {
        console.error(`${new Date().toISOString()} [R][${sid}] R execution failed (${Date.now() - compileStart}ms): ${(result.log || "").slice(0, 500)}`);
        await updateRSession(session.id, { status: "error" });
        return NextResponse.json({ error: result.log || "R execution failed.", code }, { status: 422 });
    }

    console.log(`${new Date().toISOString()} [R][${sid}] Compiled ok - ${Date.now() - compileStart}ms`);

    if (tokens > 0) await checkAndDeductUsage(userId, "visuals", tokens);

    const chartName = (chartType || "chart").replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
    const resultItem: RResultItem = { chartType: chartType || "chart", name: chartName, image: result.image, code, status: "done" };
    await updateRSession(session.id, { results_json: JSON.stringify([resultItem]), status: "done" });
    console.log(`${new Date().toISOString()} [R][${sid}] Session complete`);

    return NextResponse.json({ image: result.image, code, chartType, sessionId: session.id });
}
