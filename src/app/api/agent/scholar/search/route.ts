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

        const gptQueryPrompt = `You are an expert academic librarian. Your task is to convert the user's natural language request into a strictly formatted 'search_query' string for the arXiv API. 
CRITICAL LANGUAGE RULE: arXiv primarily indexes papers in English. You MUST translate the user's query into English keywords UNLESS the user explicitly specifies a different language or clearly intends to find regional papers. If they just type in another language casually, translate their core technical intent to English for the best results.
Do NOT use double quotes. Use valid arXiv prefixes: ti (title), abs (abstract), au (author).
Use logical operators AND, OR, ANDNOT. 
If the user's prompt is very vague or broad, extract the main keywords and use "abs:" or "all:".
Only return the RAW query string. No markdown, no explanations.

User Prompt: ${prompt}
Optional Filters applied in settings: 
- Authors: ${settings.scholarAuthors ? settings.scholarAuthors : "None"}

Generate the arXiv search_query:`;

        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-5-mini-2025-08-07",
                messages: [{ role: "user", content: gptQueryPrompt }]
            })
        });

        const completion = await openAiRes.json();
        
        if (completion.error) {
            console.error("OpenAI Error:", completion.error);
        }

        const arxivQuery = completion.choices?.[0]?.message?.content?.trim() || `all:${prompt}`;

        // 2. Build arXiv API URL
        const maxResults = settings.scholarMaxArticles || 10;
        const encodedQuery = encodeURIComponent(arxivQuery);
        // Sort by submittedDate descending (freshest first)
        const arxivUrl = `http://export.arxiv.org/api/query?search_query=${encodedQuery}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

        // 3. Fetch from arXiv
        const response = await fetch(arxivUrl);
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
