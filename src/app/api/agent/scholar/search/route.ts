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

        if (settings.scholarAuthors && settings.scholarAuthors !== "None") {
            arxivQuery = `(${keywords}) AND au:${settings.scholarAuthors}`;
        }

        // 2. Build arXiv API URL
        const maxResults = settings.scholarMaxArticles || 10;
        const encodedQuery = encodeURIComponent(arxivQuery);
        // Sort by submittedDate descending (freshest first)
        const arxivUrl = `http://export.arxiv.org/api/query?search_query=${encodedQuery}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

        // 3. Fetch from arXiv with caching and User-Agent to mitigate 503 errors and limits
        let fetchOptions: RequestInit = {
            headers: { "User-Agent": "Perricheno-AI-Agent/1.0 (support@perricheno.com)" },
            next: { revalidate: 3600 } // NEXT.JS CACHE: Cache identical searches for 1 hour to handle 500-1000 users!
        };

        let response = await fetch(arxivUrl, fetchOptions);

        // Simple 1-second retry if 503 Service Unavailable
        if (response.status === 503) {
            console.log("arXiv 503 Service Unavailable. Retrying once after 1 second...");
            await new Promise(r => setTimeout(r, 1000));
            fetchOptions = {
                headers: { "User-Agent": "Perricheno-AI-Agent/1.0 (support@perricheno.com)" },
                cache: 'no-store' // bypass cache on retry just in case
            };
            response = await fetch(arxivUrl, fetchOptions);
        }

        if (!response.ok) {
            throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
        }
        const xmlText = await response.text();

        // 4. Custom Bulletproof XML Parser (zero external dependencies)
        let articles: ScholarArticle[] = [];
        const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
        let entryMatch;

        while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
            const entryXml = entryMatch[1];

            // Robust regex to capture tags even if they have attributes like <title type="html">
            const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(entryXml);
            const summaryMatch = /<summary[^>]*>([\s\S]*?)<\/summary>/i.exec(entryXml);
            const publishedMatch = /<published[^>]*>([\s\S]*?)<\/published>/i.exec(entryXml);
            const idMatch = /<id[^>]*>([\s\S]*?)<\/id>/i.exec(entryXml);
            const doiMatch = /<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/i.exec(entryXml);

            // Clean up text: replace CDATA sections, remove HTML tags, compress newlines
            const cleanHtml = (str: string) => str
                .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') // Extract CDATA contents
                .replace(/<[^>]+>/g, '') // Strip remaining HTML tags
                .replace(/\s+/g, ' ') // Clean up newlines & multi-spaces
                .trim();

            const title = titleMatch ? cleanHtml(titleMatch[1]) : "Untitled";
            const summary = summaryMatch ? cleanHtml(summaryMatch[1]) : "No abstract available.";
            const publishedDate = publishedMatch ? publishedMatch[1].trim() : "";
            const year = publishedDate ? new Date(publishedDate).getFullYear() : 0;
            const url = idMatch ? idMatch[1].trim() : "";
            const doi = doiMatch ? doiMatch[1].trim() : undefined;

            // Filter by year if necessary
            if (settings.scholarYearFrom && settings.scholarYearFrom !== "Any") {
                if (year < parseInt(settings.scholarYearFrom)) {
                    continue;
                }
            }

            // Extract all authors smoothly
            const authorRegex = /<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi;
            let authorsList: string[] = [];
            let authorMatch;
            while ((authorMatch = authorRegex.exec(entryXml)) !== null) {
                if (authorMatch[1]) authorsList.push(cleanHtml(authorMatch[1]));
            }
            if (authorsList.length === 0) authorsList.push("Unknown");

            articles.push({
                title,
                summary,
                authors: authorsList,
                year,
                url,
                doi
            });
        }

        // 5. Save back to DB
        await supabase.from('agent_sessions').update({
            status: 'completed',
            visuals_json: JSON.stringify(articles),
        }).eq('id', sessionId);

        return NextResponse.json({ articles, query: arxivQuery });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
