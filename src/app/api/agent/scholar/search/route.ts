import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AgentSettings, ScholarArticle } from "@/app/agent/types";
import { verifySession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// ── Language detection ──
// Simple heuristic: if the query contains characters from a non-Latin script,
// treat it as foreign and translate to English. Academic indexes are English-first.
function detectSourceLang(text: string): string | null {
    if (!text) return null;
    if (/[\u0400-\u04FF]/.test(text)) return "ru";          // Cyrillic
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh-CN";       // Chinese
    if (/[\u3040-\u30FF]/.test(text)) return "ja";          // Japanese kana
    if (/[\uAC00-\uD7AF]/.test(text)) return "ko";          // Korean
    if (/[\u0600-\u06FF]/.test(text)) return "ar";          // Arabic
    if (/[\u0590-\u05FF]/.test(text)) return "he";          // Hebrew
    // Latin but with diacritics — MyMemory can still auto-detect; let it through as English-ish.
    return null;
}

// ── MyMemory free translation API ──
// Docs: https://mymemory.translated.net/doc/spec.php
// Anonymous quota ~5000 words/day; ~50000 with a `de` email. Zero keys, zero installs.
async function translateToEnglish(text: string, sourceLang: string): Promise<string> {
    const params = new URLSearchParams({
        q: text,
        langpair: `${sourceLang}|en`,
        de: "admin@perricheno.com",
    });
    const url = `https://api.mymemory.translated.net/get?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
        const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Perricheno-Scholar/1.0" } });
        clearTimeout(timer);
        if (!res.ok) return text;
        const data = await res.json();
        const translated = data?.responseData?.translatedText;
        if (typeof translated !== "string" || !translated.trim()) return text;
        // MyMemory sometimes returns "PLEASE SELECT TWO DISTINCT LANGUAGES" etc. Guard.
        if (/PLEASE SELECT|MYMEMORY WARNING|INVALID/i.test(translated)) return text;
        return translated.trim();
    } catch {
        clearTimeout(timer);
        return text;
    }
}

export async function POST(req: Request) {
    try {
        const { sessionId } = await req.json();

        const userId = await verifySession();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: session } = await supabase.from('agent_sessions').select('*').eq('id', sessionId).single();
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

        const rawPrompt: string = (session.stream_text || "").trim();
        if (!rawPrompt) return NextResponse.json({ error: "Empty query" }, { status: 400 });

        const settings = (typeof session.settings_json === 'string' ? JSON.parse(session.settings_json) : session.settings_json) as AgentSettings;

        // 1) Translate only if the query is not in a Latin script.
        const srcLang = detectSourceLang(rawPrompt);
        const queryForIndex = srcLang ? await translateToEnglish(rawPrompt, srcLang) : rawPrompt;

        // 2) Proxy to Go microservice. It already wraps the query for each source,
        //    so we pass the clean translated keywords.
        const goPayload = {
            query: queryForIndex,
            source: settings.scholarSource === 'openalex' ? "openalex" : "arxiv",
            maxResults: settings.scholarMaxArticles || 10,
            yearFrom: settings.scholarYearFrom,
            authors: settings.scholarAuthors,
        };

        const apiUrl = process.env.RESEARCH_API_URL || "http://127.0.0.1:8080";
        const response = await fetch(`${apiUrl}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(goPayload),
            cache: "no-store",
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Research API error: ${response.status} - ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        const articles: ScholarArticle[] = data.articles || [];

        await supabase.from('agent_sessions').update({
            status: 'completed',
            visuals_json: JSON.stringify(articles),
        }).eq('id', sessionId);

        return NextResponse.json({ articles, query: queryForIndex, originalQuery: rawPrompt });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
