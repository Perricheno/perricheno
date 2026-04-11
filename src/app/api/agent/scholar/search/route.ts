import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabase } from "@/lib/supabaseClient";
import OpenAI from "openai";
import { parseStringPromise } from "xml2js";
import { AgentSettings, ScholarArticle } from "@/app/agent/types";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const { sessionId } = await req.json();
        
        // Auth check
        const headersList = await headers();
        const authHeader = headersList.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return NextResponse.json({ error: "Missing token" }, { status: 401 });
        const token = authHeader.split(" ")[1];

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get session
        const { data: session } = await supabase.from('agent_sessions').select('*').eq('id', sessionId).single();
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

        const prompt = session.stream_text || ""; // Stored the prompt here temporarily
        const settings = (typeof session.settings_json === 'string' ? JSON.parse(session.settings_json) : session.settings_json) as AgentSettings;

        // 1. Ask GPT to build the arXiv query 
        const gptQueryPrompt = `You are an expert academic librarian. Your task is to convert the user's natural language request into a strictly formatted 'search_query' string for the arXiv API.
Do NOT use double quotes. Use valid arXiv prefixes: ti (title), abs (abstract), au (author).
Use logical operators AND, OR, ANDNOT. 
If the user's prompt is very vague, extract the main keywords and use "abs:" or "all:".
Only return the RAW query string. No markdown, no explanations, no wrapping quotes.

User Prompt: ${prompt}
Optional Filters applied in settings: 
- Authors: ${settings.scholarAuthors ? settings.scholarAuthors : "None"}

Generate the arXiv search_query:`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.2,
            messages: [{ role: "user", content: gptQueryPrompt }],
        });

        const arxivQuery = completion.choices[0].message.content?.trim() || `all:${prompt}`;

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

        // 4. Parse XML with xml2js
        const result = await parseStringPromise(xmlText);
        
        let articles: ScholarArticle[] = [];

        if (result.feed && result.feed.entry) {
            const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
            
            for (const entry of entries) {
                const title = (entry.title?.[0] || "Untitled").replace(/\n/g, ' ').trim();
                const summary = (entry.summary?.[0] || "No abstract available.").replace(/\n/g, ' ').trim();
                const publishedDate = entry.published?.[0] || "";
                const year = publishedDate ? new Date(publishedDate).getFullYear() : 0;
                
                // Filter by year if necessary
                if (settings.scholarYearFrom && settings.scholarYearFrom !== "Any") {
                    if (year < parseInt(settings.scholarYearFrom)) {
                        continue;
                    }
                }
                
                const url = entry.id?.[0] || "";
                
                // Extract authors
                let authorsList: string[] = [];
                if (entry.author) {
                    authorsList = entry.author.map((a: any) => a.name?.[0] || "Unknown");
                }

                articles.push({
                    title,
                    summary,
                    authors: authorsList,
                    year,
                    url
                });
            }
        }

        // 5. Save back to DB
        await supabase.from('agent_sessions').update({
            status: 'completed',
            visuals_json: articles,
        }).eq('id', sessionId);

        return NextResponse.json({ articles, query: arxivQuery });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
