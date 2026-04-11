import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AgentSettings, ScholarArticle } from "@/app/agent/types";
import { verifySession } from '@/lib/session';

export async function POST(req: Request) {
    try {
        const { sessionId } = await req.json();
        
        // Auth check
        const userId = await verifySession();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get session
        const { data: session } = await supabase.from('agent_sessions').select('*').eq('id', sessionId).single();
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

        const prompt = session.stream_text || ""; // Stored the prompt here temporarily
        const settings = (typeof session.settings_json === 'string' ? JSON.parse(session.settings_json) : session.settings_json) as AgentSettings;

        // Ultra-fast AI Auto-translation
        const translationPrompt = `You are an academic translation bridge. The user is searching for scientific papers.
If the following query is in English, reply EXACTLY with the query. 
If it is in ANY other language, translate it faithfully to English keywords. 
DO NOT respond with anything else (no quotes, no intro).
Query: ${prompt}`;

        let translatedPrompt = prompt.trim();
        try {
            const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
                body: JSON.stringify({
                    model: "gpt-5-mini-2025-08-07",
                    messages: [{ role: "user", content: translationPrompt }],
                    temperature: 0
                })
            });
            if (openAiRes.ok) {
                const completion = await openAiRes.json();
                translatedPrompt = completion.choices?.[0]?.message?.content?.trim() || prompt.trim();
            }
        } catch (e) {
            console.error("Translation error", e);
        }

        // Directly construct arXiv query (Ultra-fast, deterministic)
        const keywords = translatedPrompt ? `all:${translatedPrompt}` : "all:science";
        let arxivQuery = keywords;

        const maxResults = settings.scholarMaxArticles || 10;
        const usingOpenAlex = settings.scholarSource === 'openalex';

        // 2. Proxy request to high-performance Go microservice (internal Docker network)
        const goPayload = {
            query: translatedPrompt,
            source: usingOpenAlex ? "openalex" : "arxiv",
            maxResults: maxResults,
            yearFrom: settings.scholarYearFrom,
            authors: settings.scholarAuthors
        };

        const apiUrl = process.env.RESEARCH_API_URL || "http://127.0.0.1:8080";
        const response = await fetch(`${apiUrl}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(goPayload),
            next: { revalidate: 3600 } // NEXT.JS CACHE: Cache identical searches for 1 hour locally
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Research API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const articles = data.articles || [];

        // 3. Save back to DB
        await supabase.from('agent_sessions').update({
            status: 'completed',
            visuals_json: JSON.stringify(articles),
        }).eq('id', sessionId);

        return NextResponse.json({ articles, query: translatedPrompt });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
