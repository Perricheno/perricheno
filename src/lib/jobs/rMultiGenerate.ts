// Job processor for R Studio's multi-chart generation (r-multi-generate).
// Extracted from src/app/api/r/generate/route.ts (Phase 6a) - runMultiGeneration
// itself is unchanged, only its call site moved from an unawaited fire-and-forget
// promise to a queued BullMQ job.
//
// NOTE on job payload size: unlike report/analytics generation (which re-fetch
// uploads from the DB by id inside the job), this flow's context files/images
// come straight from the original POST body and are not persisted anywhere -
// they travel through the job payload (Redis) as-is. Fine at today's scale
// (tabular data, not huge image sets); if this becomes a real memory concern,
// persist the context to an AgentUpload-style row first and pass only ids.

import { checkAndDeductUsage } from "@/lib/db";
import { getRSession, updateRSession } from "@/lib/r-db";
import type { RResultItem } from "@/lib/r-db";
import { buildGeneratePrompt, callOpenAI, cleanCode, rLog, wrapRCode, R_COMPILER_URL } from "@/lib/r-generation";

export interface RMultiGenerateJobData {
    sessionId: string;
    userId: number;
    prompt: string;
    chartsToGenerate: string[];
    combinedContext: string;
    rFileNames: string[];
    rFiles: { name: string; content_b64: string }[];
    contextImages: string[];
    knowledge: string;
    apiKey: string;
}

export async function runRMultiGenerate(params: RMultiGenerateJobData): Promise<void> {
    const {
        sessionId, userId, prompt, chartsToGenerate,
        combinedContext, rFileNames, rFiles, contextImages, knowledge, apiKey,
    } = params;

    const existing = await getRSession(sessionId, userId);
    if (!existing || existing.status !== 'generating') {
        console.log(`[r-multi-generate] session ${sessionId} already left 'generating' (${existing?.status}) - skipping duplicate delivery`);
        return;
    }

    console.log(`${new Date().toISOString()} [R][${sessionId.slice(0, 8)}] Starting session - ${chartsToGenerate.length} charts: ${chartsToGenerate.join(", ")}`);
    if (rFileNames.length > 0) {
        console.log(`${new Date().toISOString()} [R][${sessionId.slice(0, 8)}] Files: ${rFileNames.join(", ")}`);
    }

    const systemPrompt = `You are an expert R programmer. Output ONLY raw executable R code. No markdown fences. No commentary.`;

    // Initialize all charts as pending immediately - client sees full list on first poll
    const results: RResultItem[] = chartsToGenerate.map(id => ({
        chartType: id,
        name: id.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        image: "", code: "", status: "pending",
    }));
    await updateRSession(sessionId, { results_json: JSON.stringify(results) });

    let successCount = 0;

    for (let i = 0; i < chartsToGenerate.length; i++) {
        const chartId = chartsToGenerate[i];
        const chartName = results[i].name;
        const chartStart = Date.now();

        rLog(sessionId, chartId, `[${i + 1}/${chartsToGenerate.length}] Starting`);

        // Mark as generating so client shows spinner for this chart
        results[i] = { ...results[i], status: "generating" };
        await updateRSession(sessionId, { results_json: JSON.stringify(results) });

        let finalResult: RResultItem | null = null;
        let lastCode = "";
        let lastError = "";

        // Attempt generation + 1 auto-retry on failure with error feedback
        for (let attempt = 0; attempt <= 1 && !finalResult; attempt++) {
            if (attempt > 0) {
                rLog(sessionId, chartId, `Retry attempt ${attempt} - previous error: ${lastError.slice(0, 200)}`);
            }

            try {
                const userPrompt = buildGeneratePrompt(prompt, chartId, combinedContext, knowledge, rFileNames);
                const baseContent: any = contextImages.length > 0
                    ? [
                        { type: "text", text: userPrompt },
                        ...contextImages.map(img => ({ type: "image_url", image_url: { url: img, detail: "low" } })),
                      ]
                    : userPrompt;

                const messages: any[] = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: baseContent },
                ];

                // On retry: feed previous error back to LLM so it can self-correct
                if (attempt > 0 && lastCode && lastError) {
                    messages.push(
                        { role: "assistant", content: lastCode },
                        { role: "user", content: `That code produced this R error:\n\n${lastError}\n\nFix ALL errors. Output ONLY pure R code.` },
                    );
                }

                rLog(sessionId, chartId, `Calling AI (attempt ${attempt + 1})`);
                const aiStart = Date.now();

                const aiResult = await callOpenAI(apiKey, { model: "gpt-5.6-terra", messages });

                if (!aiResult.ok) {
                    lastError = aiResult.error;
                    rLog(sessionId, chartId, `AI failed`, { error: lastError });
                    continue;
                }

                const aiData = aiResult.data;
                const tokens = aiData.usage?.total_tokens ?? 0;
                const aiMs = Date.now() - aiStart;
                rLog(sessionId, chartId, `AI ok`, { ms: aiMs, tokens, finish: aiData.choices?.[0]?.finish_reason });

                const code = cleanCode(aiData.choices?.[0]?.message?.content ?? "");
                if (!code) {
                    lastError = "AI returned empty code.";
                    rLog(sessionId, chartId, `Empty code from AI`);
                    continue;
                }
                lastCode = code;
                rLog(sessionId, chartId, `Code: ${code.split("\n").length} lines`);

                rLog(sessionId, chartId, `Compiling`);
                const compileStart = Date.now();

                const compileRes = await fetch(`${R_COMPILER_URL}/compile`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: wrapRCode(code), files: rFiles }),
                    signal: AbortSignal.timeout(45_000),
                });

                if (!compileRes.ok) {
                    lastError = `Compiler HTTP ${compileRes.status}`;
                    rLog(sessionId, chartId, `Compiler HTTP error`, { status: compileRes.status });
                    continue;
                }

                const result = await compileRes.json();
                const compileMs = Date.now() - compileStart;

                if (!result.success) {
                    lastError = result.log || "R execution failed.";
                    rLog(sessionId, chartId, `R execution failed`, { ms: compileMs, log: lastError.slice(0, 500) });
                    continue;
                }

                rLog(sessionId, chartId, `Compiled ok`, { ms: compileMs });

                if (tokens > 0) await checkAndDeductUsage(userId, "visuals", tokens);

                finalResult = { chartType: chartId, name: chartName, image: result.image, code, status: "done" };
                successCount++;
                rLog(sessionId, chartId, `Done in ${Date.now() - chartStart}ms`);

            } catch (err: any) {
                lastError = err?.message || "Unknown error";
                rLog(sessionId, chartId, `Exception (attempt ${attempt + 1})`, { error: lastError });
            }
        }

        if (!finalResult) {
            rLog(sessionId, chartId, `All attempts failed - final error: ${lastError.slice(0, 300)}`);
        }

        results[i] = finalResult ?? {
            chartType: chartId, name: chartName, image: "", code: lastCode,
            status: "error", error: lastError,
        };
        await updateRSession(sessionId, { results_json: JSON.stringify(results) });
    }

    await updateRSession(sessionId, { status: "done" });
    console.log(`${new Date().toISOString()} [R][${sessionId.slice(0, 8)}] Session complete - ${successCount}/${chartsToGenerate.length} succeeded`);
}
